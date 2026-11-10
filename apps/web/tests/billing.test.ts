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
} from "../src/lib/billing";
import { getPlan } from "../src/lib/stripe";

const growth = getPlan("growth")!; // $19.00 base + $2.00/employee
const accountant = getPlan("accountant")!; // $49.00 base + $1.50/employee

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
