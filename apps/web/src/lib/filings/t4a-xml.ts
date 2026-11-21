/**
 * CRA T4A XML serializer — pure module (string in, string out; no DB, no I/O).
 *
 * The T4A counterpart of lib/filings/t4-xml.ts, following the same hard
 * rules (omit empty optional elements entirely; escape & < > ' "; amounts
 * with decimal point and exactly 2 decimals; exactly one <T619>, one
 * <Return><T4A>, slips first, then exactly one <T4ASummary>; <bn> on every
 * slip equals the summary <bn> — the 1-27-1 XSD enforces this with a
 * key/keyref).
 *
 * Sources: CRA schema package xmlschm1-27-1 (T619_T4A.xsd + t4a.xsd,
 * version 1.27) and CRA's official T4A XML specification page (2026V2).
 * Where the two could differ, the XSD wins (house rule from t4-xml.ts).
 * Notable CRA facts encoded here:
 *   - The payer <bn> is the RP payroll account (bnRPType in t4a.xsd; the
 *     T4A spec page: "enter the Account Number as used on Form PD7A").
 *     T4A is NOT filed under an RZ account in the XML schema.
 *   - <sin> and <rcpnt_bn> are REQUIRED on every slip; CRA prescribes
 *     zero placeholders (000000000 / 000000000RC0000) — computeT4aSlip
 *     has already applied them, so this serializer always has values.
 *   - Recipient info (RCPNT_NM) and corporation info (RCPNT_CORP_NM) are
 *     mutually exclusive (T4A spec page note).
 *   - The summary <CNTC> is ContactType2: name/area/phone/ext, NO email.
 *   - Filing output is BLOCKED when the summary does not tie to the
 *     slips: buildT4aXml runs validateT4aSummary and throws with the
 *     discrepancy list rather than emitting a file CRA would reject.
 */

import { round2 } from "./t4-boxes";
import {
  buildT619Xml,
  escapeXml,
  formatAmount,
  generateSubmissionRefId,
  type T4Transmitter,
  type T4XmlAddress,
  type T4XmlContact,
} from "./t4-xml";
import {
  T4A_BOX_BY_CODE,
  computeT4aSummary,
  validateT4aSummary,
  type T4aSlip,
  type T4aSummaryTotals,
} from "./t4a-boxes";

export { escapeXml, formatAmount, generateSubmissionRefId };

// ─── Input types ─────────────────────────────────────────────────────────────

export interface T4aPayer {
  /**
   * 15-char RP payroll account number: 9 digits + "RP" + 4 digits
   * (t4a.xsd bnRPType; T4A spec <bn>). Emitted on every slip and the
   * summary — one shared value makes mismatch impossible.
   */
  bn15: string;
  name1: string;
  name2?: string;
  /** "Care of" line → <l3_nm>. */
  name3?: string;
  address?: T4XmlAddress;
  contact: T4XmlContact;
  /** Proprietor SINs — optional; omitted unless supplied. */
  proprietorSin1?: string;
  proprietorSin2?: string;
  /** Up to three RPP registration numbers (summary <RPP_NBR>). */
  rppRegistrationNumbers?: string[];
}

export interface T4aXmlOptions {
  /** Slip/summary report type code. Only originals are supported for now. */
  reportType?: "O";
}

export interface T4aSubmissionInput {
  transmitter: T4Transmitter;
  payer: T4aPayer;
  taxYear: number;
  slips: T4aSlip[];
  summary: T4aSummaryTotals;
  options?: T4aXmlOptions;
}

// ─── XML primitives (same conventions as t4-xml.ts) ──────────────────────────

/** Emit `<tag>value</tag>`, or NOTHING when the value is absent/blank. */
function el(tag: string, value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  const text = String(value);
  if (text.trim() === "") return "";
  return `<${tag}>${escapeXml(text)}</${tag}>`;
}

/** Emit an amount element only when the amount is non-zero. */
function amtEl(tag: string, amount: number): string {
  return round2(amount) === 0 ? "" : el(tag, formatAmount(amount));
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (/^\d{3}-\d{4}$/.test(phone.trim())) return phone.trim();
  throw new Error(`T4A XML: phone "${phone}" must be a 7-digit local number (area code is separate)`);
}

function formatAreaCode(areaCode: string): string {
  const digits = areaCode.replace(/\D/g, "");
  if (digits.length !== 3) {
    throw new Error(`T4A XML: area code "${areaCode}" must be 3 digits`);
  }
  return digits;
}

/**
 * The payer <bn>: bnRPType in t4a.xsd — 9 digits + RP + 4 digits. (The
 * generic validateBn15 in t4-xml.ts accepts any program account; the T4A
 * schema does not, so the RP check lives here.)
 */
function validatePayerBn(bn: string): string {
  const v = bn.replace(/\s/g, "").toUpperCase();
  if (!/^\d{9}RP\d{4}$/.test(v)) {
    throw new Error(
      `T4A XML: payer bn "${bn}" must be an RP payroll account number (9 digits + RP + 4 digits) — t4a.xsd types <bn> as bnRPType.`,
    );
  }
  return v;
}

// ─── Address block (RCPNT_ADDR / PAYR_ADDR — CanadaAddressType) ─────────────

function addressXml(addr: T4XmlAddress | undefined): string {
  if (!addr) return "";
  return (
    el("addr_l1_txt", addr.line1) +
    el("addr_l2_txt", addr.line2) +
    el("cty_nm", addr.city) +
    el("prov_cd", addr.province) +
    el("cntry_cd", addr.countryCode) +
    el("pstl_cd", addr.postalCode)
  );
}

function wrapAddress(tag: string, addr: T4XmlAddress | undefined): string {
  const inner = addressXml(addr);
  return inner === "" ? "" : `<${tag}>${inner}</${tag}>`;
}

// ─── Slip ────────────────────────────────────────────────────────────────────

function slipXml(slip: T4aSlip, bn: string, reportType: string): string {
  // Recipient information XOR corporation information (CRA T4A spec).
  let name = "";
  if (slip.payeeType === "BUSINESS") {
    const corp =
      el("l1_nm", slip.businessName) + el("l2_nm", slip.businessName2);
    name = corp === "" ? "" : `<RCPNT_CORP_NM>${corp}</RCPNT_CORP_NM>`;
  } else {
    name =
      `<RCPNT_NM>` +
      el("snm", slip.surname) +
      el("gvn_nm", slip.givenName) +
      el("init", slip.initial) +
      `</RCPNT_NM>`;
  }

  // <T4A_AMT> — omitted entirely when the slip carries only
  // other-information amounts (the element is optional in t4a.xsd).
  const amtBody =
    amtEl("pens_spran_amt", slip.box016) + // Box 016
    amtEl("lsp_amt", slip.box018) + // Box 018
    amtEl("self_empl_cmsn_amt", slip.box020) + // Box 020
    amtEl("itx_ddct_amt", slip.box022) + // Box 022
    amtEl("annty_amt", slip.box024) + // Box 024
    amtEl("fee_or_oth_srvc_amt", slip.box048); // Box 048
  const amounts = amtBody === "" ? "" : `<T4A_AMT>${amtBody}</T4A_AMT>`;

  // <OTH_INFO> — at most 12 entries per slip (CRA T4A spec); duplicate
  // codes are impossible by construction (computeT4aSlip sums per code).
  let otherInfo = "";
  if (slip.otherInfo.length > 0) {
    if (slip.otherInfo.length > 12) {
      throw new Error(
        `T4A XML: slip for ${slip.surname ?? slip.businessName ?? "payee"} has ${slip.otherInfo.length} other-information entries; CRA allows at most 12 per slip — issue an additional slip for the overflow.`,
      );
    }
    const entries = slip.otherInfo
      .map((entry) => {
        const def = T4A_BOX_BY_CODE.get(entry.code);
        if (!def || def.kind !== "OTH") {
          throw new Error(
            `T4A XML: other-information code ${entry.code} has no element mapping in t4a.xsd via the T4A catalogue (see T4A_BOXES) and is not supported.`,
          );
        }
        return amtEl(def.xmlElement, entry.amount) || el(def.xmlElement, formatAmount(entry.amount));
      })
      .join("");
    otherInfo = `<OTH_INFO>${entries}</OTH_INFO>`;
  }

  return (
    `<T4ASlip>` +
    name +
    el("sin", slip.sin) + // Box 012 — REQUIRED (placeholder applied upstream)
    el("rcpnt_bn", slip.recipientBn) + // Box 013 — REQUIRED (placeholder applied upstream)
    wrapAddress("RCPNT_ADDR", slip.address) +
    el("rcpnt_nbr", slip.recipientNumber) + // Code 014
    el("bn", bn) + // Box 061 — must equal the summary <bn>
    el("payr_dntl_ben_rpt_cd", slip.dentalBenefitsCode) + // Box 015
    el("ppln_dpsp_rgst_nbr", slip.rppRegistrationNumber) + // Code 036
    el("rpt_tcd", reportType) +
    amounts +
    otherInfo +
    `</T4ASlip>`
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function summaryXml(input: T4aSubmissionInput, bn: string, reportType: string): string {
  const { payer, summary, taxYear } = input;

  const name =
    `<PAYR_NM>` +
    el("l1_nm", payer.name1) +
    el("l2_nm", payer.name2) +
    el("l3_nm", payer.name3) +
    `</PAYR_NM>`;

  // Summary <CNTC> is ContactType2 in the XSD: name/area/phone/ext, NO email.
  const contact =
    `<CNTC>` +
    el("cntc_nm", payer.contact.name) +
    el("cntc_area_cd", formatAreaCode(payer.contact.areaCode)) +
    el("cntc_phn_nbr", formatPhone(payer.contact.phone)) +
    el("cntc_extn_nbr", payer.contact.ext) +
    `</CNTC>`;

  const rppNumbers = (payer.rppRegistrationNumbers ?? []).filter(
    (n) => n && n.trim() !== "",
  );
  if (rppNumbers.length > 3) {
    throw new Error(`T4A XML: at most 3 RPP registration numbers fit the summary <RPP_NBR>, got ${rppNumbers.length}`);
  }
  const rpp =
    rppNumbers.length === 0
      ? ""
      : `<RPP_NBR>` +
        el("rpp_rgst_1_nbr", rppNumbers[0]) +
        el("rpp_rgst_2_nbr", rppNumbers[1]) +
        el("rpp_rgst_3_nbr", rppNumbers[2]) +
        `</RPP_NBR>`;

  const proprietor =
    payer.proprietorSin1 || payer.proprietorSin2
      ? `<PPRTR_SIN>` +
        el("pprtr_1_sin", payer.proprietorSin1) +
        el("pprtr_2_sin", payer.proprietorSin2) +
        `</PPRTR_SIN>`
      : "";

  // <T4A_TAMT> totals (t4a.xsd T4aTotalsType). Zero totals are omitted
  // (optional elements); the wrapper is omitted when every total is zero.
  const totalsBody =
    amtEl("tot_pens_spran_amt", summary.totalPension) +
    amtEl("tot_lsp_amt", summary.totalLumpSum) +
    amtEl("tot_self_cmsn_amt", summary.totalSelfEmployedCommissions) +
    amtEl("tot_ptrng_aloc_amt", summary.totalPatronageAllocations) +
    amtEl("tot_past_srvc_amt", summary.totalPastService) +
    amtEl("tot_annty_incamt", summary.totalAnnuities) +
    amtEl("totr_incamt", summary.totalOtherIncome) +
    amtEl("tot_itx_dedn_amt", summary.totalIncomeTaxDeducted) +
    amtEl("tot_padj_amt", summary.totalPensionAdjustment) +
    amtEl("tot_resp_aip_amt", summary.totalRespAip) +
    amtEl("tot_resp_amt", summary.totalRespEap) +
    amtEl("rpt_tot_fee_srvc_amt", summary.totalFeesForServices) +
    amtEl("rpt_tot_oth_info_amt", summary.totalOtherInfoAmounts);
  const totals = totalsBody === "" ? "" : `<T4A_TAMT>${totalsBody}</T4A_TAMT>`;

  return (
    `<T4ASummary>` +
    el("bn", bn) +
    name +
    wrapAddress("PAYR_ADDR", payer.address) +
    contact +
    el("tx_yr", taxYear) +
    el("slp_cnt", summary.slipCount) +
    rpp +
    proprietor +
    el("rpt_tcd", reportType) +
    // <fileramendmentnote> is amendment-only — never for originals.
    totals +
    `</T4ASummary>`
  );
}

// ─── Submission ──────────────────────────────────────────────────────────────

/**
 * Serialize a complete T4A submission:
 *   <?xml …?><Submission><T619/><Return><T4A><T4ASlip/>…<T4ASummary/></T4A></Return></Submission>
 *
 * Throws — emitting nothing — when the summary does not tie to the slips
 * (validateT4aSummary), so a non-tying return can never reach CRA.
 */
export function buildT4aXml(input: T4aSubmissionInput): string {
  const reportType = input.options?.reportType ?? "O";

  if (input.slips.length === 0) {
    throw new Error("T4A XML: at least one slip is required");
  }
  const problems = validateT4aSummary(input.slips, input.summary);
  if (problems.length > 0) {
    throw new Error(
      `T4A XML: the summary does not tie to the slips — filing output is blocked until it does.\n- ${problems.join("\n- ")}`,
    );
  }
  // Defence in depth: the summary used is always the one computed from
  // these slips (validateT4aSummary has just proven input.summary equal).
  const summary = computeT4aSummary(input.slips);

  const bn = validatePayerBn(input.payer.bn15);

  const submissionRefId = input.transmitter.submissionRefId ?? generateSubmissionRefId();
  if (!/^[A-Za-z]{8}$/.test(submissionRefId)) {
    throw new Error(`T4A XML: submissionRefId must be exactly 8 alpha characters, got "${submissionRefId}"`);
  }

  const slips = input.slips.map((s) => slipXml(s, bn, reportType)).join("");
  const summaryXmlStr = summaryXml({ ...input, summary }, bn, reportType);

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Submission xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    buildT619Xml(input.transmitter, submissionRefId) +
    `<Return><T4A>${slips}${summaryXmlStr}</T4A></Return>` +
    `</Submission>`
  );
}
