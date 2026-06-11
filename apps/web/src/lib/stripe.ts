/**
 * Stripe client and plan definitions for MapleRun billing.
 *
 * PLAN ID SETUP (do in Stripe Dashboard before enabling billing):
 *   1. Create products: "MapleRun Solo", "MapleRun Growth", "MapleRun Accountant"
 *   2. Create prices for each (recurring, CAD, per-seat model with base fee):
 *      - Solo:   $15/mo base + $3/employee
 *      - Growth:  $25/mo base + $3/employee
 *      - Accountant: $59/mo base + $2/employee
 *   3. Copy price IDs here and to .env as NEXT_PUBLIC_STRIPE_PRICE_<PLAN>
 *   4. Set STRIPE_WEBHOOK_SECRET from Stripe Dashboard → Webhooks
 */

import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠ STRIPE_SECRET_KEY not set — billing features disabled.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-05-27.dahlia",
  typescript: true,
});

// ---------------------------------------------------------------------------
// Plan definitions — must match Stripe Dashboard price IDs
// ---------------------------------------------------------------------------

export interface PlanDefinition {
  id: string;
  name: string;
  basePriceCents: number;
  employeePriceCents: number;
  stripePriceId: string;
  features: string[];
}

export const PLANS: Record<string, PlanDefinition> = {
  solo: {
    id: "solo",
    name: "Solo",
    basePriceCents: 1_500, // $15.00 CAD
    employeePriceCents: 300, // $3.00 CAD
    stripePriceId:
      process.env.STRIPE_PRICE_SOLO ?? "price_SOLO_PLACEHOLDER",
    features: [
      "1 company",
      "Unlimited pay runs",
      "Pay stubs with PDF download",
      "PD7A remittance reports",
      "Email pay stub delivery",
    ],
  },
  growth: {
    id: "growth",
    name: "Growth",
    basePriceCents: 2_500, // $25.00 CAD
    employeePriceCents: 300, // $3.00 CAD
    stripePriceId:
      process.env.STRIPE_PRICE_GROWTH ?? "price_GROWTH_PLACEHOLDER",
    features: [
      "Everything in Solo",
      "T4 reporting",
      "Record of Employment (ROE)",
      "Data exports (CSV, PDF)",
      "Multi-admin access",
      "Priority support",
    ],
  },
  accountant: {
    id: "accountant",
    name: "Accountant",
    basePriceCents: 5_900, // $59.00 CAD
    employeePriceCents: 200, // $2.00 CAD
    stripePriceId:
      process.env.STRIPE_PRICE_ACCOUNTANT ?? "price_ACCOUNTANT_PLACEHOLDER",
    features: [
      "Everything in Growth",
      "Multi-company workspace",
      "Bulk pay runs",
      "Client-ready reporting",
      "Dedicated support",
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the plan definition by key, or null. */
export function getPlan(planId: string): PlanDefinition | null {
  return PLANS[planId] ?? null;
}

/** Calculate the monthly total in cents for a plan + employee count. */
export function planMonthlyTotal(plan: PlanDefinition, employeeCount: number): number {
  return plan.basePriceCents + plan.employeePriceCents * employeeCount;
}
