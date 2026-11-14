/**
 * Find-or-create the Stripe catalog objects the in-place upgrade flow
 * (/api/billing/upgrade) needs.
 *
 * The live checkout path never references catalog prices — it builds
 * price_data inline per session (see lib/billing.ts). An in-place
 * subscription update cannot do that: subscription items must point at
 * real Price objects. So each plan gets ONE Product (found by the
 * `app` + `planId` metadata stamped at creation) and, per billing
 * interval, one base Price and one per-employee Price, found by the
 * stable lookup_keys from lib/billing.ts (planPriceLookupKey).
 *
 * A found price is reused only when its unit_amount still matches the
 * plan definition in lib/stripe.ts; if the plan's price ever changes,
 * a replacement price is created and the lookup key is transferred to
 * it (Stripe archives the old price), so the key always resolves to
 * the current amount.
 */

import { stripe, type PlanDefinition } from "./stripe";
import {
  planPriceLookupKey,
  planPriceUnitAmount,
  type BillingInterval,
} from "./billing";

/** Metadata stamped on every catalog object this module creates. */
const APP_METADATA = { app: "nexvar-pay" } as const;

/** Find the plan's Product by its stamped metadata, or create it. */
export async function ensurePlanProduct(
  plan: PlanDefinition,
): Promise<string> {
  const search = await stripe.products.search({
    query: `metadata['app']:'${APP_METADATA.app}' AND metadata['planId']:'${plan.id}'`,
  });
  const existing = search.data.find((product) => product.active);
  if (existing) return existing.id;

  const product = await stripe.products.create({
    name: `Nexvar Pay ${plan.name}`,
    metadata: { ...APP_METADATA, planId: plan.id },
  });
  return product.id;
}

/** Find the plan's current Price for (kind, interval), or create it. */
async function ensurePlanPrice(
  productId: string,
  plan: PlanDefinition,
  kind: "base" | "employees",
  interval: BillingInterval,
): Promise<string> {
  const lookupKey = planPriceLookupKey(plan.id, kind, interval);
  const unitAmount = planPriceUnitAmount(plan, kind, interval);

  const found = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const current = found.data[0];
  if (current && current.unit_amount === unitAmount) return current.id;

  const price = await stripe.prices.create({
    product: productId,
    currency: "cad",
    unit_amount: unitAmount,
    recurring: { interval },
    lookup_key: lookupKey,
    // When superseding a stale price, move the key onto the new price
    // (Stripe archives the old one) so lookups keep resolving.
    ...(current ? { transfer_lookup_key: true } : {}),
    metadata: { ...APP_METADATA, planId: plan.id },
  });
  return price.id;
}

/**
 * The catalog price ids an in-place upgrade swaps onto the company's
 * subscription at the given interval. `employeePriceId` is null at
 * zero employees — the subscription then carries no per-employee item,
 * mirroring buildCheckoutLineItems.
 */
export async function ensurePlanPrices(
  plan: PlanDefinition,
  interval: BillingInterval,
  employeeCount: number,
): Promise<{ basePriceId: string; employeePriceId: string | null }> {
  const productId = await ensurePlanProduct(plan);
  const basePriceId = await ensurePlanPrice(productId, plan, "base", interval);
  const employeePriceId =
    employeeCount > 0
      ? await ensurePlanPrice(productId, plan, "employees", interval)
      : null;
  return { basePriceId, employeePriceId };
}
