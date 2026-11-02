/**
 * Shared CRA remittance (PD7A) aggregation — the ONE code path that computes
 * a remittance number anywhere in the product.
 *
 * Pure functions only: no prisma, no session, no server-action wrapper, so
 * server actions, server components, and tests can all consume the same math.
 *
 * Why this exists: the Reports hub (via getPd7aReport) and the Remittances
 * page (which recomputed totals inline in three separate loops) could
 * disagree for the same period — the inline history/schedule loops silently
 * omitted CPP2, and the hub covers a full year while the page headline covers
 * the current month. Every consumer now aggregates through here, so a figure
 * can only differ when the *scope* (period set) differs, never the math.
 */

import { employerQpipAmount } from "@/lib/payroll-display";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Remitter frequency. Only monthly/quarterly schedules exist today;
 *  remitter-type-driven schedules (accelerated etc.) arrive later. */
export type RemittanceFrequency = "monthly" | "quarterly";

/**
 * CRA remitter type as stored on Company.remitterType (Wave 1 foundation).
 * null / unset = not yet chosen — treated as REGULAR (monthly) everywhere.
 */
export type RemitterType = "REGULAR" | "QUARTERLY" | "ACCELERATED1" | "ACCELERATED2";

export const REMITTER_TYPES: readonly RemitterType[] = [
  "REGULAR", "QUARTERLY", "ACCELERATED1", "ACCELERATED2",
];

export function isRemitterType(v: unknown): v is RemitterType {
  return typeof v === "string" && (REMITTER_TYPES as readonly string[]).includes(v);
}

/** Human label for a remitter type (null → Regular, the CRA default). */
export function remitterTypeLabel(t: string | null | undefined): string {
  switch (t) {
    case "QUARTERLY": return "Quarterly remitter";
    case "ACCELERATED1": return "Accelerated remitter — Threshold 1";
    case "ACCELERATED2": return "Accelerated remitter — Threshold 2";
    default: return "Regular remitter";
  }
}

/** Aggregation grouping implied by a remitter type: QUARTERLY groups by
 *  quarter; every other type (incl. unset) groups monthly. */
export function groupingForRemitterType(
  t: string | null | undefined,
): RemittanceGrouping {
  return t === "QUARTERLY" ? "quarterly" : "monthly";
}

/** Grouping for aggregation — same dimension as remittance frequency. */
export type RemittanceGrouping = RemittanceFrequency;

/**
 * One finalized pay run, reduced to the fields remittance math needs.
 * `payDate` is an ISO date string ("YYYY-MM-DD"); the period key is derived
 * from it. Run totals are the PayRun row totals (NOT item sums).
 */
export type RemittanceRunRow = {
  payDate: string;
  totalCpp: number;
  totalCpp2: number;
  totalEi: number;
  totalFederalTax: number;
  totalProvincialTax: number;
  totalEmployerCpp: number;
  totalEmployerCpp2: number;
  totalEmployerEi: number;
  itemCount: number;
};

/** Per-period PD7A figures. Shape is the long-standing Pd7aPeriod contract
 *  (lib/actions/reports.ts re-exports this type). */
export type Pd7aPeriod = {
  period: string; // e.g. "2026-01", "2026-Q1"
  payRuns: number;
  employees: number;
  employeeCpp: number;
  employeeCpp2: number;
  employeeEi: number;
  employerCpp: number;
  employerCpp2: number;
  employerEi: number;
  federalTax: number;
  provincialTax: number;
  incomeTax: number; // federal + provincial
  totalRemittance: number;
};

/** Report-wide totals. Shape is the long-standing Pd7aReport["totals"]. */
export type Pd7aTotals = {
  payRuns: number;
  employeeCpp: number;
  employeeCpp2: number;
  employeeEi: number;
  employerCpp: number;
  employerCpp2: number;
  employerEi: number;
  federalTax: number;
  provincialTax: number;
  incomeTax: number;
  totalRemittance: number;
};

export type RemittanceAggregate = {
  periods: Pd7aPeriod[];
  totals: Pd7aTotals;
};

// ─── Period keys, labels, due dates ───────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Canonical period key for a pay date.
 * Monthly: "2026-01". Quarterly: "2026-Q1".
 * Parses the ISO string directly — no Date construction, so no timezone
 * or 0-indexed-month surprises.
 */
export function periodKeyForPayDate(
  payDate: string,
  grouping: RemittanceGrouping = "monthly",
): string {
  const [y, m] = payDate.split("-") as [string, string];
  if (grouping === "quarterly") {
    const q = Math.ceil(parseInt(m, 10) / 3);
    return `${y}-Q${q}`;
  }
  return `${y}-${m}`;
}

/**
 * Canonical period key for a Date (local calendar components).
 * This is the ONLY place period keys are built from a Date — getMonth()
 * is 0-indexed, so the +1 lives here and nowhere else.
 */
export function periodKeyForDate(
  date: Date,
  grouping: RemittanceGrouping = "monthly",
): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  if (grouping === "quarterly") {
    return `${y}-Q${Math.ceil(m / 3)}`;
  }
  return `${y}-${pad2(m)}`;
}

/** Human label for a period key: "2026-01" → "January 2026", "2026-Q1" → "Q1 2026". */
export function periodLabel(periodKey: string): string {
  const q = periodKey.match(/^(\d{4})-Q([1-4])$/);
  if (q) return `Q${q[2]} ${q[1]}`;
  const m = periodKey.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const month = MONTH_NAMES[parseInt(m[2], 10) - 1];
    if (month) return `${month} ${m[1]}`;
  }
  return periodKey;
}

/**
 * CRA due date for a period, as an ISO date string ("YYYY-MM-DD").
 * Regular remitter: the 15th of the month following the period —
 * monthly: 15th of the next month; quarterly: 15th of the month after
 * the quarter ends. (No weekend/holiday shift here: this is the nominal
 * statutory date. For the business-day-adjusted, remitter-aware date that
 * pages should display, use remittanceDueDateFor below.)
 */
export function remittanceDueDate(
  periodKey: string,
  frequency: RemittanceFrequency = "monthly",
): string {
  const q = periodKey.match(/^(\d{4})-Q([1-4])$/);
  if (frequency === "quarterly" || q) {
    // Quarter Q ends in month Q*3; due the 15th of the following month.
    const year = q ? parseInt(q[1], 10) : parseInt(periodKey.slice(0, 4), 10);
    const quarter = q ? parseInt(q[2], 10) : Math.ceil(parseInt(periodKey.slice(5, 7), 10) / 3);
    const dueMonth = quarter * 3 + 1; // 1-indexed, may be 13 → January of next year
    const dueYear = dueMonth > 12 ? year + 1 : year;
    return `${dueYear}-${pad2(dueMonth > 12 ? dueMonth - 12 : dueMonth)}-15`;
  }
  const year = parseInt(periodKey.slice(0, 4), 10);
  const month = parseInt(periodKey.slice(5, 7), 10);
  const dueMonth = month + 1;
  const dueYear = dueMonth > 12 ? year + 1 : year;
  return `${dueYear}-${pad2(dueMonth > 12 ? dueMonth - 12 : dueMonth)}-15`;
}

// ─── Business-day adjustment + remitter-aware due dates ──────────────────────

function isoToUTCDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10)) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function utcDateToISO(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function addDaysISO(iso: string, days: number): string {
  const d = isoToUTCDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateToISO(d);
}

/** Last calendar day of the month containing an ISO date, as ISO. */
function monthEndISO(iso: string): string {
  const [y, m] = iso.split("-").map((s) => parseInt(s, 10)) as [number, number];
  // Day 0 of month m+1 (1-indexed trick via 0-indexed month m) = last day of m.
  return utcDateToISO(new Date(Date.UTC(y, m, 0)));
}

/**
 * CRA business-day rule: when a due date falls on a Saturday, Sunday, or a
 * public holiday, the deadline moves to the NEXT business day — never
 * earlier. (The Remittances page previously shifted Saturday BACK to the
 * Friday 14th; that was wrong — Saturday → Monday the 17th, Sunday →
 * Monday the 16th.)
 *
 * Federal holidays are NOT modelled here: only the weekend shift is
 * applied. A nominal date that lands on a federal holiday will read one
 * business day early; treat the result as "on or before" guidance.
 */
export function adjustToNextBusinessDay(isoDate: string): string {
  let cur = isoDate;
  for (;;) {
    const day = isoToUTCDate(cur).getUTCDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) return cur;
    cur = addDaysISO(cur, 1);
  }
}

/** The date `n` business days (Mon–Fri) AFTER an ISO date. The start date
 *  itself is not counted; weekend days are skipped. Holidays not modelled
 *  (see adjustToNextBusinessDay). */
export function addBusinessDays(isoDate: string, n: number): string {
  let cur = isoDate;
  let remaining = n;
  while (remaining > 0) {
    cur = addDaysISO(cur, 1);
    const day = isoToUTCDate(cur).getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return cur;
}

/**
 * Remitter-aware, business-day-ADJUSTED CRA due date for a period.
 *
 * - REGULAR (and null/unset): monthly period — the 15th of the following
 *   month, shifted to the next business day when it lands on a weekend.
 * - QUARTERLY: quarter period ("2026-Q1") — the 15th of the month after
 *   the quarter ends, adjusted the same way. A monthly key is first mapped
 *   to its quarter.
 * - ACCELERATED1 (Threshold 1): monthly period — the FINAL deadline is the
 *   10th of the following month, adjusted. Note there are TWO deadlines per
 *   month for Threshold 1: amounts for the 1st–15th are due by the 25th of
 *   the same month, and amounts for the 16th–month-end by the 10th of the
 *   following month. This function returns the 10th (the deadline that
 *   closes the period); the page copy surfaces the 25th mid-period one.
 * - ACCELERATED2 (Threshold 2): 3 business days after the period's last
 *   day (periods are the 1st–7th, 8th–14th, 15th–21st and 22nd–month-end;
 *   a monthly key resolves to the month-end period, whose deadline is
 *   3 business days after month-end).
 *
 * Federal holidays are NOT modelled — weekend shifts only.
 */
export function remittanceDueDateFor(
  periodKey: string,
  remitterType: string | null | undefined,
): string {
  const type: RemitterType = isRemitterType(remitterType) ? remitterType : "REGULAR";

  if (type === "QUARTERLY") {
    const key = /-Q[1-4]$/.test(periodKey)
      ? periodKey
      : periodKeyForPayDate(`${periodKey}-01`, "quarterly");
    return adjustToNextBusinessDay(remittanceDueDate(key, "quarterly"));
  }

  if (type === "ACCELERATED1") {
    // Nominal 10th of the following month.
    const year = parseInt(periodKey.slice(0, 4), 10);
    const month = parseInt(periodKey.slice(5, 7), 10);
    const dueMonth = month + 1;
    const dueYear = dueMonth > 12 ? year + 1 : year;
    const nominal = `${dueYear}-${pad2(dueMonth > 12 ? dueMonth - 12 : dueMonth)}-10`;
    return adjustToNextBusinessDay(nominal);
  }

  if (type === "ACCELERATED2") {
    return addBusinessDays(monthEndISO(`${periodKey}-01`), 3);
  }

  // REGULAR
  return adjustToNextBusinessDay(remittanceDueDate(periodKey, "monthly"));
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyPeriod(period: string): Pd7aPeriod {
  return {
    period,
    payRuns: 0,
    employees: 0,
    employeeCpp: 0,
    employeeCpp2: 0,
    employeeEi: 0,
    employerCpp: 0,
    employerCpp2: 0,
    employerEi: 0,
    federalTax: 0,
    provincialTax: 0,
    incomeTax: 0,
    totalRemittance: 0,
  };
}

function emptyTotals(): Pd7aTotals {
  return {
    payRuns: 0,
    employeeCpp: 0,
    employeeCpp2: 0,
    employeeEi: 0,
    employerCpp: 0,
    employerCpp2: 0,
    employerEi: 0,
    federalTax: 0,
    provincialTax: 0,
    incomeTax: 0,
    totalRemittance: 0,
  };
}

const MONEY_KEYS = [
  "employeeCpp", "employeeCpp2", "employeeEi",
  "employerCpp", "employerCpp2", "employerEi",
  "federalTax", "provincialTax", "incomeTax", "totalRemittance",
] as const;

/**
 * Aggregate finalized pay runs into per-period PD7A figures plus totals.
 *
 * Rules (identical to the historical getPd7aReport math):
 * - incomeTax = federal + provincial
 * - totalRemittance = employee + employer CPP, CPP2 and EI, plus income tax
 *   (i.e. ALL source deductions, including CPP2 — no exceptions)
 * - each period's money fields are rounded to cents; totals are the sum of
 *   the rounded period figures, rounded again
 * - periods appear in first-seen order of the input rows (callers pass
 *   payDate-ascending rows for chronological output)
 * - employees per period = sum of run itemCounts (per-run headcount, not
 *   unique employees — same semantics as the historical report)
 */
export function aggregateRemittances(
  runs: readonly RemittanceRunRow[],
  grouping: RemittanceGrouping = "monthly",
): RemittanceAggregate {
  const byPeriod = new Map<string, Pd7aPeriod>();

  for (const run of runs) {
    const key = periodKeyForPayDate(run.payDate, grouping);
    let p = byPeriod.get(key);
    if (!p) {
      p = emptyPeriod(key);
      byPeriod.set(key, p);
    }
    p.payRuns += 1;
    p.employees += run.itemCount;
    p.employeeCpp += run.totalCpp;
    p.employeeCpp2 += run.totalCpp2;
    p.employeeEi += run.totalEi;
    p.employerCpp += run.totalEmployerCpp;
    p.employerCpp2 += run.totalEmployerCpp2;
    p.employerEi += run.totalEmployerEi;
    p.federalTax += run.totalFederalTax;
    p.provincialTax += run.totalProvincialTax;
  }

  const periods: Pd7aPeriod[] = [];
  const totals = emptyTotals();

  for (const p of byPeriod.values()) {
    p.incomeTax = p.federalTax + p.provincialTax;
    p.totalRemittance =
      p.employeeCpp + p.employerCpp +
      p.employeeCpp2 + p.employerCpp2 +
      p.employeeEi + p.employerEi +
      p.federalTax + p.provincialTax;
    for (const k of MONEY_KEYS) p[k] = round2(p[k]);

    periods.push(p);

    totals.payRuns += p.payRuns;
    for (const k of MONEY_KEYS) totals[k] += p[k];
  }
  for (const k of MONEY_KEYS) totals[k] = round2(totals[k]);

  return { periods, totals };
}

// ─── Revenu Québec aggregation (Wave 4, W4-D3) ───────────────────────────────

/**
 * One Quebec pay-run item reduced to the fields the Revenu Québec
 * remittance section needs. Callers resolve "is Quebec" per item
 * (employee.provinceOfEmployment ?? payGroup.defaultProvince === "QC")
 * and pass ONLY Quebec items — this function does no filtering.
 *
 * The employer QPIP share is NOT stored separately: the engine folds
 * it into employerEi, and lib/payroll-display.ts recovers it
 * (employerEi − round2(ei × 1.4)). The employee QPIP and the QPP/QPP2
 * amounts come from the item's split columns (qpp/qpp2/qpip) — the
 * same columns the RL-1 ties from.
 */
export type QuebecRemittanceItemRow = {
  qpp: number;
  qpp2: number;
  qpip: number;
  ei: number;
  employerCpp: number;
  employerCpp2: number;
  employerEi: number;
  /** Québec income tax withheld (the item's provincialTax for QC items). */
  quebecTax: number;
};

export type QuebecRemittanceTotals = {
  items: number;
  qppEmployee: number;
  qppEmployer: number;
  qpp2Employee: number;
  qpp2Employer: number;
  qpipEmployee: number;
  qpipEmployer: number;
  quebecTax: number;
  /** Everything owed to Revenu Québec for these items. */
  totalRq: number;
};

export function aggregateQuebecRemittances(
  items: readonly QuebecRemittanceItemRow[],
): QuebecRemittanceTotals {
  const t: QuebecRemittanceTotals = {
    items: items.length,
    qppEmployee: 0,
    qppEmployer: 0,
    qpp2Employee: 0,
    qpp2Employer: 0,
    qpipEmployee: 0,
    qpipEmployer: 0,
    quebecTax: 0,
    totalRq: 0,
  };
  for (const i of items) {
    t.qppEmployee += i.qpp;
    t.qppEmployer += i.employerCpp;
    t.qpp2Employee += i.qpp2;
    t.qpp2Employer += i.employerCpp2;
    t.qpipEmployee += i.qpip;
    t.qpipEmployer += employerQpipAmount(i);
    t.quebecTax += i.quebecTax;
  }
  t.qppEmployee = round2(t.qppEmployee);
  t.qppEmployer = round2(t.qppEmployer);
  t.qpp2Employee = round2(t.qpp2Employee);
  t.qpp2Employer = round2(t.qpp2Employer);
  t.qpipEmployee = round2(t.qpipEmployee);
  t.qpipEmployer = round2(t.qpipEmployer);
  t.quebecTax = round2(t.quebecTax);
  t.totalRq = round2(
    t.qppEmployee + t.qppEmployer + t.qpp2Employee + t.qpp2Employer +
    t.qpipEmployee + t.qpipEmployer + t.quebecTax,
  );
  return t;
}
