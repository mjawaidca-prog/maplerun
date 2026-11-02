/**
 * Pay-period date helpers (Wave 3 B5).
 *
 * PayRun stores only the period END (`payDate`). The period start is
 * derived from the pay group's frequency at finalize time and stored
 * on the run (`periodStart`) so stubs can print the full range.
 * Pure functions — no I/O — so the derivation is unit-testable.
 */

export type PayFrequencyCode = "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY" | "MONTHLY";

function toUtcDate(iso: string): Date {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ISO date: ${iso}`);
  return d;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/**
 * Derive the first day of the pay period whose END is `payDate`.
 *
 *  - WEEKLY:      payDate − 6 days
 *  - BIWEEKLY:    payDate − 13 days
 *  - SEMIMONTHLY: periods end on the 15th and on month-end; a payDate on
 *                 the 15th starts on the 1st, any other payDate is
 *                 treated as the month-end period starting on the 16th.
 *  - MONTHLY:     the 1st of payDate's month.
 */
export function derivePeriodStart(frequency: string, payDate: string): string {
  const end = toUtcDate(payDate);
  switch (frequency) {
    case "WEEKLY":
      return toIso(addDays(end, -6));
    case "BIWEEKLY":
      return toIso(addDays(end, -13));
    case "SEMIMONTHLY":
      return end.getUTCDate() === 15
        ? toIso(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)))
        : toIso(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 16)));
    case "MONTHLY":
      return toIso(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)));
    default:
      // Unknown frequency — fall back to a biweekly-length period rather
      // than failing finalize over a display-only value.
      return toIso(addDays(end, -13));
  }
}
