/**
 * T4 Summary ↔ PD7A tie-out — pure module (no DB, no I/O).
 *
 * Design: DESIGN-TAX-DOMAIN.md §6.1.2 — "Summary must reconcile to the year's
 * remittances — the T4 summary vs PD7A totals tie-out is a built-in check,
 * with any difference (PIER-style) surfaced before filing, not after a CRA
 * letter."
 *
 * The two sides are the product's two existing computations over the same
 * finalized pay runs, and they do NOT read the same stored numbers:
 *
 *   PD7A side — the remittance path (lib/remittance/aggregate.ts, reused
 *   verbatim via aggregateRemittances) reads the STORED PayRun row totals.
 *   Per employee, the remittance side is the employee's pay-slip (item) sums
 *   adjusted by any stored-total discrepancy on runs where that employee is
 *   the only payee (a single-employee run's discrepancy belongs to that
 *   employee; a multi-employee run's discrepancy is reported at totals level
 *   with the run named in the cause). Earnings on this side are the payroll
 *   engine's YTD accumulations (ytdInsurable / ytdPensionable on the year's
 *   last item) — the capped figures the engine actually tracked.
 *
 *   T4 side — the T4 report path (lib/actions/t4.ts getT4Report), ported
 *   faithfully below: per-employee item sums, rounded once per slip, with
 *   boxes 24/26 built by that module's heuristic (gross of every period in
 *   which EI/CPP was withheld). If getT4Report's aggregation changes, this
 *   port must change with it — the tie-out compares the reports as produced.
 *
 * Differences are listed, never netted: two employees with equal and opposite
 * differences produce two rows and a "differences to review" verdict even
 * when the company totals agree to the cent.
 *
 * Causes are pattern matches, in priority order: a pay run finalized after
 * the last remittance period of the year; a reversed pay run whose amounts
 * match the difference; the CPP basic-exemption signatures (full-year and
 * prorated); CPP/CPP2/EI annual-cap signatures; the gross-over-cap earnings
 * signature; per-period rounding; and finally an explicit "no recognized
 * pattern" — a difference is always explained or listed, never absorbed.
 * Québec employees are excluded from the CPP/EI pattern detectors (QPP/QPIP
 * parameters differ) and fall through to the generic causes.
 */

import {
  aggregateRemittances,
  type Pd7aTotals,
  type RemittanceRunRow,
} from "../remittance/aggregate";

// ─── Shared money helper ─────────────────────────────────────────────────────

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

/** One pay-slip line, reduced to the fields the tie-out reads. */
export interface TieOutItemInput {
  employeeId: string;
  gross: number;
  cpp: number;
  cpp2: number;
  ei: number;
  federalTax: number;
  provincialTax: number;
  employerCpp: number;
  employerCpp2: number;
  employerEi: number;
  /** Engine YTD accumulations AFTER this item (last item of the year wins). */
  ytdPensionable: number;
  ytdInsurable: number;
}

/** One pay run with its stored totals (the PD7A side's source) and items. */
export interface TieOutRunInput {
  id: string;
  /** ISO date "YYYY-MM-DD". */
  payDate: string;
  /** DRAFT | FINALIZED | REVERSED — only FINALIZED runs feed either side. */
  status: string;
  /** ISO datetime the run was finalized, if known. */
  finalizedAt: string | null;
  /** ISO datetime the run was reversed, if known. */
  reversedAt: string | null;
  /** Pay periods per year of the run's pay group (12/24/26/52). */
  periodsPerYear: number;
  // Stored run totals — exactly what aggregateRemittances consumes.
  totalGross: number;
  totalCpp: number;
  totalCpp2: number;
  totalEi: number;
  totalFederalTax: number;
  totalProvincialTax: number;
  totalEmployerCpp: number;
  totalEmployerCpp2: number;
  totalEmployerEi: number;
  itemCount: number;
  items: TieOutItemInput[];
}

export interface TieOutEmployeeMeta {
  name: string;
  /** Province of employment, 2-letter ("QC" switches off CPP/EI detectors). */
  province: string;
}

/** The year's CPP/EI parameters, supplied by the caller from @maplerun/tax-engine. */
export interface TieOutParams {
  cppRate: number;
  cpp2Rate: number;
  basicExemption: number;
  ympe: number;
  yampe: number;
  /** (YMPE − exemption) × rate, rounded — the engine's maxCppContribution. */
  maxCpp: number;
  /** (YAMPE − YMPE) × cpp2Rate, rounded — the engine's maxCpp2Contribution. */
  maxCpp2: number;
  eiRate: number;
  eiRateQuebec: number;
  maxInsurableEarnings: number;
}

export interface TieOutInput {
  year: number;
  runs: TieOutRunInput[];
  employees: Record<string, TieOutEmployeeMeta>;
  params: TieOutParams;
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

export type TieOutField =
  | "grossPayroll"
  | "employeeCpp"
  | "employeeCpp2"
  | "employeeEi"
  | "incomeTax"
  | "eiInsurableEarnings"
  | "cppPensionableEarnings"
  | "totalRemittance";

export type TieOutCauseCode =
  | "late-run"
  | "reversed-run"
  | "cpp-exemption"
  | "cpp-cap"
  | "ei-cap"
  | "earnings-over-cap"
  | "maxed-out-earnings"
  | "rounding"
  | "run-mismatch"
  | "explained-by-employees"
  | "unexplained";

export interface TieOutDifference {
  scope: "total" | "employee";
  employeeId: string | null;
  /** Employee name, or "All employees" for totals rows. */
  employeeName: string;
  field: TieOutField;
  fieldLabel: string;
  pd7aAmount: number;
  t4Amount: number;
  /** t4Amount − pd7aAmount, to the cent. */
  difference: number;
  causeCode: TieOutCauseCode;
  cause: string;
}

export interface TieOutComparedTotal {
  field: TieOutField;
  fieldLabel: string;
  pd7aAmount: number;
  t4Amount: number;
  difference: number;
}

export interface TieOutResult {
  year: number;
  /** True only when every compared field matches to the cent. */
  tiesOut: boolean;
  differenceCount: number;
  differences: TieOutDifference[];
  comparedTotals: TieOutComparedTotal[];
  employeeCount: number;
  payRunCount: number;
}

// ─── Field metadata ──────────────────────────────────────────────────────────

const FIELD_LABELS: Record<TieOutField, string> = {
  grossPayroll: "Gross payroll (box 14)",
  employeeCpp: "Employee CPP (box 16)",
  employeeCpp2: "Employee CPP2 (box 16A)",
  employeeEi: "Employee EI (box 18)",
  incomeTax: "Income tax deducted (box 22)",
  eiInsurableEarnings: "EI insurable earnings (box 24)",
  cppPensionableEarnings: "CPP pensionable earnings (box 26)",
  totalRemittance: "Total remittance",
};

const TOTAL_FIELDS: TieOutField[] = [
  "grossPayroll",
  "employeeCpp",
  "employeeCpp2",
  "employeeEi",
  "incomeTax",
  "eiInsurableEarnings",
  "cppPensionableEarnings",
  "totalRemittance",
];

const EMPLOYEE_FIELDS: TieOutField[] = [
  "grossPayroll",
  "employeeCpp",
  "employeeCpp2",
  "employeeEi",
  "incomeTax",
  "eiInsurableEarnings",
  "cppPensionableEarnings",
];

/** Money fields whose PD7A side comes from stored run totals. */
const RUN_TOTAL_FIELDS = [
  "grossPayroll",
  "employeeCpp",
  "employeeCpp2",
  "employeeEi",
  "incomeTax",
  "totalRemittance",
] as const;
type RunTotalField = (typeof RUN_TOTAL_FIELDS)[number];

// ─── Per-run / per-item field access ─────────────────────────────────────────

function itemField(item: TieOutItemInput, field: RunTotalField): number {
  switch (field) {
    case "grossPayroll": return item.gross;
    case "employeeCpp": return item.cpp;
    case "employeeCpp2": return item.cpp2;
    case "employeeEi": return item.ei;
    case "incomeTax": return item.federalTax + item.provincialTax;
    case "totalRemittance":
      return (
        item.cpp + item.cpp2 + item.ei + item.federalTax + item.provincialTax +
        item.employerCpp + item.employerCpp2 + item.employerEi
      );
  }
}

function runStoredField(run: TieOutRunInput, field: RunTotalField): number {
  switch (field) {
    case "grossPayroll": return run.totalGross;
    case "employeeCpp": return run.totalCpp;
    case "employeeCpp2": return run.totalCpp2;
    case "employeeEi": return run.totalEi;
    case "incomeTax": return run.totalFederalTax + run.totalProvincialTax;
    case "totalRemittance":
      return (
        run.totalCpp + run.totalCpp2 + run.totalEi +
        run.totalFederalTax + run.totalProvincialTax +
        run.totalEmployerCpp + run.totalEmployerCpp2 + run.totalEmployerEi
      );
  }
}

function runItemsField(run: TieOutRunInput, field: RunTotalField): number {
  return run.items.reduce((s, it) => s + itemField(it, field), 0);
}

// ─── Internal aggregates ─────────────────────────────────────────────────────

interface EmployeeAggregate {
  employeeId: string;
  // Raw item sums over FINALIZED runs.
  gross: number;
  cpp: number;
  cpp2: number;
  ei: number;
  incomeTax: number;
  totalRemittanceItems: number;
  payPeriods: number;
  periodsPerYear: number;
  // Engine YTD earnings from the year's last item.
  ytdPensionable: number;
  ytdInsurable: number;
  // T4 slip (port of lib/actions/t4.ts) — heuristic boxes 24/26 included.
  slip: {
    box14: number; box16: number; box16A: number; box18: number;
    box22: number; box24: number; box26: number;
  };
  // PD7A side: item sums + attributed single-employee run discrepancies.
  pd7a: Record<RunTotalField, number>;
}

function centsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.01;
}

// ─── Main entry point ────────────────────────────────────────────────────────

export function buildT4Pd7aTieOut(input: TieOutInput): TieOutResult {
  const { year, params } = input;
  const yearPrefix = String(year);
  const runs = input.runs.filter((r) => r.payDate.startsWith(yearPrefix));
  const finalized = runs
    .filter((r) => r.status === "FINALIZED")
    .slice()
    .sort((a, b) => (a.payDate < b.payDate ? -1 : a.payDate > b.payDate ? 1 : 0));
  const reversed = runs.filter((r) => r.status === "REVERSED");

  // ── PD7A totals: the existing remittance module, verbatim ──────────────
  const runRows: RemittanceRunRow[] = finalized.map((r) => ({
    payDate: r.payDate,
    totalCpp: r.totalCpp,
    totalCpp2: r.totalCpp2,
    totalEi: r.totalEi,
    totalFederalTax: r.totalFederalTax,
    totalProvincialTax: r.totalProvincialTax,
    totalEmployerCpp: r.totalEmployerCpp,
    totalEmployerCpp2: r.totalEmployerCpp2,
    totalEmployerEi: r.totalEmployerEi,
    itemCount: r.itemCount,
  }));
  const pd7aTotals: Pd7aTotals = aggregateRemittances(runRows, "monthly").totals;
  const pd7aGross = round2(finalized.reduce((s, r) => s + r.totalGross, 0));

  // ── Per-employee aggregation over finalized runs ────────────────────────
  const employees = new Map<string, EmployeeAggregate>();
  const aggFor = (employeeId: string): EmployeeAggregate => {
    let a = employees.get(employeeId);
    if (!a) {
      a = {
        employeeId,
        gross: 0, cpp: 0, cpp2: 0, ei: 0, incomeTax: 0, totalRemittanceItems: 0,
        payPeriods: 0, periodsPerYear: 26, ytdPensionable: 0, ytdInsurable: 0,
        slip: { box14: 0, box16: 0, box16A: 0, box18: 0, box22: 0, box24: 0, box26: 0 },
        pd7a: {
          grossPayroll: 0, employeeCpp: 0, employeeCpp2: 0, employeeEi: 0,
          incomeTax: 0, totalRemittance: 0,
        },
      };
      employees.set(employeeId, a);
    }
    return a;
  };

  for (const run of finalized) {
    for (const item of run.items) {
      const a = aggFor(item.employeeId);
      a.gross += item.gross;
      a.cpp += item.cpp;
      a.cpp2 += item.cpp2;
      a.ei += item.ei;
      a.incomeTax += item.federalTax + item.provincialTax;
      a.totalRemittanceItems += itemField(item, "totalRemittance");
      a.payPeriods += 1;
      a.periodsPerYear = run.periodsPerYear;
      // Runs are payDate-ascending, so the last write is the year's last item.
      a.ytdPensionable = item.ytdPensionable;
      a.ytdInsurable = item.ytdInsurable;
      // T4 slip port (lib/actions/t4.ts): boxes 24/26 sum the gross of every
      // period in which EI/CPP was withheld — the heuristic as produced.
      a.slip.box14 += item.gross;
      a.slip.box16 += item.cpp;
      a.slip.box16A += item.cpp2;
      a.slip.box18 += item.ei;
      a.slip.box22 += item.federalTax + item.provincialTax;
      a.slip.box24 += item.ei > 0 ? item.gross : 0;
      a.slip.box26 += item.cpp > 0 ? item.gross : 0;
    }
  }
  for (const a of employees.values()) {
    for (const k of Object.keys(a.slip) as (keyof typeof a.slip)[]) {
      a.slip[k] = round2(a.slip[k]);
    }
    a.pd7a.grossPayroll = a.gross;
    a.pd7a.employeeCpp = a.cpp;
    a.pd7a.employeeCpp2 = a.cpp2;
    a.pd7a.employeeEi = a.ei;
    a.pd7a.incomeTax = a.incomeTax;
    a.pd7a.totalRemittance = a.totalRemittanceItems;
  }

  // ── Run discrepancies: stored totals vs the sum of the run's own slips ──
  // discrepancy = stored − items, per field. A single-employee run's
  // discrepancy is attributed to that employee's PD7A side; a multi-employee
  // run's discrepancy stays at totals level and names the run in the cause.
  interface RunDiscrepancy {
    run: TieOutRunInput;
    field: RunTotalField;
    discrepancy: number;
    soleEmployeeId: string | null;
  }
  const runDiscrepancies: RunDiscrepancy[] = [];
  for (const run of finalized) {
    const distinct = [...new Set(run.items.map((i) => i.employeeId))];
    const sole = distinct.length === 1 ? distinct[0] : null;
    for (const field of RUN_TOTAL_FIELDS) {
      const discrepancy = round2(runStoredField(run, field) - runItemsField(run, field));
      if (discrepancy !== 0) {
        runDiscrepancies.push({ run, field, discrepancy, soleEmployeeId: sole });
        if (sole) {
          const a = employees.get(sole);
          if (a) a.pd7a[field] = round2(a.pd7a[field] + discrepancy);
        }
      }
    }
  }

  // ── Side values by field ────────────────────────────────────────────────
  const slipField = (a: EmployeeAggregate, field: TieOutField): number => {
    switch (field) {
      case "grossPayroll": return a.slip.box14;
      case "employeeCpp": return a.slip.box16;
      case "employeeCpp2": return a.slip.box16A;
      case "employeeEi": return a.slip.box18;
      case "incomeTax": return a.slip.box22;
      case "eiInsurableEarnings": return a.slip.box24;
      case "cppPensionableEarnings": return a.slip.box26;
      case "totalRemittance": return round2(a.totalRemittanceItems);
    }
  };
  const pd7aEmployeeField = (a: EmployeeAggregate, field: TieOutField): number => {
    switch (field) {
      case "eiInsurableEarnings": return round2(a.ytdInsurable);
      case "cppPensionableEarnings": return round2(a.ytdPensionable);
      default: return round2(a.pd7a[field as RunTotalField]);
    }
  };

  const aggList = [...employees.values()];
  const t4TotalsByField: Record<TieOutField, number> = {
    grossPayroll: round2(aggList.reduce((s, a) => s + a.slip.box14, 0)),
    employeeCpp: round2(aggList.reduce((s, a) => s + a.slip.box16, 0)),
    employeeCpp2: round2(aggList.reduce((s, a) => s + a.slip.box16A, 0)),
    employeeEi: round2(aggList.reduce((s, a) => s + a.slip.box18, 0)),
    incomeTax: round2(aggList.reduce((s, a) => s + a.slip.box22, 0)),
    eiInsurableEarnings: round2(aggList.reduce((s, a) => s + a.slip.box24, 0)),
    cppPensionableEarnings: round2(aggList.reduce((s, a) => s + a.slip.box26, 0)),
    totalRemittance: round2(aggList.reduce((s, a) => s + a.totalRemittanceItems, 0)),
  };
  const pd7aTotalsByField: Record<TieOutField, number> = {
    grossPayroll: pd7aGross,
    employeeCpp: pd7aTotals.employeeCpp,
    employeeCpp2: pd7aTotals.employeeCpp2,
    employeeEi: pd7aTotals.employeeEi,
    incomeTax: pd7aTotals.incomeTax,
    eiInsurableEarnings: round2(aggList.reduce((s, a) => s + a.ytdInsurable, 0)),
    cppPensionableEarnings: round2(aggList.reduce((s, a) => s + a.ytdPensionable, 0)),
    totalRemittance: pd7aTotals.totalRemittance,
  };

  const comparedTotals: TieOutComparedTotal[] = TOTAL_FIELDS.map((field) => ({
    field,
    fieldLabel: FIELD_LABELS[field],
    pd7aAmount: pd7aTotalsByField[field],
    t4Amount: t4TotalsByField[field],
    difference: round2(t4TotalsByField[field] - pd7aTotalsByField[field]),
  }));

  // ── Cause detection ─────────────────────────────────────────────────────
  // Employee rows are built into this array BEFORE totals rows, so the
  // totals-row cause check can read them (step 8 in detectCause).
  const differences: TieOutDifference[] = [];

  interface CauseContext {
    field: TieOutField;
    difference: number;
    pd7aAmount: number;
    t4Amount: number;
    employee: EmployeeAggregate | null;
  }

  const fmt = (n: number): string =>
    `$${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const detectCause = (ctx: CauseContext): { causeCode: TieOutCauseCode; cause: string } => {
    const { field, difference, pd7aAmount, t4Amount } = ctx;
    const absDiff = Math.abs(difference);
    const emp = ctx.employee;
    const meta = emp ? input.employees[emp.employeeId] : undefined;
    const province = meta?.province ?? "";
    const isQc = province === "QC";

    // 1) A pay run finalized after the year's last remittance period whose
    //    stored totals do not carry its slips (or whose slips match the gap).
    for (const d of runDiscrepancies) {
      if (d.field !== field) continue;
      const finalizedLate =
        d.run.finalizedAt !== null && d.run.finalizedAt.slice(0, 4) > String(year);
      if (finalizedLate && centsEqual(Math.abs(d.discrepancy), absDiff)) {
        return {
          causeCode: "late-run",
          cause:
            `Matches pay run dated ${d.run.payDate}, which was finalized on ` +
            `${(d.run.finalizedAt as string).slice(0, 10)} — after the last remittance period of ${year}. ` +
            `Its pay slips are in the T4 figures, but the stored run totals feeding the PD7A figures do not ` +
            `include them. Confirm the final ${year} remittance was amended to include this run.`,
        };
      }
    }

    // 2) A reversed pay run whose amounts match the difference exactly.
    if ((RUN_TOTAL_FIELDS as readonly string[]).includes(field)) {
      for (const run of reversed) {
        const amount = round2(runItemsField(run, field as RunTotalField));
        if (amount !== 0 && centsEqual(Math.abs(amount), absDiff)) {
          return {
            causeCode: "reversed-run",
            cause:
              `Matches the amounts on pay run dated ${run.payDate}, which was reversed` +
              `${run.reversedAt ? ` on ${run.reversedAt.slice(0, 10)}` : ""}. One side still carries the ` +
              `reversed run's amounts — check that the replacement run was finalized and that its stored ` +
              `totals were recomputed after the reversal.`,
          };
        }
      }
    }

    // 3) CPP basic-exemption signatures (non-Québec).
    if (field === "employeeCpp" && !isQc) {
      const impliedBase = absDiff / params.cppRate;
      if (Math.abs(impliedBase - params.basicExemption) <= 1) {
        return {
          causeCode: "cpp-exemption",
          cause:
            `The difference equals the CPP basic exemption (${fmt(params.basicExemption)} × ` +
            `${(params.cppRate * 100).toFixed(2)}%). One side applied the full annual exemption and the ` +
            `other spread it across pay periods — the classic PIER exemption difference. CRA's review ` +
            `expects the annual exemption; confirm which figure the T4 will report.`,
        };
      }
      if (emp && emp.periodsPerYear > emp.payPeriods) {
        const shortfallBase =
          params.basicExemption * (1 - emp.payPeriods / emp.periodsPerYear);
        if (shortfallBase > 0 && Math.abs(absDiff - params.cppRate * shortfallBase) <= 0.05) {
          return {
            causeCode: "cpp-exemption",
            cause:
              `Consistent with the CPP basic exemption being prorated: the employee was paid in ` +
              `${emp.payPeriods} of ${emp.periodsPerYear} periods, so the per-period exemption added up ` +
              `to ${fmt(params.basicExemption - shortfallBase)} of the ${fmt(params.basicExemption)} annual ` +
              `exemption. The shortfall × the CPP rate is this difference — the standard PIER exemption finding.`,
          };
        }
      }
    }

    // 4) Annual contribution-cap signatures (non-Québec).
    if (emp && !isQc && field === "employeeCpp") {
      const over = Math.max(pd7aAmount, t4Amount) - params.maxCpp;
      if (emp.ytdPensionable >= params.ympe && over > 0 && Math.abs(absDiff - over) <= 0.05) {
        return {
          causeCode: "cpp-cap",
          cause:
            `One side kept deducting CPP after the annual maximum contribution of ${fmt(params.maxCpp)} ` +
            `was reached (pensionable earnings passed the YMPE of ${fmt(params.ympe)}). The excess over ` +
            `the maximum is this difference.`,
        };
      }
    }
    if (emp && !isQc && field === "employeeCpp2") {
      const over = Math.max(pd7aAmount, t4Amount) - params.maxCpp2;
      if (emp.ytdPensionable > params.ympe && over > 0 && Math.abs(absDiff - over) <= 0.05) {
        return {
          causeCode: "cpp-cap",
          cause:
            `One side kept deducting CPP2 after the annual CPP2 maximum of ${fmt(params.maxCpp2)} was ` +
            `reached (earnings between the YMPE and YAMPE). The excess over the maximum is this difference.`,
        };
      }
    }
    if (emp && !isQc && field === "employeeEi") {
      const rate = params.eiRate;
      const maxPremium = round2(params.maxInsurableEarnings * rate);
      const over = Math.max(pd7aAmount, t4Amount) - maxPremium;
      if (over > 0 && Math.abs(absDiff - over) <= 0.05) {
        return {
          causeCode: "ei-cap",
          cause:
            `One side kept deducting EI premiums after the annual maximum premium of ${fmt(maxPremium)} ` +
            `was reached — the cap is normally hit mid-period, so the final period's premium is the usual ` +
            `suspect. The excess over the maximum is this difference.`,
        };
      }
      if (
        emp.ytdInsurable >= params.maxInsurableEarnings &&
        Math.abs(absDiff - (emp.slip.box24 - params.maxInsurableEarnings) * rate) <= 0.05 &&
        emp.slip.box24 > params.maxInsurableEarnings
      ) {
        return {
          causeCode: "ei-cap",
          cause:
            `Consistent with EI premiums being calculated on earnings above the maximum insurable ` +
            `earnings of ${fmt(params.maxInsurableEarnings)} in one figure: the excess earnings × the ` +
            `${(rate * 100).toFixed(2)}% premium rate is this difference.`,
        };
      }
    }

    // 5) Earnings-figure signatures (boxes 24/26 vs engine YTD earnings).
    if (emp && field === "eiInsurableEarnings") {
      const rate = isQc ? params.eiRateQuebec : params.eiRate;
      const maxPremium = round2(params.maxInsurableEarnings * rate);
      if (t4Amount > params.maxInsurableEarnings && centsEqual(pd7aAmount, params.maxInsurableEarnings)) {
        return {
          causeCode: "earnings-over-cap",
          cause:
            `The T4 figure is gross-based and runs past the maximum insurable earnings of ` +
            `${fmt(params.maxInsurableEarnings)}; the remittance side carries the engine's capped YTD ` +
            `insurable earnings. Box 24 must not exceed the MIE.`,
        };
      }
      if (difference < 0 && emp.ei >= maxPremium - 0.01) {
        return {
          causeCode: "maxed-out-earnings",
          cause:
            `The employee reached the maximum EI premium of ${fmt(maxPremium)} during the year. After ` +
            `that point no EI was withheld, and the T4 figure — which counts only periods where EI was ` +
            `withheld — stops growing, while the remittance side carries the engine's full-year ` +
            `insurable earnings.`,
        };
      }
    }
    if (emp && field === "cppPensionableEarnings") {
      if (t4Amount > params.ympe && centsEqual(pd7aAmount, params.ympe)) {
        return {
          causeCode: "earnings-over-cap",
          cause:
            `The T4 figure is gross-based and runs past the YMPE of ${fmt(params.ympe)}; the remittance ` +
            `side carries the engine's capped YTD pensionable earnings.`,
        };
      }
      if (difference < 0 && !isQc && emp.cpp >= params.maxCpp - 0.01) {
        return {
          causeCode: "maxed-out-earnings",
          cause:
            `The employee reached the maximum CPP contribution of ${fmt(params.maxCpp)} during the ` +
            `year. After that point no CPP was withheld, and the T4 figure — which counts only periods ` +
            `where CPP was withheld — stops growing, while the remittance side carries the engine's ` +
            `full-year pensionable earnings.`,
        };
      }
    }

    // 6) Rounding: remittances round every period; the T4 rounds once.
    const periods = emp ? emp.payPeriods : finalized.length;
    if (absDiff <= Math.max(0.02, 0.01 * periods)) {
      return {
        causeCode: "rounding",
        cause:
          `Cent-level difference consistent with rounding: the PD7A figures are rounded period by ` +
          `period, while the T4 rounds once at year-end. No action needed unless CRA queries it.`,
      };
    }

    // 7) A single run's stored totals disagree with its own pay slips.
    for (const d of runDiscrepancies) {
      if (d.field !== field) continue;
      if (centsEqual(Math.abs(d.discrepancy), absDiff)) {
        return {
          causeCode: "run-mismatch",
          cause:
            `The stored totals on pay run dated ${d.run.payDate} differ from the sum of that run's own ` +
            `pay slips by exactly this amount. The PD7A figures read the stored totals; the T4 figures ` +
            `read the pay slips. The run may have been edited after finalizing, or finalized before a ` +
            `correction was applied — re-finalize or correct the run totals.`,
        };
      }
    }

    // 8) Totals row fully explained by the employee rows.
    if (!emp) {
      const empDiffs = differences.filter(
        (x) => x.scope === "employee" && x.field === field,
      );
      const explained = round2(empDiffs.reduce((s, x) => s + x.difference, 0));
      if (empDiffs.length > 0 && centsEqual(explained, difference)) {
        return {
          causeCode: "explained-by-employees",
          cause:
            `Fully explained by the ${empDiffs.length} employee difference(s) for this field listed ` +
            `below — there is no additional company-level difference.`,
        };
      }
      const runNamed = runDiscrepancies.filter(
        (d) => d.field === field && d.soleEmployeeId === null,
      );
      if (runNamed.length > 0) {
        const dates = runNamed.map((d) => d.run.payDate).join(", ");
        return {
          causeCode: "run-mismatch",
          cause:
            `Traced to the stored totals of pay run(s) dated ${dates}, whose totals differ from the ` +
            `sum of their pay slips. The PD7A figures read the stored totals; the T4 figures read the ` +
            `pay slips. Correct the run totals before filing.`,
        };
      }
    }

    // 9) No recognized pattern — listed, never absorbed.
    return {
      causeCode: "unexplained",
      cause: emp
        ? `No recognized pattern. Review this employee's ${year} pay runs period by period, comparing ` +
          `each remittance against the pay slips, before filing.`
        : `No recognized pattern. Review the ${year} pay runs period by period, comparing each ` +
          `remittance against the pay slips, before filing.`,
    };
  };

  // ── Build the difference rows ───────────────────────────────────────────
  // Employee rows first: totals-row cause detection reads them (step 8).
  const sortedEmployees = aggList.slice().sort((a, b) => {
    const na = input.employees[a.employeeId]?.name ?? a.employeeId;
    const nb = input.employees[b.employeeId]?.name ?? b.employeeId;
    return na < nb ? -1 : na > nb ? 1 : 0;
  });
  for (const a of sortedEmployees) {
    const meta = input.employees[a.employeeId];
    for (const field of EMPLOYEE_FIELDS) {
      const pd7aAmount = pd7aEmployeeField(a, field);
      const t4Amount = slipField(a, field);
      const difference = round2(t4Amount - pd7aAmount);
      if (difference === 0) continue;
      const { causeCode, cause } = detectCause({
        field, difference, pd7aAmount, t4Amount, employee: a,
      });
      differences.push({
        scope: "employee",
        employeeId: a.employeeId,
        employeeName: meta?.name ?? a.employeeId,
        field,
        fieldLabel: FIELD_LABELS[field],
        pd7aAmount,
        t4Amount,
        difference,
        causeCode,
        cause,
      });
    }
  }

  // Totals rows.
  for (const ct of comparedTotals) {
    if (ct.difference === 0) continue;
    const { causeCode, cause } = detectCause({
      field: ct.field,
      difference: ct.difference,
      pd7aAmount: ct.pd7aAmount,
      t4Amount: ct.t4Amount,
      employee: null,
    });
    differences.push({
      scope: "total",
      employeeId: null,
      employeeName: "All employees",
      field: ct.field,
      fieldLabel: ct.fieldLabel,
      pd7aAmount: ct.pd7aAmount,
      t4Amount: ct.t4Amount,
      difference: ct.difference,
      causeCode,
      cause,
    });
  }

  // Totals rows first in the final list, then employee rows (already sorted).
  const totalRows = differences.filter((d) => d.scope === "total");
  const employeeRows = differences.filter((d) => d.scope === "employee");
  const ordered = [...totalRows, ...employeeRows];

  return {
    year,
    tiesOut: ordered.length === 0,
    differenceCount: ordered.length,
    differences: ordered,
    comparedTotals,
    employeeCount: employees.size,
    payRunCount: finalized.length,
  };
}
