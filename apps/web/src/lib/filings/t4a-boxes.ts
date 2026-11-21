/**
 * T4A box calculations — pure module (no DB, no I/O).
 *
 * The T4A counterpart of lib/filings/t4-boxes.ts, built for the
 * improvement plan Phase 1 item 7a. Sources, in precedence order:
 *   1. CRA's schema package xmlschm1-27-1 (t4a.xsd, version 1.27) —
 *      element names, required/optional status, and the summary totals
 *      structure (T4aTotalsType).
 *   2. CRA's official T4A XML specification page (2026V2, updated
 *      2025-10-28) — printed box/code number for every element, the
 *      zero-placeholder rules for <sin> and <rcpnt_bn>, the payer <bn>
 *      being the RP account, and the definition of the other-information
 *      total.
 *   3. Design: ~/workspace/ledgerpro/improvement-plan/DESIGN-TAX-DOMAIN.md
 *      §6.1.3 — payments are TAGGED with their T4A classification when
 *      recorded during the year; this module turns a payee's tagged
 *      payments for one calendar year into a slip.
 *
 * Filing model: a slip aggregates PayeePayment rows (lib/actions/t4a.ts
 * does the DB fetch and SIN decryption). Everything here is a pure
 * function of that input, exactly like the T4 module.
 */

import { round2 } from "./t4-boxes";

export { round2 };

// ─── Box catalogue ───────────────────────────────────────────────────────────

/**
 * Where a classification lives on the slip: "AMT" boxes sit in <T4A_AMT>;
 * "OTH" codes sit in <OTH_INFO> (the "Other information" area at the
 * bottom of the printed slip).
 */
export type T4aBoxKind = "AMT" | "OTH";

export interface T4aBoxDef {
  /** Printed T4A box / other-information code, zero-padded ("016", "048"). */
  code: string;
  /** Printed-slip label (CRA wording). */
  label: string;
  kind: T4aBoxKind;
  /** XML element inside <T4A_AMT> (AMT) or <OTH_INFO> (OTH) — t4a.xsd. */
  xmlElement: string;
  /**
   * Which T4aSummaryTotals field this code accumulates into. Codes with a
   * dedicated CRA summary total name it; OTH codes WITHOUT one accumulate
   * into "totalOtherInfoAmounts" (see the CRA definition on that field).
   * Null for box 022, which is withholding, not a payment classification.
   */
  summaryField: keyof T4aSummaryTotals | null;
}

/**
 * The classifications the payment tagging supports. Deliberately the
 * common T4A universe for a payroll product's non-employee payments —
 * every code here was verified against t4a.xsd (element exists) and the
 * CRA T4A XML spec page (printed code). CRA defines ~60 other-information
 * codes; the unimplemented ones (Indian Act exempt variants, COVID-era
 * codes, SPP/ALDA, …) are named gaps in PHASE1-T4A.md, and the serializer
 * rejects codes outside this catalogue rather than guessing an element.
 */
export const T4A_BOXES: readonly T4aBoxDef[] = [
  // <T4A_AMT> — the slip's main boxes.
  { code: "016", label: "Pension or superannuation", kind: "AMT", xmlElement: "pens_spran_amt", summaryField: "totalPension" },
  { code: "018", label: "Lump-sum payments", kind: "AMT", xmlElement: "lsp_amt", summaryField: "totalLumpSum" },
  { code: "020", label: "Self-employed commissions", kind: "AMT", xmlElement: "self_empl_cmsn_amt", summaryField: "totalSelfEmployedCommissions" },
  { code: "024", label: "Annuities", kind: "AMT", xmlElement: "annty_amt", summaryField: "totalAnnuities" },
  { code: "048", label: "Fees for services", kind: "AMT", xmlElement: "fee_or_oth_srvc_amt", summaryField: "totalFeesForServices" },
  // <OTH_INFO> — other-information codes WITH a dedicated summary total.
  { code: "028", label: "Other income", kind: "OTH", xmlElement: "oth_incamt", summaryField: "totalOtherIncome" },
  { code: "030", label: "Patronage allocations", kind: "OTH", xmlElement: "ptrng_aloc_amt", summaryField: "totalPatronageAllocations" },
  { code: "032", label: "RPP contributions (past service)", kind: "OTH", xmlElement: "rpp_past_srvc_amt", summaryField: "totalPastService" },
  { code: "034", label: "Pension adjustment", kind: "OTH", xmlElement: "padj_amt", summaryField: "totalPensionAdjustment" },
  { code: "040", label: "RESP accumulated income payments", kind: "OTH", xmlElement: "resp_aip_amt", summaryField: "totalRespAip" },
  { code: "042", label: "RESP educational assistance payments", kind: "OTH", xmlElement: "resp_educt_ast_amt", summaryField: "totalRespEap" },
  // <OTH_INFO> — other-information codes WITHOUT a dedicated summary
  // total; they accumulate into totalOtherInfoAmounts (CRA definition).
  { code: "046", label: "Charitable donations", kind: "OTH", xmlElement: "chrty_dons_amt", summaryField: "totalOtherInfoAmounts" },
  { code: "104", label: "Research grants", kind: "OTH", xmlElement: "rsch_grnt_amt", summaryField: "totalOtherInfoAmounts" },
  { code: "105", label: "Scholarships, fellowships, or bursaries", kind: "OTH", xmlElement: "brsy_amt", summaryField: "totalOtherInfoAmounts" },
  { code: "106", label: "Death benefits", kind: "OTH", xmlElement: "dth_ben_amt", summaryField: "totalOtherInfoAmounts" },
];

export const T4A_BOX_BY_CODE: ReadonlyMap<string, T4aBoxDef> = new Map(
  T4A_BOXES.map((b) => [b.code, b]),
);

export function isT4aBoxCode(code: string): boolean {
  return T4A_BOX_BY_CODE.has(code);
}

// ─── Input ───────────────────────────────────────────────────────────────────

/**
 * One tagged payment (a PayeePayment row, projected). `boxCode` is the
 * classification captured when the payment was recorded; `amount` is the
 * gross amount under that classification; `incomeTaxDeducted` is the tax
 * withheld from this payment (aggregates to slip box 022).
 */
export interface T4aPaymentTag {
  boxCode: string;
  amount: number;
  incomeTaxDeducted?: number;
}

/**
 * Aggregated data for one payee, one calendar year.
 *
 * `sin` is plaintext ONLY because the export action decrypts it
 * immediately before calling this module; never persist it (same rule as
 * T4EmployeeYearData).
 */
export interface T4aPayeeYearData {
  /** INDIVIDUAL → RCPNT_NM + SIN; BUSINESS → RCPNT_CORP_NM + BN. */
  payeeType: "INDIVIDUAL" | "BUSINESS";
  // Individual identity (RCPNT_NM).
  surname?: string;
  givenName?: string;
  /** Initial of the second given name, if any. */
  initial?: string;
  // Business identity (RCPNT_CORP_NM lines 1–2).
  businessName?: string;
  businessName2?: string;

  /** Box 012 — recipient SIN (individuals). */
  sin?: string | null;
  /** Box 013 — recipient business number, full BN15 (when they have one). */
  recipientBn?: string | null;
  /** Code 014 — recipient number (payer-side reference). */
  recipientNumber?: string;

  // Residence address (RCPNT_ADDR).
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  /** ISO 3166 alpha-3, default "CAN". */
  countryCode?: string;
  postalCode?: string;

  /**
   * Box 015 — payer-offered dental benefits code 1–5. Mandatory when the
   * slip reports box 016 (CRA T4A spec); when pension is present but no
   * code was recorded, the slip defaults to 1 WITH a warning.
   */
  dentalBenefitsCode?: number;
  /** Code 036 — RPP/DPSP registration number (7 digits). */
  rppRegistrationNumber?: string;

  /** The payee's tagged payments for the year. */
  payments: readonly T4aPaymentTag[];
}

// ─── Output ──────────────────────────────────────────────────────────────────

export interface T4aSlipAddress {
  line1?: string;
  line2?: string;
  city?: string;
  province?: string;
  countryCode?: string;
  postalCode?: string;
}

export interface T4aOtherInfoEntry {
  /** Printed other-information code ("028", "046", …). */
  code: string;
  amount: number;
}

/**
 * A computed T4A slip. Main-box fields are always present (0 when not
 * applicable) so summary totals are a plain sum; the serializer decides
 * which zero amounts to omit. Other-information amounts live in
 * `otherInfo`, unique by code (payments sharing a code are summed).
 */
export interface T4aSlip {
  payeeType: "INDIVIDUAL" | "BUSINESS";
  surname?: string;
  givenName?: string;
  initial?: string;
  businessName?: string;
  businessName2?: string;
  /** 9 digits; "000000000" for businesses and unprovided SINs (CRA rule). */
  sin: string;
  /** BN15; "000000000RC0000" when the recipient provided no BN (CRA rule). */
  recipientBn: string;
  recipientNumber?: string;
  address: T4aSlipAddress;
  dentalBenefitsCode?: number;
  rppRegistrationNumber?: string;

  box016: number; // Pension or superannuation
  box018: number; // Lump-sum payments
  box020: number; // Self-employed commissions
  box022: number; // Income tax deducted (sum of per-payment withholding)
  box024: number; // Annuities
  box048: number; // Fees for services

  otherInfo: T4aOtherInfoEntry[];
  /** How many tagged payments fed this slip (display/audit only). */
  paymentCount: number;
  /** Non-fatal data problems the filer must see before submitting. */
  warnings: string[];
}

/** Summary totals for one payer account (t4a.xsd T4aTotalsType). */
export interface T4aSummaryTotals {
  slipCount: number;
  /** <tot_pens_spran_amt> — sum of box 016. */
  totalPension: number;
  /** <tot_lsp_amt> — sum of box 018. */
  totalLumpSum: number;
  /** <tot_self_cmsn_amt> — sum of box 020. */
  totalSelfEmployedCommissions: number;
  /** <tot_ptrng_aloc_amt> — sum of code 030. */
  totalPatronageAllocations: number;
  /** <tot_past_srvc_amt> — sum of code 032. */
  totalPastService: number;
  /** <tot_annty_incamt> — sum of box 024. */
  totalAnnuities: number;
  /** <totr_incamt> — sum of code 028. */
  totalOtherIncome: number;
  /** <tot_itx_dedn_amt> — sum of box 022. */
  totalIncomeTaxDeducted: number;
  /** <tot_padj_amt> — sum of code 034. */
  totalPensionAdjustment: number;
  /** <tot_resp_aip_amt> — sum of code 040. */
  totalRespAip: number;
  /** <tot_resp_amt> — sum of code 042. */
  totalRespEap: number;
  /** <rpt_tot_fee_srvc_amt> — sum of box 048. */
  totalFeesForServices: number;
  /**
   * <rpt_tot_oth_info_amt> — CRA's definition (T4A XML spec): the total
   * of all other-information amounts EXCLUDING the codes that carry their
   * own summary total (028, 030, 032, 034, 040, 042) and the main boxes.
   * With the current catalogue that is codes 046 + 104 + 105 + 106.
   */
  totalOtherInfoAmounts: number;
}

// ─── Payment aggregation ─────────────────────────────────────────────────────

export interface T4aAggregatedPayments {
  /** Summed amount per catalogue code (only codes that occur). */
  amounts: ReadonlyMap<string, number>;
  /** Sum of per-payment withholding → slip box 022. */
  incomeTaxDeducted: number;
  paymentCount: number;
}

/**
 * Money inputs must be finite and non-negative. A negative amount means
 * the recorded data is corrupted; that must be LOUD (throw), never
 * silently clamped — a clamped slip would file wrong numbers to CRA.
 * (Same rule as t4-boxes.ts.)
 */
function moneyGuard(value: number, what: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`T4A: ${what} must be a finite number, got ${String(value)}`);
  }
  if (value < 0) {
    throw new Error(`T4A: ${what} must not be negative, got ${value}`);
  }
  return value;
}

/**
 * Aggregate one payee's tagged payments for a year into per-code amounts.
 * Unknown box codes throw: a payment tagged with a code outside the
 * catalogue means the recording path and this module disagree, and the
 * year-end report must fail loudly rather than drop money.
 */
export function aggregateT4aPayments(
  payments: readonly T4aPaymentTag[],
): T4aAggregatedPayments {
  const amounts = new Map<string, number>();
  let incomeTaxDeducted = 0;
  for (const p of payments) {
    const def = T4A_BOX_BY_CODE.get(p.boxCode);
    if (!def) {
      throw new Error(
        `T4A: payment box code "${p.boxCode}" is not in the T4A catalogue (see T4A_BOXES) — the payment was tagged with an unsupported classification.`,
      );
    }
    const amount = moneyGuard(p.amount, `payment amount (code ${p.boxCode})`);
    const tax = moneyGuard(p.incomeTaxDeducted ?? 0, `income tax deducted (code ${p.boxCode})`);
    amounts.set(def.code, round2((amounts.get(def.code) ?? 0) + amount));
    incomeTaxDeducted = round2(incomeTaxDeducted + tax);
  }
  return { amounts, incomeTaxDeducted, paymentCount: payments.length };
}

// ─── Slip computation ────────────────────────────────────────────────────────

/** CRA's prescribed zero placeholder for an unprovided recipient BN. */
export const T4A_ZERO_RECIPIENT_BN = "000000000RC0000";

export function computeT4aSlip(data: T4aPayeeYearData): T4aSlip {
  const warnings: string[] = [];
  if (data.payeeType !== "INDIVIDUAL" && data.payeeType !== "BUSINESS") {
    throw new Error(`T4A: payeeType must be INDIVIDUAL or BUSINESS, got ${String(data.payeeType)}`);
  }
  const isBusiness = data.payeeType === "BUSINESS";

  // ── Identity: recipient info XOR corporation info (CRA T4A spec) ──
  let surname: string | undefined;
  let givenName: string | undefined;
  let initial: string | undefined;
  let businessName: string | undefined;
  let businessName2: string | undefined;
  if (isBusiness) {
    businessName = data.businessName?.trim();
    if (!businessName) {
      throw new Error("T4A: businessName is required for a BUSINESS payee (RCPNT_CORP_NM)");
    }
    businessName2 = data.businessName2?.trim() || undefined;
    if (data.surname || data.givenName) {
      warnings.push(
        "Individual name parts were supplied for a BUSINESS payee; they are not reported (CRA: recipient information and corporation information are never both completed).",
      );
    }
  } else {
    surname = data.surname?.trim();
    if (!surname) {
      throw new Error("T4A: surname is required for an INDIVIDUAL payee (RCPNT_NM)");
    }
    givenName = data.givenName?.trim() || undefined;
    initial = data.initial?.trim().slice(0, 1).toUpperCase() || undefined;
    if (data.businessName) {
      warnings.push(
        "A business name was supplied for an INDIVIDUAL payee; it is not reported (CRA: recipient information and corporation information are never both completed).",
      );
    }
  }

  // ── SIN (box 012) ──
  // CRA: 9 numeric; where the recipient has not provided a SIN, or the
  // recipient is a corporation, the only acceptable value is all zeroes.
  let sin = "000000000";
  if (isBusiness) {
    if (data.sin && data.sin.replace(/\D/g, "") !== "" && data.sin.replace(/\D/g, "") !== "000000000") {
      warnings.push("A SIN was supplied for a BUSINESS payee; box 012 reports 000000000 (CRA: corporations report zeroes).");
    }
  } else if (data.sin === null || data.sin === undefined || data.sin.trim() === "") {
    warnings.push(
      "Recipient SIN was not provided; the slip carries 000000000 (CRA T4A spec). CPP contributions for this recipient will not register with CRA.",
    );
  } else {
    const digits = data.sin.replace(/\D/g, "");
    if (digits.length > 9) {
      throw new Error(`T4A: recipient SIN "${data.sin}" has ${digits.length} digits; a SIN is 9 digits.`);
    }
    if (digits.length !== 9) {
      warnings.push(`Recipient SIN "${data.sin}" does not reduce to 9 digits; it is carried on the slip as supplied (digits only).`);
    }
    sin = digits;
  }

  // ── Recipient BN (box 013) ──
  // CRA: full BN15 required to process; where the recipient has not
  // provided one, enter the zero placeholder 000000000RC0000.
  let recipientBn = T4A_ZERO_RECIPIENT_BN;
  if (data.recipientBn === null || data.recipientBn === undefined || data.recipientBn.trim() === "") {
    warnings.push(
      `Recipient business number was not provided; the slip carries ${T4A_ZERO_RECIPIENT_BN} (CRA T4A spec placeholder).`,
    );
  } else {
    const bn = data.recipientBn.replace(/\s/g, "").toUpperCase();
    if (!/^\d{9}[A-Z]{2}\d{4}$/.test(bn)) {
      throw new Error(`T4A: recipient business number "${data.recipientBn}" is not a BN15 (9 digits + 2 letters + 4 digits).`);
    }
    recipientBn = bn;
  }

  // ── Amounts ──
  const agg = aggregateT4aPayments(data.payments);
  const amt = (code: string) => agg.amounts.get(code) ?? 0;
  const box016 = round2(amt("016"));
  const box018 = round2(amt("018"));
  const box020 = round2(amt("020"));
  const box024 = round2(amt("024"));
  const box048 = round2(amt("048"));
  const box022 = round2(agg.incomeTaxDeducted);

  const otherInfo: T4aOtherInfoEntry[] = T4A_BOXES.filter((b) => b.kind === "OTH")
    .map((b) => ({ code: b.code, amount: round2(amt(b.code)) }))
    .filter((e) => e.amount !== 0);
  if (otherInfo.length > 12) {
    warnings.push(
      `Slip has ${otherInfo.length} other-information entries; CRA allows at most 12 per slip — the overflow must go on an additional slip.`,
    );
  }

  const totalPaid = round2(
    [...agg.amounts.values()].reduce((a, b) => a + b, 0),
  );
  if (box022 > totalPaid) {
    warnings.push(
      `Income tax deducted ($${box022.toFixed(2)}) exceeds the total payments on this slip ($${totalPaid.toFixed(2)}); check the per-payment withholding recorded during the year.`,
    );
  }

  // ── Box 015 dental code: mandatory when box 016 is reported ──
  let dentalBenefitsCode = data.dentalBenefitsCode;
  if (dentalBenefitsCode !== undefined) {
    if (!Number.isInteger(dentalBenefitsCode) || dentalBenefitsCode < 1 || dentalBenefitsCode > 5) {
      throw new Error(`T4A: dentalBenefitsCode (box 015) must be an integer 1–5, got ${dentalBenefitsCode}`);
    }
  } else if (box016 > 0) {
    dentalBenefitsCode = 1;
    warnings.push(
      "Box 016 (pension) is reported but no payer-offered dental benefits code (box 015) was recorded for this payee; box 015 defaults to 1 (not eligible). Record the real code on the payee before filing.",
    );
  }

  // ── Code 036 RPP/DPSP registration number: 7 digits (int7Type) ──
  let rppRegistrationNumber: string | undefined;
  if (data.rppRegistrationNumber !== undefined && data.rppRegistrationNumber.trim() !== "") {
    const digits = data.rppRegistrationNumber.replace(/\D/g, "");
    if (!/^\d{7}$/.test(digits)) {
      throw new Error(`T4A: rppRegistrationNumber (code 036) must be exactly 7 digits, got "${data.rppRegistrationNumber}"`);
    }
    rppRegistrationNumber = digits;
  }

  return {
    payeeType: data.payeeType,
    surname,
    givenName,
    initial,
    businessName,
    businessName2,
    sin,
    recipientBn,
    recipientNumber: data.recipientNumber?.trim() || undefined,
    address: {
      line1: data.addressLine1,
      line2: data.addressLine2,
      city: data.city,
      province: data.province?.trim().toUpperCase(),
      countryCode: (data.countryCode ?? "CAN").trim().toUpperCase(),
      postalCode: data.postalCode,
    },
    dentalBenefitsCode,
    rppRegistrationNumber,

    box016,
    box018,
    box020,
    box022,
    box024,
    box048,

    otherInfo,
    paymentCount: agg.paymentCount,
    warnings,
  };
}

// ─── Summary ─────────────────────────────────────────────────────────────────

/**
 * T4A summary totals for one payer account. Every total is a plain sum
 * over the slips, routed through the catalogue's summaryField mapping —
 * so a code can never be summed into the wrong total, and the
 * other-information total follows CRA's exclusion definition by
 * construction (only codes mapped to totalOtherInfoAmounts land there).
 */
export function computeT4aSummary(slips: readonly T4aSlip[]): T4aSummaryTotals {
  const totals: T4aSummaryTotals = {
    slipCount: slips.length,
    totalPension: 0,
    totalLumpSum: 0,
    totalSelfEmployedCommissions: 0,
    totalPatronageAllocations: 0,
    totalPastService: 0,
    totalAnnuities: 0,
    totalOtherIncome: 0,
    totalIncomeTaxDeducted: 0,
    totalPensionAdjustment: 0,
    totalRespAip: 0,
    totalRespEap: 0,
    totalFeesForServices: 0,
    totalOtherInfoAmounts: 0,
  };
  const add = (field: keyof T4aSummaryTotals, v: number) => {
    totals[field] = round2(totals[field] + v);
  };
  for (const slip of slips) {
    add("totalPension", slip.box016);
    add("totalLumpSum", slip.box018);
    add("totalSelfEmployedCommissions", slip.box020);
    add("totalAnnuities", slip.box024);
    add("totalFeesForServices", slip.box048);
    add("totalIncomeTaxDeducted", slip.box022);
    for (const entry of slip.otherInfo) {
      const def = T4A_BOX_BY_CODE.get(entry.code);
      if (!def || def.summaryField === null) {
        throw new Error(`T4A: other-information code "${entry.code}" has no summary mapping (see T4A_BOXES).`);
      }
      add(def.summaryField, entry.amount);
    }
  }
  return totals;
}

// ─── Tie-out validation ──────────────────────────────────────────────────────

/**
 * Verify a summary against the slips it claims to total. Returns a list
 * of human-readable discrepancies — EMPTY when the summary ties. The XML
 * serializer refuses to build a submission whose summary does not tie
 * (filing output is blocked), and the report page surfaces the same list.
 */
export function validateT4aSummary(
  slips: readonly T4aSlip[],
  summary: T4aSummaryTotals,
): string[] {
  const expected = computeT4aSummary(slips);
  const problems: string[] = [];
  const fields: [keyof T4aSummaryTotals, string][] = [
    ["slipCount", "slip count"],
    ["totalPension", "total pension or superannuation (016)"],
    ["totalLumpSum", "total lump-sum payments (018)"],
    ["totalSelfEmployedCommissions", "total self-employed commissions (020)"],
    ["totalPatronageAllocations", "total patronage allocations (030)"],
    ["totalPastService", "total RPP past-service contributions (032)"],
    ["totalAnnuities", "total annuities (024)"],
    ["totalOtherIncome", "total other income (028)"],
    ["totalIncomeTaxDeducted", "total income tax deducted (022)"],
    ["totalPensionAdjustment", "total pension adjustment (034)"],
    ["totalRespAip", "total RESP accumulated income payments (040)"],
    ["totalRespEap", "total RESP educational assistance payments (042)"],
    ["totalFeesForServices", "total fees for services (048)"],
    ["totalOtherInfoAmounts", "total other-information amounts"],
  ];
  for (const [field, label] of fields) {
    if (round2(summary[field]) !== round2(expected[field])) {
      problems.push(
        `Summary ${label} is ${summary[field]} but the slips total ${expected[field]} — rebuild the summary with computeT4aSummary.`,
      );
    }
  }
  return problems;
}
