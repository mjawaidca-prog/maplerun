/**
 * ROE period-history builder (pure helper, no DB access).
 *
 * Turns finalized pay-run items into the per-period history the ROE Web
 * Payroll Extract serializer (`roe-extract.ts`) consumes for Blocks 15A/15C
 * (Appendix D §8.2.4 / Table 7; spec `roe-web.md` §4–§5).
 *
 * This replaces the defective logic in `lib/actions/roe.ts`, where insurable
 * hours came from an optional caller-supplied `hoursPerPeriod` map and
 * silently defaulted to 0 (`?? 0`), producing 0-hour ROEs. Here the hours
 * recorded on each pay-run item (`PayRunItem.hours`) are authoritative, and
 * any period that still carries 0 hours is COUNTED and returned via
 * `zeroHourPeriods` so the caller can warn instead of silently emitting a
 * 0-hour ROE.
 */

/** One finalized pay-run item, reduced to what the ROE history needs. */
export interface RoePeriodItemInput {
  /** Pay date of the run (ISO date or datetime; the date part is used). */
  payDate: string;
  /** Insurable hours recorded for this item (`PayRunItem.hours`). */
  hours: number;
  /** Gross pay for this item (`PayRunItem.gross`). */
  gross: number;
  /** Employee EI premium deducted for this item (`PayRunItem.ei`). */
  ei: number;
  /**
   * Stored per-item insurable earnings, once Nexvar Pay persists them.
   * Takes precedence over the legacy `ei > 0` fallback below.
   */
  insurableEarnings?: number;
}

/** One pay period in the shape `RoeExtractInput.periods` expects. */
export interface RoePeriod {
  /** Period end date, `CCYY-MM-DD`. */
  periodEnd: string;
  insurableHours: number;
  insurableEarnings: number;
}

export interface BuildRoePeriodsResult {
  /** Periods sorted most-recent-first (Block 15C PP1 = most recent). */
  periods: RoePeriod[];
  /**
   * How many of the returned periods have 0 recorded insurable hours.
   * Callers should surface this (e.g. "N periods have 0 recorded hours")
   * rather than letting a 0 flow into Block 15A unnoticed — that silent
   * default was the original ROE worksheet bug.
   */
  zeroHourPeriods: number;
}

/** Extract the `CCYY-MM-DD` date part from an ISO date/datetime string. */
function datePart(value: string): string {
  return value.slice(0, 10);
}

/**
 * Build the ROE period history from pay-run items, in any input order.
 *
 * Insurable earnings per item: `item.insurableEarnings` when stored;
 * otherwise the LEGACY FALLBACK `ei > 0 ? gross : 0` — an item counts as
 * insurable only when an EI premium was actually deducted on it. The
 * fallback is retained from the original `generateRoe` computation and
 * must stay until per-item insurable earnings are stored (spec §8.1);
 * it can misstate earnings at the EI maximum-earnings cap, where gross
 * overstates the insurable amount.
 */
export function buildRoePeriods(
  items: RoePeriodItemInput[],
): BuildRoePeriodsResult {
  const periods: RoePeriod[] = items.map((item) => ({
    periodEnd: datePart(item.payDate),
    insurableHours: item.hours,
    insurableEarnings:
      item.insurableEarnings ?? (item.ei > 0 ? item.gross : 0),
  }));

  // Most-recent-first for Block 15C (Appendix D §8.2.4: PP1 = most recent).
  // `CCYY-MM-DD` strings sort chronologically; Array.prototype.sort is
  // stable, so same-day periods keep their input order.
  periods.sort((a, b) =>
    a.periodEnd < b.periodEnd ? 1 : a.periodEnd > b.periodEnd ? -1 : 0,
  );

  const zeroHourPeriods = periods.filter(
    (p) => p.insurableHours === 0,
  ).length;

  return { periods, zeroHourPeriods };
}
