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
