/**
 * RL-1 slip computation (Revenu Québec) — pure module.
 *
 * Governing spec summary: ~/workspace/nexvar-pay-versatility/specs/rq-rl1-xml.md
 * (box table from the official RL-1 slip RL-1-T and guide RL-1.G-V).
 *
 * Scope: this module computes the SLIP boxes for one Québec employee's year
 * from already-aggregated payroll data. It does NOT produce the transmission
 * XML — Revenu Québec's RL XML XSDs and field layout are restricted to
 * registered partners (spec §4), so the XML serializer is blocked on RQ
 * partner registration; `buildRl1DataExport` below is the documented
 * interim export the serializer will consume once the spec is obtainable.
 * The RL-1 Summary is a separate transmission and is NOT part of a slip.
 *
 * Key rules encoded here (spec §1, §5):
 *  - Box A is employment income on a DATE-PAID basis — aggregation by pay
 *    date is the caller's responsibility; this module takes the year's
 *    totals as given.
 *  - B.A (base + first additional QPP) and B.B (second additional QPP) are
 *    kept separate; B.A + B.B is the employee's total QPP.
 *  - Box E is Québec income tax withheld — it exists only on the RL-1
 *    (the same amount must NOT appear in T4 box 22; see t4-boxes.ts).
 *  - Box J is the amount the EMPLOYER paid to a private health services
 *    plan — it is NOT employer QPIP (a common miscoding the spec calls
 *    out). Employer QPP/QPIP live on the RL-1 Summary, not the slip.
 *  - Box O is unusable without its mandatory "Code (case O)".
 *  - Slips are issued per employee per year for Québec province of
 *    employment only; the caller filters, this module asserts.
 */

export type Rl1EmployeeYearData = {
  employeeId: string;
  employeeName: string;
  /** Must be "QC" — RL-1 is for Québec province of employment only. */
  provinceOfEmployment: string;

  /** Box A — employment income before source deductions (date-paid). */
  employmentIncome: number;
  /** B.A — QPP contribution: base + first additional contribution. */
  qppBaseAndFirstAdditional: number;
  /** B.B — QPP second additional contribution (QPP2). */
  qppSecondAdditional: number;
  /** Box C — EI premiums (Québec reduced rate). */
  eiPremiums: number;
  /** Box D — RPP contributions. */
  rppContributions?: number;
  /** Box E — Québec income tax withheld. */
  quebecTaxWithheld: number;
  /** Box F — union dues. */
  unionDues?: number;
  /** Box G — QPP pensionable salary/wages. */
  qppPensionableEarnings: number;
  /** Box H — QPIP premiums (employee). */
  qpipPremiums: number;
  /** Box I — QPIP eligible salary/wages. */
  qpipEligibleEarnings: number;

  /** Box J — employer-paid private health services plan amount. */
  employerPrivateHealthPlan?: number;
  /** Box K — trips by residents of designated remote areas. */
  remoteAreaTrips?: number;
  /** Box L — other taxable benefits (already included in A where applicable). */
  otherTaxableBenefits?: number;
  /** Box M — commissions (already included in A or R). */
  commissions?: number;
  /** Box N — charitable donations and gifts. */
  charitableDonations?: number;
  /** Box O — other income not in A. Requires `caseOCode`. */
  otherIncome?: number;
  /** Mandatory code identifying the type of box O income. */
  caseOCode?: string;
  /** Box Q — deferred salary/wages (tax-exempt; NOT in A or R). */
  deferredSalary?: number;
  /** Box R — employment income situated on a reserve or premises. */
  reserveIncome?: number;
  /** Box T — tips allocated by the employer (already in A or R). */
  allocatedTips?: number;
};

export type Rl1Slip = {
  employeeId: string;
  employeeName: string;
  boxA: number;
  boxBA: number;
  boxBB: number;
  /** B.A + B.B — total employee QPP (convenience; not itself a box). */
  qppTotal: number;
  boxC: number;
  boxD: number;
  boxE: number;
  boxF: number;
  boxG: number;
  boxH: number;
  boxI: number;
  boxJ: number;
  boxK: number;
  boxL: number;
  boxM: number;
  boxN: number;
  boxO: number;
  caseOCode: string | null;
  boxQ: number;
  boxR: number;
  boxT: number;
  warnings: string[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function money(value: number | undefined, field: string): number {
  if (value === undefined) return 0;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`RL-1 input ${field} must be a non-negative finite amount (got ${value}).`);
  }
  return round2(value);
}

/**
 * Compute one RL-1 slip from a Québec employee's year aggregates.
 * Throws on structurally invalid input (wrong province, negative amounts,
 * box O without its mandatory code) — a bad slip must be loud, never
 * silently zero-filled.
 */
export function computeRl1Slip(data: Rl1EmployeeYearData): Rl1Slip {
  if (data.provinceOfEmployment !== "QC") {
    throw new Error(
      `RL-1 slips are for Québec province of employment only (got "${data.provinceOfEmployment}" for employee ${data.employeeId}).`
    );
  }

  const warnings: string[] = [];

  const boxO = money(data.otherIncome, "otherIncome");
  if (boxO > 0 && !data.caseOCode) {
    throw new Error(
      `RL-1 box O (other income) requires the mandatory "Code (case O)" for employee ${data.employeeId}.`
    );
  }
  if (boxO === 0 && data.caseOCode) {
    warnings.push("caseOCode supplied but box O is 0 — the code will not be reported.");
  }

  const boxBA = money(data.qppBaseAndFirstAdditional, "qppBaseAndFirstAdditional");
  const boxBB = money(data.qppSecondAdditional, "qppSecondAdditional");
  const boxG = money(data.qppPensionableEarnings, "qppPensionableEarnings");
  const boxH = money(data.qpipPremiums, "qpipPremiums");
  const boxI = money(data.qpipEligibleEarnings, "qpipEligibleEarnings");

  // Sanity relationships — warn, don't throw: aggregation upstream decides.
  if (boxBB > 0 && boxBA === 0) {
    warnings.push("B.B (QPP2) is positive but B.A is 0 — QPP2 only arises after the base/first-additional band; check the split.");
  }
  if (boxH > 0 && boxI === 0) {
    warnings.push("Box H (QPIP premiums) is positive but box I (QPIP eligible earnings) is 0.");
  }
  if (boxG === 0 && boxBA + boxBB > 0) {
    warnings.push("QPP contributions are positive but box G (QPP pensionable earnings) is 0.");
  }

  return {
    employeeId: data.employeeId,
    employeeName: data.employeeName,
    boxA: money(data.employmentIncome, "employmentIncome"),
    boxBA,
    boxBB,
    qppTotal: round2(boxBA + boxBB),
    boxC: money(data.eiPremiums, "eiPremiums"),
    boxD: money(data.rppContributions, "rppContributions"),
    boxE: money(data.quebecTaxWithheld, "quebecTaxWithheld"),
    boxF: money(data.unionDues, "unionDues"),
    boxG,
    boxH,
    boxI,
    boxJ: money(data.employerPrivateHealthPlan, "employerPrivateHealthPlan"),
    boxK: money(data.remoteAreaTrips, "remoteAreaTrips"),
    boxL: money(data.otherTaxableBenefits, "otherTaxableBenefits"),
    boxM: money(data.commissions, "commissions"),
    boxN: money(data.charitableDonations, "charitableDonations"),
    boxO,
    caseOCode: boxO > 0 ? (data.caseOCode ?? null) : null,
    boxQ: money(data.deferredSalary, "deferredSalary"),
    boxR: money(data.reserveIncome, "reserveIncome"),
    boxT: money(data.allocatedTips, "allocatedTips"),
    warnings,
  };
}

/**
 * Documented interim export (spec §4): the field set the RQ XML serializer
 * will consume once the partner-restricted XSDs are available. JSON-shaped,
 * one record per slip, amounts as fixed 2-decimal strings per RQ file
 * conventions. Slip numbers (spec §3: two 9-digit series) are assigned by
 * the filing layer, not here — they are sequential and auditable, so they
 * must come from persisted state, never generated ad hoc.
 */
export type Rl1DataExport = {
  taxationYear: number;
  generatedAt: string;
  slips: Array<Record<string, string>>;
};

export function buildRl1DataExport(slips: Rl1Slip[], taxationYear: number): Rl1DataExport {
  const fmt = (n: number) => n.toFixed(2);
  return {
    taxationYear,
    generatedAt: new Date().toISOString(),
    slips: slips.map((s) => {
      const rec: Record<string, string> = {
        employeeId: s.employeeId,
        employeeName: s.employeeName,
        A: fmt(s.boxA),
        "B.A": fmt(s.boxBA),
        "B.B": fmt(s.boxBB),
        C: fmt(s.boxC),
        D: fmt(s.boxD),
        E: fmt(s.boxE),
        F: fmt(s.boxF),
        G: fmt(s.boxG),
        H: fmt(s.boxH),
        I: fmt(s.boxI),
        J: fmt(s.boxJ),
        K: fmt(s.boxK),
        L: fmt(s.boxL),
        M: fmt(s.boxM),
        N: fmt(s.boxN),
        O: fmt(s.boxO),
        Q: fmt(s.boxQ),
        R: fmt(s.boxR),
        T: fmt(s.boxT),
      };
      if (s.caseOCode) rec["caseOCode"] = s.caseOCode;
      return rec;
    }),
  };
}
