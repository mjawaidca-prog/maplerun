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
 */
export type TrialGate =
  | { state: "none" }
  | { state: "ended"; trialEndsAt: Date }
  | { state: "exhausted"; used: number; max: number }
  | { state: "active"; used: number; max: number; trialEndsAt: Date };

export interface TrialCompany {
  trialEndsAt: Date | null;
  freePayRunsUsed: number;
  maxFreePayRuns: number;
}

export function trialGate(company: TrialCompany, now: Date = new Date()): TrialGate {
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
    default:
      return null;
  }
}
