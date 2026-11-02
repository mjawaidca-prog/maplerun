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

// ─── Types ────────────────────────────────────────────────────────────────────

/** Remitter frequency. Only monthly/quarterly schedules exist today;
 *  remitter-type-driven schedules (accelerated etc.) arrive later. */
export type RemittanceFrequency = "monthly" | "quarterly";

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
 * statutory date; presentation layers may annotate business-day shifts.)
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
