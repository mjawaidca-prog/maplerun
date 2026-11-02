/**
 * T4 box calculations — pure module (no DB, no I/O).
 *
 * Governing spec: ~/workspace/nexvar-pay-versatility/specs/cra-t4-xml.md
 * ("CRA T4 Electronic Filing (XML / Internet File Transfer) — Implementation
 * Spec for Nexvar Pay"), §5 (slip boxes) and §6 (summary totals). Element-level
 * details were cross-checked against CRA's schema package xmlschm1-27-1
 * (t4.xsd, version 1.27) on 2026-11-02.
 *
 * This module replaces the defective aggregation in lib/actions/t4.ts, whose
 * known bugs were:
 *   - box 24 = gross pay whenever EI > 0 (must be the EI-insurable earnings,
 *     capped at the year's maximum insurable earnings — spec §5.2 / §8)
 *   - box 26 = gross pay whenever CPP > 0 (must be CPP pensionable earnings)
 *   - boxes 55/56 (QPIP) always 0
 *   - CPP and QPP amounts could be mixed on one slip (spec §5.2 forbids it)
 *   - box 22 always combined federal + provincial tax, including Québec tax
 *     (Québec provincial tax belongs on the RL-1, never on the T4 — spec §5.2)
 *
 * The wiring action (a later PR) decrypts the SIN and aggregates PayRunItem /
 * YtdLedger rows into `T4EmployeeYearData`; everything here is a pure
 * function of that input.
 */

// ─── Shared money helper ─────────────────────────────────────────────────────

/** Round to cents. Same convention as the existing lib/actions/t4.ts round2. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Input ───────────────────────────────────────────────────────────────────

/**
 * One "other information" amount (spec §5.3). `code` is the printed T4 code
 * (30, 31, 32, …). The serializer maps codes to XML elements and rejects
 * codes it cannot map unambiguously.
 */
export interface T4OtherInfoEntry {
  code: number;
  amount: number;
}

/**
 * Aggregated data for one employee, one province of employment, one year.
 *
 * IMPORTANT — capped earnings: `eiInsurableEarnings` and
 * `cppPensionableEarnings` must be the ENGINE-CAPPED totals (the YtdLedger
 * accumulations), never gross pay. If the caller cannot supply them, leave
 * them undefined: the slip then carries 0.00 with a warning (spec §5.2 makes
 * boxes 24/26 required, so 0.00 is the only honest placeholder). Falling back
 * to gross was the old bug and is deliberately NOT done here.
 *
 * IMPORTANT — income tax: pass `federalTax` and `provincialTax` SEPARATELY.
 * For Québec employees box 22 is federal tax only (spec §5.2). The legacy
 * `incomeTaxDeducted` combined figure is accepted only so a caller that has
 * nothing else fails loudly via a warning on QC slips instead of silently
 * overstating box 22.
 */
export interface T4EmployeeYearData {
  // Identity (spec §5.1). `sin` is plaintext ONLY because the export action
  // decrypts it immediately before calling this module; never persist it.
  surname: string;
  givenName: string;
  /** Initial of the second given name, if any (spec §5.1 <init>). */
  initial?: string;
  sin: string | null;
  employeeNumber?: string;

  // Residence address (spec §5.1 <EMPE_ADDR>).
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  /** Province/territory of residence, 2 alpha (or a US state; ZZ otherwise). */
  provinceOfResidence?: string;
  /** ISO 3166 alpha-3, default "CAN". */
  countryCode?: string;
  postalCode?: string;

  /** Box 10 — drives CPP vs QPP separation and the Québec tax rule. */
  provinceOfEmployment: string;
  /** Box 45 — employer-offered dental benefits code 1–5, default 1 (spec §5.1). */
  dentalBenefitsCode?: number;
  /** Box 28 exemption flags (spec §5.1). */
  cppExempt?: boolean;
  eiExempt?: boolean;
  qpipExempt?: boolean;
  /** Box 29 — employment code 11–17 (spec §5.1). */
  employmentCode?: number;
  /** Box 50 — RPP/DPSP registration number (spec §5.1). */
  rppRegistrationNumber?: string;

  // Aggregates for the year (employee amounts unless noted).
  /** Box 14. */
  employmentIncome: number;
  /** Non-QC employee CPP / CPP2 contributions (boxes 16 / 16A). */
  cpp?: number;
  cpp2?: number;
  /** QC employee QPP / QPP2 contributions (boxes 17 / 17A). */
  qpp?: number;
  qpp2?: number;
  /** Box 18. */
  ei?: number;
  /**
   * Box 55 — QPIP premiums. OPTIONAL because PayRunItem does not yet carry a
   * qpip column (Wave 1 schema PR): when absent, QPIP is UNKNOWN — the slip
   * reports 0 with a warning rather than pretending the premium was zero.
   */
  qpipPremiums?: number;
  /** Box 20. */
  rppContributions?: number;
  /** Box 44. */
  unionDues?: number;
  /** Box 46. */
  charitableDonations?: number;
  /** Box 52. */
  pensionAdjustment?: number;

  /** Federal income tax deducted for the year (see note above). */
  federalTax?: number;
  /** Provincial income tax deducted for the year (see note above). */
  provincialTax?: number;
  /** Legacy combined tax figure — see the warning behaviour documented above. */
  incomeTaxDeducted?: number;

  /** Box 24 — EI insurable earnings, ALREADY CAPPED by the engine. */
  eiInsurableEarnings?: number;
  /** Box 26 — CPP/QPP pensionable earnings, ALREADY CAPPED by the engine. */
  cppPensionableEarnings?: number;
  /** Box 56 — QPIP insurable earnings (QC). Optional for the same reason as qpipPremiums. */
  qpipInsurableEarnings?: number;

  // Employer amounts for this employee — needed for the summary's employer
  // totals (spec §6 <tot_empr_cpp_amt> etc.), which cannot be derived from
  // employee boxes. Non-QC CPP/CPP2 and EI only; QPP employer amounts are not
  // part of the T4 summary (spec §6 gap flag, confirmed in the 1-27-1 XSD).
  employerCpp?: number;
  employerCpp2?: number;
  employerEi?: number;

  /** Other-information amounts (spec §5.3); more than 6 needs a second slip. */
  otherInfo?: T4OtherInfoEntry[];
}

// ─── Output ──────────────────────────────────────────────────────────────────

export interface T4SlipAddress {
  line1?: string;
  line2?: string;
  city?: string;
  province?: string;
  countryCode?: string;
  postalCode?: string;
}

/**
 * A computed T4 slip: box amounts plus the identity/code fields the XML
 * serializer needs. Box fields are named after the printed T4 boxes.
 * Amount fields are always present (0 when not applicable) so totals are a
 * plain sum; the serializer decides which zero amounts to omit (spec §3:
 * optional elements with no value are omitted entirely).
 */
export interface T4Slip {
  surname: string;
  givenName: string;
  initial?: string;
  /** 9 digits; "000000000" when the employee did not provide a SIN (spec §5.1). */
  sin: string;
  employeeNumber?: string;
  address: T4SlipAddress;
  provinceOfEmployment: string;
  dentalBenefitsCode: number;
  /** Box 28 codes: 1 = exempt for the entire period, 0 = not (spec §5.1). */
  cppQppExemptCode: 0 | 1;
  eiExemptCode: 0 | 1;
  qpipExemptCode: 0 | 1;
  employmentCode?: number;
  rppRegistrationNumber?: string;

  box14: number; // Employment income
  box16: number; // Employee CPP contributions (non-QC only)
  box16A: number; // Employee CPP2 contributions (non-QC only)
  box17: number; // Employee QPP contributions (QC only)
  box17A: number; // Employee QPP2 contributions (QC only)
  box18: number; // Employee EI premiums
  box20: number; // RPP contributions
  box22: number; // Income tax deducted (QC: federal only)
  box24: number; // EI insurable earnings (capped input, never gross)
  box26: number; // CPP/QPP pensionable earnings (capped input, never gross)
  box44: number; // Union dues
  box46: number; // Charitable donations
  box52: number; // Pension adjustment
  box55: number; // QPIP premiums (QC; 0 + warning when unknown)
  box56: number; // QPIP insurable earnings (QC; 0 + warning when unknown)

  employerCpp: number;
  employerCpp2: number;
  employerEi: number;

  otherInfo: T4OtherInfoEntry[];
  /** Non-fatal data problems the filer must see before submitting. */
  warnings: string[];
}

/** Summary totals for one payroll account (spec §6). */
export interface T4SummaryTotals {
  slipCount: number;
  /** <tot_empt_incamt> — sum of box 14. */
  totalEmploymentIncome: number;
  /** <tot_empe_cpp_amt> — sum of box 16; EXCLUDES QPP by construction. */
  totalEmployeeCpp: number;
  /** <tot_empe_cppe_amt> — sum of box 16A; excludes QPP2 by construction. */
  totalEmployeeCpp2: number;
  /** <tot_empe_eip_amt> — sum of box 18. */
  totalEmployeeEi: number;
  /** <tot_rpp_cntrb_amt> — sum of box 20. */
  totalRppContributions: number;
  /** <tot_itx_ddct_amt> — sum of box 22. */
  totalIncomeTaxDeducted: number;
  /** <tot_padj_amt> — sum of box 52. */
  totalPensionAdjustment: number;
  /** <tot_empr_cpp_amt> — employer CPP (from per-slip employer amounts). */
  totalEmployerCpp: number;
  /** <tot_empr_cppe_amt> — employer CPP2. */
  totalEmployerCpp2: number;
  /** <tot_empr_eip_amt> — employer EI. */
  totalEmployerEi: number;
  /**
   * Informational only — NOT emitted in <T4_TAMT>: the 1-27-1 XSD (like the
   * spec §6 excerpt) has no QPP/QPP2/QPIP summary elements, and QPP must not
   * be folded into the CPP totals. Kept here so the UI can show QC amounts
   * that are reported through Revenu Québec channels instead.
   */
  totalEmployeeQpp: number;
  totalEmployeeQpp2: number;
  totalQpipPremiums: number;
}

// ─── Validation ──────────────────────────────────────────────────────────────

const KNOWN_PROVINCES_OF_EMPLOYMENT = new Set([
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
  "US", "ZZ",
]);

/**
 * Money inputs must be finite and non-negative. A negative amount means the
 * aggregation upstream is corrupted; that must be LOUD (throw), never
 * silently clamped — a clamped slip would file wrong numbers to CRA.
 */
function moneyField(data: T4EmployeeYearData, field: keyof T4EmployeeYearData): number {
  const v = data[field];
  if (v === undefined || v === null) return 0;
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(`T4: ${String(field)} must be a finite number, got ${String(v)}`);
  }
  if (v < 0) {
    throw new Error(`T4: ${String(field)} must not be negative, got ${v}`);
  }
  return v;
}

// ─── Slip computation ────────────────────────────────────────────────────────

export function computeT4Slip(data: T4EmployeeYearData): T4Slip {
  const warnings: string[] = [];
  const provinceOfEmployment = (data.provinceOfEmployment ?? "").trim().toUpperCase();
  if (!provinceOfEmployment) {
    throw new Error("T4: provinceOfEmployment is required (box 10)");
  }
  if (!KNOWN_PROVINCES_OF_EMPLOYMENT.has(provinceOfEmployment)) {
    warnings.push(
      `Province of employment "${provinceOfEmployment}" is not a recognised code (spec §5.1); the slip was computed with it as given.`,
    );
  }
  const isQuebec = provinceOfEmployment === "QC";

  const dentalBenefitsCode = data.dentalBenefitsCode ?? 1;
  if (!Number.isInteger(dentalBenefitsCode) || dentalBenefitsCode < 1 || dentalBenefitsCode > 5) {
    throw new Error(`T4: dentalBenefitsCode (box 45) must be an integer 1–5, got ${dentalBenefitsCode}`);
  }
  if (data.employmentCode !== undefined) {
    if (!Number.isInteger(data.employmentCode) || data.employmentCode < 11 || data.employmentCode > 17) {
      throw new Error(`T4: employmentCode (box 29) must be an integer 11–17, got ${data.employmentCode}`);
    }
  }

  // Read every money field through the guard (throws on negative / non-finite).
  const employmentIncome = moneyField(data, "employmentIncome");
  const cppIn = moneyField(data, "cpp");
  const cpp2In = moneyField(data, "cpp2");
  const qppIn = moneyField(data, "qpp");
  const qpp2In = moneyField(data, "qpp2");
  const eiIn = moneyField(data, "ei");
  const rppContributions = moneyField(data, "rppContributions");
  const unionDues = moneyField(data, "unionDues");
  const charitableDonations = moneyField(data, "charitableDonations");
  const pensionAdjustment = moneyField(data, "pensionAdjustment");
  const employerCpp = moneyField(data, "employerCpp");
  const employerCpp2 = moneyField(data, "employerCpp2");
  const employerEi = moneyField(data, "employerEi");
  // Optional capped / QPIP fields: distinguish "absent" from 0.
  const eiInsurableIn = data.eiInsurableEarnings;
  const cppPensionableIn = data.cppPensionableEarnings;
  const qpipPremiumsIn = data.qpipPremiums;
  const qpipInsurableIn = data.qpipInsurableEarnings;
  for (const [field, v] of [
    ["eiInsurableEarnings", eiInsurableIn],
    ["cppPensionableEarnings", cppPensionableIn],
    ["qpipPremiums", qpipPremiumsIn],
    ["qpipInsurableEarnings", qpipInsurableIn],
  ] as const) {
    if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v) || v < 0)) {
      throw new Error(`T4: ${field} must be a finite, non-negative number, got ${String(v)}`);
    }
  }
  const otherInfo = (data.otherInfo ?? []).map((e) => {
    if (!Number.isFinite(e.amount) || e.amount < 0) {
      throw new Error(`T4: other-info code ${e.code} amount must be finite and non-negative, got ${e.amount}`);
    }
    return { code: e.code, amount: round2(e.amount) };
  });
  if (otherInfo.length > 6) {
    warnings.push(
      `Slip has ${otherInfo.length} other-information entries; CRA allows at most 6 per slip (spec §5.3) — the overflow must go on an additional slip.`,
    );
  }

  // ── CPP vs QPP separation (spec §5.2: never mix on one slip) ──
  // A slip is per province of employment. QC slips report QPP in boxes
  // 17/17A and CPP boxes stay 0; all other provinces the reverse. Amounts
  // supplied for the wrong plan are NOT moved or merged — they indicate the
  // employee worked in two provinces and needs a separate slip per province.
  let box16 = 0;
  let box16A = 0;
  let box17 = 0;
  let box17A = 0;
  if (isQuebec) {
    box17 = qppIn;
    box17A = qpp2In;
    if (cppIn > 0 || cpp2In > 0) {
      warnings.push(
        "CPP/CPP2 contributions were supplied for a Québec employee; they are not reported on this slip (CPP and QPP are never mixed — spec §5.2). A separate slip is required for any non-Québec province of employment.",
      );
    }
  } else {
    box16 = cppIn;
    box16A = cpp2In;
    if (qppIn > 0 || qpp2In > 0) {
      warnings.push(
        "QPP/QPP2 contributions were supplied for a non-Québec employee; they are not reported on this slip (CPP and QPP are never mixed — spec §5.2). A separate Québec slip is required.",
      );
    }
  }

  // ── Box 22 — income tax deducted (spec §5.2) ──
  // Federal + provincial combined, EXCEPT Québec provincial tax, which is
  // reported on the RL-1 only. Callers pass the two taxes separately.
  let box22: number;
  const hasSeparateTax =
    data.federalTax !== undefined || data.provincialTax !== undefined;
  if (hasSeparateTax) {
    const federalTax = moneyField(data, "federalTax");
    const provincialTax = moneyField(data, "provincialTax");
    box22 = isQuebec ? federalTax : federalTax + provincialTax;
    if (data.incomeTaxDeducted !== undefined) {
      warnings.push(
        "Both separate federal/provincial tax and a combined incomeTaxDeducted figure were supplied; the separate figures were used and the combined figure ignored.",
      );
    }
  } else if (data.incomeTaxDeducted !== undefined) {
    box22 = moneyField(data, "incomeTaxDeducted");
    if (isQuebec) {
      warnings.push(
        "Box 22 was computed from a COMBINED income-tax figure for a Québec employee. Québec provincial tax must be excluded from box 22 (it belongs on the RL-1 — spec §5.2), so this box is likely overstated. Supply federalTax and provincialTax separately.",
      );
    }
  } else {
    box22 = 0;
  }

  // ── Boxes 24 / 26 — capped earnings, NEVER gross (spec §5.2, §8) ──
  // Exempt employees report 0.00 (spec §5.2). Missing capped inputs report
  // 0.00 plus a warning — the old gross-pay fallback must not come back.
  let box24: number;
  if (data.eiExempt) {
    box24 = 0;
    if (eiInsurableIn !== undefined && eiInsurableIn > 0) {
      warnings.push("EI-insurable earnings were supplied for an EI-exempt employee; box 24 reports 0.00 (spec §5.2).");
    }
  } else if (eiInsurableIn === undefined) {
    box24 = 0;
    warnings.push(
      "EI insurable earnings (box 24) were not supplied; box 24 reports 0.00. Supply the engine-capped insurable total — gross pay must not be substituted.",
    );
  } else {
    box24 = eiInsurableIn;
  }

  let box26: number;
  if (data.cppExempt) {
    box26 = 0;
    if (cppPensionableIn !== undefined && cppPensionableIn > 0) {
      warnings.push("CPP pensionable earnings were supplied for a CPP/QPP-exempt employee; box 26 reports 0.00 (spec §5.2).");
    }
  } else if (cppPensionableIn === undefined) {
    box26 = 0;
    warnings.push(
      "CPP/QPP pensionable earnings (box 26) were not supplied; box 26 reports 0.00. Supply the engine-capped pensionable total — gross pay must not be substituted.",
    );
  } else {
    box26 = cppPensionableIn;
  }

  // ── Boxes 55 / 56 — QPIP (QC only) ──
  // qpip values are optional in the input until PayRunItem gains qpip
  // columns; absent means UNKNOWN, which is reported as 0 + warning.
  let box55 = 0;
  let box56 = 0;
  if (isQuebec) {
    if (data.qpipExempt) {
      box55 = 0;
      box56 = 0;
      if ((qpipPremiumsIn ?? 0) > 0 || (qpipInsurableIn ?? 0) > 0) {
        warnings.push("QPIP amounts were supplied for a QPIP-exempt employee; boxes 55/56 report 0.");
      }
    } else {
      if (qpipPremiumsIn === undefined) {
        warnings.push(
          "QPIP premiums (box 55) are unknown — no qpip amount was supplied for this Québec employee; box 55 reports 0. Do not file until QPIP is captured.",
        );
      } else {
        box55 = qpipPremiumsIn;
      }
      if (qpipInsurableIn === undefined) {
        warnings.push(
          "QPIP insurable earnings (box 56) are unknown — no qpip insurable total was supplied for this Québec employee; box 56 reports 0. Do not file until QPIP is captured.",
        );
      } else {
        box56 = qpipInsurableIn;
      }
    }
  } else if ((qpipPremiumsIn ?? 0) > 0 || (qpipInsurableIn ?? 0) > 0) {
    warnings.push("QPIP amounts were supplied for a non-Québec employee; boxes 55/56 apply to Québec only and were left at 0.");
  }

  // ── SIN (spec §5.1) ──
  let sin = "000000000";
  if (data.sin === null || data.sin.trim() === "") {
    warnings.push(
      "Employee SIN was not provided; the slip carries 000000000 (spec §5.1). CPP contributions for this employee will not register with CRA.",
    );
  } else {
    const digits = data.sin.replace(/\D/g, "");
    if (digits.length !== 9) {
      warnings.push(`Employee SIN "${data.sin}" does not reduce to 9 digits; it is carried on the slip as supplied (digits only).`);
    }
    sin = digits;
  }

  return {
    surname: data.surname,
    givenName: data.givenName,
    initial: data.initial,
    sin,
    employeeNumber: data.employeeNumber,
    address: {
      line1: data.addressLine1,
      line2: data.addressLine2,
      city: data.city,
      province: data.provinceOfResidence?.trim().toUpperCase(),
      countryCode: (data.countryCode ?? "CAN").trim().toUpperCase(),
      postalCode: data.postalCode,
    },
    provinceOfEmployment,
    dentalBenefitsCode,
    cppQppExemptCode: data.cppExempt ? 1 : 0,
    eiExemptCode: data.eiExempt ? 1 : 0,
    qpipExemptCode: data.qpipExempt ? 1 : 0,
    employmentCode: data.employmentCode,
    rppRegistrationNumber: data.rppRegistrationNumber,

    box14: round2(employmentIncome),
    box16: round2(box16),
    box16A: round2(box16A),
    box17: round2(box17),
    box17A: round2(box17A),
    box18: round2(eiIn),
    box20: round2(rppContributions),
    box22: round2(box22),
    box24: round2(box24),
    box26: round2(box26),
    box44: round2(unionDues),
    box46: round2(charitableDonations),
    box52: round2(pensionAdjustment),
    box55: round2(box55),
    box56: round2(box56),

    employerCpp: round2(employerCpp),
    employerCpp2: round2(employerCpp2),
    employerEi: round2(employerEi),

    otherInfo,
    warnings,
  };
}

// ─── Summary ─────────────────────────────────────────────────────────────────

/**
 * T4 summary totals for one payroll account (spec §6).
 *
 * The CPP totals exclude QPP *by construction*: on a QC slip boxes 16/16A
 * are always 0 (QPP lives in 17/17A), so summing boxes can never fold QPP
 * into CPP. Employer totals come from the per-slip employer amounts — they
 * are not derivable from employee boxes (employer EI is 1.4×, CPP matching
 * has exceptions), so slips built without them understate the summary.
 */
export function computeT4Summary(slips: readonly T4Slip[]): T4SummaryTotals {
  const sum = (pick: (s: T4Slip) => number) => round2(slips.reduce((acc, s) => acc + pick(s), 0));
  return {
    slipCount: slips.length,
    totalEmploymentIncome: sum((s) => s.box14),
    totalEmployeeCpp: sum((s) => s.box16),
    totalEmployeeCpp2: sum((s) => s.box16A),
    totalEmployeeEi: sum((s) => s.box18),
    totalRppContributions: sum((s) => s.box20),
    totalIncomeTaxDeducted: sum((s) => s.box22),
    totalPensionAdjustment: sum((s) => s.box52),
    totalEmployerCpp: sum((s) => s.employerCpp),
    totalEmployerCpp2: sum((s) => s.employerCpp2),
    totalEmployerEi: sum((s) => s.employerEi),
    totalEmployeeQpp: sum((s) => s.box17),
    totalEmployeeQpp2: sum((s) => s.box17A),
    totalQpipPremiums: sum((s) => s.box55),
  };
}
