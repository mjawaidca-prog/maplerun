import { describe, it, expect, vi } from "vitest";

// src/lib/stripe.ts constructs the Stripe client at import time and the
// SDK refuses an empty key — give it a dummy for tests. vi.hoisted runs
// before the imported module graph is evaluated. No network calls made.
vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "sk_test_dummy";
});

import {
  stripeId,
  buildCheckoutLineItems,
  checkoutCompletionCompanyUpdate,
  planPriceLookupKey,
  planPriceUnitAmount,
  planPeriodTotal,
  subscriptionInterval,
  buildSubscriptionItemReplacement,
  upgradeCompanyUpdate,
} from "../src/lib/billing";
import { getPlan } from "../src/lib/stripe";
import type Stripe from "stripe";

const solo = getPlan("solo")!; // $7.00 base + $2.00/employee
const growth = getPlan("growth")!; // $19.00 base + $2.00/employee
const accountant = getPlan("accountant")!; // $49.00 base + $1.50/employee

/** Minimal subscription stand-in carrying just an item interval. */
function fakeSubscription(interval: "month" | "year"): Stripe.Subscription {
  return {
    items: {
      data: [{ price: { recurring: { interval } } }],
    },
  } as unknown as Stripe.Subscription;
}

describe("stripeId", () => {
  it("passes bare ids through and unwraps expanded objects", () => {
    expect(stripeId("sub_123")).toBe("sub_123");
    expect(stripeId({ id: "cus_9" })).toBe("cus_9");
  });

  it("maps missing values to null", () => {
    expect(stripeId(null)).toBeNull();
    expect(stripeId(undefined)).toBeNull();
  });
});

describe("buildCheckoutLineItems", () => {
  it("charges base + per-employee × the actual count (monthly)", () => {
    const items = buildCheckoutLineItems(growth, 3, false);
    expect(items).toHaveLength(2);
    expect(items[0].quantity).toBe(1);
    expect(items[0].price_data?.unit_amount).toBe(1900);
    expect(items[0].price_data?.recurring?.interval).toBe("month");
    expect(items[1].quantity).toBe(3);
    expect(items[1].price_data?.unit_amount).toBe(200);
    expect(items[1].price_data?.recurring?.interval).toBe("month");
    // The total Stripe will bill: 1900 + 3 × 200 = $25.00
    const total = items.reduce(
      (sum, i) => sum + (i.price_data?.unit_amount ?? 0) * (i.quantity ?? 0),
      0,
    );
    expect(total).toBe(2500);
  });

  it("omits the per-employee item at zero employees", () => {
    const items = buildCheckoutLineItems(growth, 0, false);
    expect(items).toHaveLength(1);
    expect(items[0].price_data?.unit_amount).toBe(1900);
  });

  it("uses the plan's own per-employee price (Accountant $1.50)", () => {
    const items = buildCheckoutLineItems(accountant, 4, false);
    expect(items[1].price_data?.unit_amount).toBe(150);
    expect(items[1].quantity).toBe(4);
  });

  it("annual bills 10× monthly on BOTH items, yearly interval", () => {
    const items = buildCheckoutLineItems(growth, 3, true);
    expect(items[0].price_data?.unit_amount).toBe(19000);
    expect(items[0].price_data?.recurring?.interval).toBe("year");
    expect(items[1].price_data?.unit_amount).toBe(2000);
    expect(items[1].quantity).toBe(3);
    expect(items[1].price_data?.recurring?.interval).toBe("year");
  });
});

describe("checkoutCompletionCompanyUpdate", () => {
  it("records plan, Stripe ids and status, and clears the trial", () => {
    const update = checkoutCompletionCompanyUpdate({
      planId: "growth",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      subscriptionStatus: "active",
    });
    expect(update).toEqual({
      plan: "growth",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      subscriptionStatus: "active",
      trialEndsAt: null,
    });
  });

  it("records null ids when Stripe sent none, rather than dropping the update", () => {
    const update = checkoutCompletionCompanyUpdate({
      planId: "solo",
      customerId: null,
      subscriptionId: null,
      subscriptionStatus: "active",
    });
    expect(update?.plan).toBe("solo");
    expect(update?.stripeSubscriptionId).toBeNull();
    expect(update?.trialEndsAt).toBeNull();
  });

  it("refuses to record an unknown or missing plan", () => {
    expect(
      checkoutCompletionCompanyUpdate({
        planId: "platinum",
        customerId: "cus_1",
        subscriptionId: "sub_1",
        subscriptionStatus: "active",
      }),
    ).toBeNull();
    expect(
      checkoutCompletionCompanyUpdate({
        planId: undefined,
        customerId: "cus_1",
        subscriptionId: "sub_1",
        subscriptionStatus: "active",
      }),
    ).toBeNull();
  });
});

describe("planPriceLookupKey", () => {
  it("builds stable keys per plan, kind and interval", () => {
    expect(planPriceLookupKey("growth", "base", "month")).toBe(
      "nexvarpay_growth_base_month",
    );
    expect(planPriceLookupKey("growth", "employees", "month")).toBe(
      "nexvarpay_growth_employees_month",
    );
    expect(planPriceLookupKey("solo", "base", "year")).toBe(
      "nexvarpay_solo_base_year",
    );
    expect(planPriceLookupKey("accountant", "employees", "year")).toBe(
      "nexvarpay_accountant_employees_year",
    );
  });
});

describe("planPriceUnitAmount / planPeriodTotal", () => {
  it("monthly amounts are the plan definition amounts", () => {
    expect(planPriceUnitAmount(growth, "base", "month")).toBe(1900);
    expect(planPriceUnitAmount(growth, "employees", "month")).toBe(200);
    expect(planPriceUnitAmount(accountant, "employees", "month")).toBe(150);
  });

  it("annual amounts are 10× monthly (2 months free), like checkout", () => {
    expect(planPriceUnitAmount(growth, "base", "year")).toBe(19000);
    expect(planPriceUnitAmount(solo, "employees", "year")).toBe(2000);
  });

  it("period total is base + per-employee × count at the interval", () => {
    expect(planPeriodTotal(growth, 3, "month")).toBe(2500); // $25.00
    expect(planPeriodTotal(growth, 3, "year")).toBe(25000);
    expect(planPeriodTotal(growth, 0, "month")).toBe(1900);
    expect(planPeriodTotal(accountant, 4, "month")).toBe(4900 + 4 * 150);
  });
});

describe("subscriptionInterval", () => {
  it("reads the interval off the subscription's first item", () => {
    expect(subscriptionInterval(fakeSubscription("month"))).toBe("month");
    expect(subscriptionInterval(fakeSubscription("year"))).toBe("year");
  });

  it("defaults to month when the subscription carries no items", () => {
    const empty = { items: { data: [] } } as unknown as Stripe.Subscription;
    expect(subscriptionInterval(empty)).toBe("month");
  });
});

describe("buildSubscriptionItemReplacement", () => {
  it("deletes every current item and adds the new plan's two items", () => {
    const items = buildSubscriptionItemReplacement({
      currentItems: [{ id: "si_old_base" }, { id: "si_old_emp" }],
      basePriceId: "price_growth_base",
      employeePriceId: "price_growth_emp",
      employeeCount: 3,
    });
    expect(items).toEqual([
      { id: "si_old_base", deleted: true },
      { id: "si_old_emp", deleted: true },
      { price: "price_growth_base", quantity: 1 },
      { price: "price_growth_emp", quantity: 3 },
    ]);
  });

  it("handles a multi-item old subscription (all items deleted)", () => {
    const items = buildSubscriptionItemReplacement({
      currentItems: [{ id: "si_1" }, { id: "si_2" }, { id: "si_3" }],
      basePriceId: "price_new_base",
      employeePriceId: "price_new_emp",
      employeeCount: 2,
    });
    expect(items.filter((i) => i.deleted)).toHaveLength(3);
    expect(items).toHaveLength(5);
    expect(items[3]).toEqual({ price: "price_new_base", quantity: 1 });
    expect(items[4]).toEqual({ price: "price_new_emp", quantity: 2 });
  });

  it("omits the per-employee item at zero employees", () => {
    const items = buildSubscriptionItemReplacement({
      currentItems: [{ id: "si_old_base" }, { id: "si_old_emp" }],
      basePriceId: "price_growth_base",
      employeePriceId: null,
      employeeCount: 0,
    });
    expect(items).toEqual([
      { id: "si_old_base", deleted: true },
      { id: "si_old_emp", deleted: true },
      { price: "price_growth_base", quantity: 1 },
    ]);
  });

  it("omits the per-employee item when no employee price exists, even with staff", () => {
    const items = buildSubscriptionItemReplacement({
      currentItems: [{ id: "si_old_base" }],
      basePriceId: "price_growth_base",
      employeePriceId: null,
      employeeCount: 5,
    });
    expect(items).toHaveLength(2);
    expect(items[1]).toEqual({ price: "price_growth_base", quantity: 1 });
  });
});

describe("upgradeCompanyUpdate", () => {
  it("records the new plan, keeps the subscription id, clears the trial", () => {
    const update = upgradeCompanyUpdate({
      planId: "growth",
      subscriptionId: "sub_1",
      subscriptionStatus: "active",
    });
    expect(update).toEqual({
      plan: "growth",
      stripeSubscriptionId: "sub_1",
      subscriptionStatus: "active",
      trialEndsAt: null,
    });
  });

  it("carries the post-update status through (e.g. past_due stays visible)", () => {
    const update = upgradeCompanyUpdate({
      planId: "accountant",
      subscriptionId: "sub_9",
      subscriptionStatus: "past_due",
    });
    expect(update?.subscriptionStatus).toBe("past_due");
    expect(update?.stripeSubscriptionId).toBe("sub_9");
  });

  it("refuses to record an unknown or missing plan", () => {
    expect(
      upgradeCompanyUpdate({
        planId: "platinum",
        subscriptionId: "sub_1",
        subscriptionStatus: "active",
      }),
    ).toBeNull();
    expect(
      upgradeCompanyUpdate({
        planId: undefined,
        subscriptionId: "sub_1",
        subscriptionStatus: "active",
      }),
    ).toBeNull();
  });
});
