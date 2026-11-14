/**
 * Pure billing helpers shared by /api/billing/checkout and
 * /api/billing/webhook — kept side-effect free so the money-moving
 * decisions (what a checkout charges, what a completed checkout records
 * on the Company) are unit-testable without Stripe or the database.
 */

import type Stripe from "stripe";
import { getPlan, type PlanDefinition } from "./stripe";

/**
 * Normalise a Stripe reference that may arrive as a bare id string, an
 * expanded object, or nothing.
 */
export function stripeId(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * Line items for a subscription Checkout session: the plan's base price
 * (quantity 1) plus the plan's per-employee price × the company's actual
 * active employee count. The per-employee item is omitted entirely at
 * zero employees, so a company with no staff yet is charged base only.
 *
 * Prices are built inline with price_data — the same pattern the
 * checkout route has always used for the base price (the PLANS
 * stripePriceId values exist in config but the live checkout path has
 * never referenced pre-created Stripe price IDs).
 *
 * Annual billing is 10× the monthly price billed yearly (2 months
 * free), applied to BOTH line items so the per-employee part stays in
 * proportion with the base.
 *
 * `employeeCount` MUST come from the server-side database count — the
 * checkout route computes it itself and never trusts the client's body.
 */
export function buildCheckoutLineItems(
  plan: PlanDefinition,
  employeeCount: number,
  annual: boolean,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const interval = annual ? ("year" as const) : ("month" as const);
  const multiplier = annual ? 10 : 1;
  const label = annual ? `${plan.name} (Annual)` : plan.name;

  const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "cad",
        product_data: { name: `Nexvar Pay ${label}` },
        unit_amount: plan.basePriceCents * multiplier,
        recurring: { interval },
      },
      quantity: 1,
    },
  ];

  if (employeeCount > 0) {
    items.push({
      price_data: {
        currency: "cad",
        product_data: { name: `Nexvar Pay ${label} — Employees` },
        unit_amount: plan.employeePriceCents * multiplier,
        recurring: { interval },
      },
      quantity: employeeCount,
    });
  }

  return items;
}

/**
 * The Company update a completed checkout must persist (Piece A of the
 * billing fix — before this, the webhook persisted nothing, so a paying
 * company stayed "on trial" forever):
 *
 *  - plan becomes the purchased plan (from the session metadata the
 *    checkout route itself set — server-side, not client input);
 *  - the Stripe customer + subscription ids are recorded so later
 *    subscription.updated / .deleted events can be matched back even if
 *    their metadata is ever missing;
 *  - subscriptionStatus records the subscription's live status;
 *  - trialEndsAt is CLEARED — the company has paid, and lib/trial now
 *    trusts subscriptionStatus from here on.
 *
 * Returns null when the metadata names no known plan (nothing safe to
 * record — the webhook logs and skips rather than writing a bogus plan).
 */
export function checkoutCompletionCompanyUpdate(input: {
  planId: string | null | undefined;
  customerId: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string;
}): {
  plan: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string;
  trialEndsAt: null;
} | null {
  if (!input.planId || !getPlan(input.planId)) return null;
  return {
    plan: input.planId,
    stripeCustomerId: input.customerId,
    stripeSubscriptionId: input.subscriptionId,
    subscriptionStatus: input.subscriptionStatus,
    trialEndsAt: null,
  };
}

// ---------------------------------------------------------------------------
// In-place plan upgrade (/api/billing/upgrade)
//
// Unlike checkout, an upgrade MUTATES the company's one existing Stripe
// subscription: its items are swapped for the new plan's catalog prices
// with proration, so the customer pays only the difference for the rest
// of the current paid period and the full new price from the next
// renewal. The helpers below are the pure pieces of that flow — the
// Stripe-touching parts live in lib/stripe-catalog.ts and the route.
// ---------------------------------------------------------------------------

/** The two recurring intervals a subscription can bill on. */
export type BillingInterval = "month" | "year";

/** Annual billing is 10× the monthly amounts (2 months free). */
export function intervalMultiplier(interval: BillingInterval): number {
  return interval === "year" ? 10 : 1;
}

/**
 * Stable lookup_key for a plan price in the Stripe catalog, e.g.
 * `nexvarpay_growth_base_month` or `nexvarpay_solo_employees_year`.
 * lookup_keys are unique per account, so find-or-create by key is
 * idempotent, and `transfer_lookup_key` lets a later price supersede an
 * earlier one under the same key without breaking the lookup.
 */
export function planPriceLookupKey(
  planId: string,
  kind: "base" | "employees",
  interval: BillingInterval,
): string {
  return `nexvarpay_${planId}_${kind}_${interval}`;
}

/** Unit amount (cents CAD) for a plan price at the given interval. */
export function planPriceUnitAmount(
  plan: PlanDefinition,
  kind: "base" | "employees",
  interval: BillingInterval,
): number {
  const monthly =
    kind === "base" ? plan.basePriceCents : plan.employeePriceCents;
  return monthly * intervalMultiplier(interval);
}

/** Full amount the plan bills per period at the given interval. */
export function planPeriodTotal(
  plan: PlanDefinition,
  employeeCount: number,
  interval: BillingInterval,
): number {
  return (
    planPriceUnitAmount(plan, "base", interval) +
    planPriceUnitAmount(plan, "employees", interval) * employeeCount
  );
}

/** The billing interval of a subscription, read off its first item. */
export function subscriptionInterval(
  subscription: Stripe.Subscription,
): BillingInterval {
  return subscription.items.data[0]?.price.recurring?.interval === "year"
    ? "year"
    : "month";
}

/**
 * The `items` payload for an in-place subscription update that replaces
 * EVERY current item with the new plan's prices: each existing item is
 * marked `deleted`, then the new base item (quantity 1) and — only when
 * the company has active employees — the new per-employee item are
 * appended. Deleting by id (rather than relying on Stripe's positional
 * matching) is what guarantees exactly one subscription with exactly
 * the new plan's items afterwards, however many items the old
 * subscription carried.
 */
export function buildSubscriptionItemReplacement(input: {
  currentItems: readonly { id: string }[];
  basePriceId: string;
  employeePriceId: string | null;
  employeeCount: number;
}): Stripe.SubscriptionUpdateParams.Item[] {
  const items: Stripe.SubscriptionUpdateParams.Item[] = input.currentItems.map(
    (item) => ({ id: item.id, deleted: true }),
  );
  items.push({ price: input.basePriceId, quantity: 1 });
  if (input.employeePriceId && input.employeeCount > 0) {
    items.push({
      price: input.employeePriceId,
      quantity: input.employeeCount,
    });
  }
  return items;
}

/**
 * The Company update a completed in-place upgrade must persist — the
 * upgrade counterpart of checkoutCompletionCompanyUpdate. The
 * subscription itself does not change identity, so the recorded
 * subscription id is carried through unchanged; plan becomes the new
 * plan, status is the subscription's status after the update, and the
 * trial is cleared (an upgraded company is a paying company).
 *
 * Returns null when the metadata names no known plan (nothing safe to
 * record — the route logs and skips rather than writing a bogus plan).
 */
export function upgradeCompanyUpdate(input: {
  planId: string | null | undefined;
  subscriptionId: string;
  subscriptionStatus: string;
}): {
  plan: string;
  stripeSubscriptionId: string;
  subscriptionStatus: string;
  trialEndsAt: null;
} | null {
  if (!input.planId || !getPlan(input.planId)) return null;
  return {
    plan: input.planId,
    stripeSubscriptionId: input.subscriptionId,
    subscriptionStatus: input.subscriptionStatus,
    trialEndsAt: null,
  };
}
