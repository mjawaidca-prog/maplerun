/**
 * Free-trial gate for pay runs — single source of truth.
 *
 * A company is on a free trial when `trialEndsAt` is set (promo accounts
 * have it null and are never gated). While on trial, finalizing a pay run
 * is blocked when the trial period has ended, or when the free pay-run cap
 * (`maxFreePayRuns`) has been used up. The server action enforces this;
 * the New Pay Run page uses the same helper to explain the state BEFORE
 * the user fills in the wizard, instead of failing at the final click
 * (production Next.js redacts thrown server-action messages, so a throw
 * alone reaches the user as a generic error).
 *
 * Paid subscriptions (recorded on the Company by /api/billing/webhook)
 * take precedence over the trial clock:
 *  - `subscriptionStatus == null` — the company has NEVER subscribed;
 *    the trial/promo rules above apply exactly as before.
 *  - A status in PAID_SUBSCRIPTION_STATUSES — paid access, never gated
 *    (`trialEndsAt` was already cleared at checkout). `past_due` counts
 *    as paid: Stripe's dunning retries are still running, and access
 *    ends only when the subscription flips to unpaid/canceled, which
 *    the webhook records and the gate then blocks on.
 *  - Any other recorded status (canceled, unpaid, incomplete_expired,
 *    …) — the subscription is dead; finalizing is blocked until the
 *    company subscribes again.
 */
export type TrialGate =
  | { state: "none" }
  | { state: "ended"; trialEndsAt: Date }
  | { state: "exhausted"; used: number; max: number }
  | { state: "active"; used: number; max: number; trialEndsAt: Date }
  | { state: "subscription_inactive"; status: string };

export interface TrialCompany {
  trialEndsAt: Date | null;
  freePayRunsUsed: number;
  maxFreePayRuns: number;
  /**
   * Last known Stripe subscription status, recorded by the billing
   * webhook. Null/absent = never subscribed (trial/promo rules apply).
   */
  subscriptionStatus?: string | null;
}

/** Stripe subscription statuses that still carry paid access. */
export const PAID_SUBSCRIPTION_STATUSES: readonly string[] = [
  "active",
  "trialing",
  "past_due",
];

/** True when the company has a recorded subscription in good standing. */
export function hasActiveSubscription(company: {
  subscriptionStatus?: string | null;
}): boolean {
  return (
    company.subscriptionStatus != null &&
    PAID_SUBSCRIPTION_STATUSES.includes(company.subscriptionStatus)
  );
}

export function trialGate(company: TrialCompany, now: Date = new Date()): TrialGate {
  const status = company.subscriptionStatus ?? null;
  if (status !== null) {
    if (PAID_SUBSCRIPTION_STATUSES.includes(status)) return { state: "none" };
    return { state: "subscription_inactive", status };
  }

  if (!company.trialEndsAt) return { state: "none" };
  if (company.trialEndsAt < now) return { state: "ended", trialEndsAt: company.trialEndsAt };
  if (company.freePayRunsUsed >= company.maxFreePayRuns) {
    return { state: "exhausted", used: company.freePayRunsUsed, max: company.maxFreePayRuns };
  }
  return {
    state: "active",
    used: company.freePayRunsUsed,
    max: company.maxFreePayRuns,
    trialEndsAt: company.trialEndsAt,
  };
}

/** Plain-language explanation when finalizing is blocked, else null. */
export function trialBlockMessage(gate: TrialGate): string | null {
  switch (gate.state) {
    case "ended":
      return "Your 14-day free trial has ended. Upgrade to a paid plan to continue running payroll.";
    case "exhausted":
      return `Free trial limit reached (${gate.used}/${gate.max} pay runs used). Upgrade your plan to finalize more pay runs.`;
    case "subscription_inactive":
      return "Your paid subscription is no longer active. Resubscribe to a paid plan to continue running payroll.";
    default:
      return null;
  }
}
