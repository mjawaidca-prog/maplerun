/**
 * CRA T4 XML serializer — pure module (string in, string out; no DB, no I/O).
 *
 * Governing spec: ~/workspace/nexvar-pay-versatility/specs/cra-t4-xml.md,
 * §3 (document structure + XML mechanics), §4 (T619), §5 (slip elements),
 * §6 (summary). Element names, required/optional status, and formats were
 * verified against CRA's schema package xmlschm1-27-1 (T619_T4.xsd, t4.xsd,
 * complex.xsd, simple.xsd; version 1.27) on 2026-11-02 — where the spec
 * summary and the XSD disagree, the XSD wins and the difference is noted
 * inline.
 *
 * HARD RULES (spec §3):
 *  - Omit empty optional elements ENTIRELY. An empty optional tag is the
 *    single most common IFT rejection; this serializer never emits
 *    `<tag/>` or `<tag></tag>` for an absent value.
 *  - Escape & < > ' " in text content.
 *  - Amounts: decimal point, exactly 2 decimals, no commas, no spaces.
 *  - Exactly one <T619>, one <Return><T4>, slips first, then exactly one
 *    <T4Summary>; <bn> on every slip equals the summary <bn> (the 1-27-1
 *    XSD enforces this with a key/keyref); summ_cnt = number of summaries.
 */

import { randomInt } from "node:crypto";
import { round2, type T4Slip, type T4SummaryTotals } from "./t4-boxes";

// ─── Input types ─────────────────────────────────────────────────────────────

export interface T4XmlContact {
  name: string;
  /** 3-digit telephone area code. */
  areaCode: string;
  /** Local number, "555-1234" or "5551234" (formatted to ###-####). */
  phone: string;
  ext?: string;
  /**
   * Contact email. REQUIRED in the T619 <CNTC> (TransmitterContactType in
   * the 1-27-1 XSD has cntc_email_area as a required element). The summary
   * <CNTC> (ContactType2) has NO email element, so an email supplied for
   * the employer contact is accepted here but not emitted there.
   */
  email?: string;
}

export interface T4Transmitter {
  /** 15-char business number (9 digits + program id + 4 digits) → <bn15>. */
  accountNumber15?: string;
  /** 7-char Represent a Client ID → <TransmitterRepID>/<RepID>. */
  repId?: string;
  /** 8 alpha chars, unique per submission (spec §4). Generated if omitted. */
  submissionRefId?: string;
  language: "E" | "F";
  name1: string;
  /**
   * Second transmitter name line. NOTE: in the 1-27-1 XSD, TransmitterName
   * is Line1Type — it has ONLY <l1_nm> (max 35 chars); there is no <l2_nm>
   * element, despite the spec §4 table listing one. To stay schema-valid,
   * name2 is appended to name1 (space-joined) and the result truncated to
   * 35 chars, rather than emitted as an element CRA would reject.
   */
  name2?: string;
  /** ISO 3166 alpha-3, e.g. "CAN". */
  countryCode: string;
  contact: T4XmlContact;
}

export interface T4XmlAddress {
  line1?: string;
  line2?: string;
  city?: string;
  province?: string;
  countryCode?: string;
  postalCode?: string;
}

export interface T4Employer {
  /** 15-char payroll account number: 9 digits + "RP" + 4 digits (spec §5.1). */
  bn15: string;
  name1: string;
  name2?: string;
  /** "Care of" line → <l3_nm> (spec §6). */
  name3?: string;
  address?: T4XmlAddress;
  contact: T4XmlContact;
  /** Proprietor SINs (spec §6) — optional since the 2026V4 spec; omitted unless supplied. */
  proprietorSin1?: string;
  proprietorSin2?: string;
}

export interface T4XmlOptions {
  /** Slip/summary report type code. Only originals are supported for now. */
  reportType?: "O";
  /**
   * Whether to emit the box 29 employment code element <empt_cd>.
   *
   * DEFAULT: false (OFF).
   *
   * Why: spec §2/§5.1 flag a vendor release note (Feb 2026) saying CRA
   * removed <empt_cd> from the T4 file in the 2027V1 specification.
   * Emitting a removed element fails validation; omitting an optional one
   * is always safe — so omission is the default. (Checked 2026-11-02:
   * t4.xsd inside xmlschm1-27-1 still lists <empt_cd> as OPTIONAL
   * (minOccurs=0, range 11–17), so enabling this option is also
   * schema-valid against 1-27-1; turn it on only after confirming the
   * filing-season spec for the year being filed.)
   *
   * NOTE: the box-14 suppression for employment codes 11/12/13/17 (spec
   * §5.1: do not complete box 14 for those codes) applies whenever a slip
   * carries an employment code, whether or not the element is emitted.
   */
  includeEmploymentCode?: boolean;
}

export interface T4SubmissionInput {
  transmitter: T4Transmitter;
  employer: T4Employer;
  taxYear: number;
  slips: T4Slip[];
  summary: T4SummaryTotals;
  options?: T4XmlOptions;
}

// ─── Submission reference ID (spec §4: 8 alpha, unique per submission) ──────

const REF_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function generateSubmissionRefId(): string {
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += REF_ID_ALPHABET[randomInt(REF_ID_ALPHABET.length)];
  }
  return id;
}

// ─── XML primitives ──────────────────────────────────────────────────────────

/** Escape the five XML special characters (spec §3). `&` must go first. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;")
    .replace(/"/g, "&quot;");
}

/** Format a money amount per spec §3: decimal point, 2 decimals, no commas. */
export function formatAmount(n: number): string {
  if (!Number.isFinite(n)) {
    throw new Error(`T4 XML: amount must be finite, got ${n}`);
  }
  return round2(n).toFixed(2);
}

/**
 * Emit `<tag>value</tag>`, or NOTHING when the value is absent/blank —
 * the omit-empty-optional rule (spec §3) lives here so it cannot be
 * bypassed by a call site.
 */
function el(tag: string, value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  const text = String(value);
  if (text.trim() === "") return "";
  return `<${tag}>${escapeXml(text)}</${tag}>`;
}

/** Emit an amount element only when the amount is non-zero (optional boxes). */
function amtEl(tag: string, amount: number): string {
  return round2(amount) === 0 ? "" : el(tag, formatAmount(amount));
}

/** Emit an amount element unconditionally (schema-required boxes 24/26). */
function reqAmtEl(tag: string, amount: number): string {
  return el(tag, formatAmount(amount));
}

// ─── Small format helpers ────────────────────────────────────────────────────

/** phoneType in the XSD is \d{3}-\d{4}; normalise a 7-digit local number. */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (/^\d{3}-\d{4}$/.test(phone.trim())) return phone.trim();
  throw new Error(`T4 XML: phone "${phone}" must be a 7-digit local number (area code is separate)`);
}

function formatAreaCode(areaCode: string): string {
  const digits = areaCode.replace(/\D/g, "");
  if (digits.length !== 3) {
    throw new Error(`T4 XML: area code "${areaCode}" must be 3 digits`);
  }
  return digits;
}

function validateBn15(bn: string, what: string): string {
  const v = bn.replace(/\s/g, "");
  if (!/^\d{9}[A-Za-z]{2}\d{4}$/.test(v)) {
    throw new Error(`T4 XML: ${what} "${bn}" is not a 15-char business number (9 digits + program id + 4 digits)`);
  }
  return v;
}

// ─── Address block (shared by slip <EMPE_ADDR> and summary <EMPR_ADDR>) ─────

function addressXml(addr: T4XmlAddress | undefined): string {
  if (!addr) return "";
  const inner =
    el("addr_l1_txt", addr.line1) +
    el("addr_l2_txt", addr.line2) +
    el("cty_nm", addr.city) +
    el("prov_cd", addr.province) +
    el("cntry_cd", addr.countryCode) +
    el("pstl_cd", addr.postalCode);
  return inner === "" ? "" : inner;
}

function wrapAddress(tag: string, addr: T4XmlAddress | undefined): string {
  const inner = addressXml(addr);
  return inner === "" ? "" : `<${tag}>${inner}</${tag}>`;
}

// ─── Other information (spec §5.3) ───────────────────────────────────────────

/**
 * Printed T4 other-information code → XML element. Only codes whose element
 * mapping is unambiguous in the 1-27-1 XSD are supported. The security-option
 * codes (38/39/41) were renamed/segmented across recent spec versions (spec
 * §5.3 flags this), so they are deliberately NOT guessed here — the
 * serializer throws rather than emit a possibly-wrong element.
 */
const OTHER_INFO_ELEMENTS: Readonly<Record<number, string>> = {
  30: "hm_brd_lodg_amt", // Housing, board and lodging
  31: "spcl_wrk_site_amt", // Special work site
  32: "prscb_zn_trvl_amt", // Travel in a prescribed zone
  33: "med_trvl_amt", // Medical travel
  34: "prsnl_vhcl_amt", // Personal use of employer's automobile
  36: "low_int_loan_amt", // Interest-free / low-interest loan benefit
  37: "empe_hm_loan_amt", // Employee home-relocation loan deduction
  40: "oth_tx_ben_amt", // Other taxable allowances and benefits
  42: "empt_cmsn_amt", // Employment commissions
  43: "cfppa_amt", // Canadian Forces / police deduction
  66: "elg_rtir_amt", // Eligible retiring allowances
  67: "nelg_rtir_amt", // Non-eligible retiring allowances
  74: "pr_90_cntrbr_amt", // Pre-1990 past-service RPP (contributor)
  75: "pr_90_ncntrbr_amt", // Pre-1990 past-service RPP (non-contributor)
  85: "epaid_hlth_pln_amt", // Employee-paid private health premiums
};

/** Employment codes for which box 14 must NOT be completed (spec §5.1). */
const NO_BOX14_EMPLOYMENT_CODES = new Set([11, 12, 13, 17]);

// ─── Slip ────────────────────────────────────────────────────────────────────

function slipXml(slip: T4Slip, bn: string, reportType: string, includeEmploymentCode: boolean): string {
  const name =
    `<EMPE_NM>` +
    el("snm", slip.surname) +
    el("gvn_nm", slip.givenName) +
    el("init", slip.initial) +
    `</EMPE_NM>`;

  const amounts =
    `<T4_AMT>` +
    // Box 14 — suppressed entirely for employment codes 11/12/13/17 (spec §5.1).
    (slip.employmentCode !== undefined && NO_BOX14_EMPLOYMENT_CODES.has(slip.employmentCode)
      ? ""
      : amtEl("empt_incamt", slip.box14)) +
    amtEl("cpp_cntrb_amt", slip.box16) + // Box 16 (0 on QC slips → omitted)
    amtEl("cppe_cntrb_amt", slip.box16A) + // Box 16A
    amtEl("qpp_cntrb_amt", slip.box17) + // Box 17 (0 on non-QC slips → omitted)
    amtEl("qppe_cntrb_amt", slip.box17A) + // Box 17A
    amtEl("empe_eip_amt", slip.box18) + // Box 18
    amtEl("rpp_cntrb_amt", slip.box20) + // Box 20
    amtEl("itx_ddct_amt", slip.box22) + // Box 22
    reqAmtEl("ei_insu_ern_amt", slip.box24) + // Box 24 — REQUIRED (spec §5.2: 0.00 if none)
    reqAmtEl("cpp_qpp_ern_amt", slip.box26) + // Box 26 — REQUIRED (spec §5.2: 0.00 if none)
    amtEl("unn_dues_amt", slip.box44) + // Box 44
    amtEl("chrty_dons_amt", slip.box46) + // Box 46
    amtEl("padj_amt", slip.box52) + // Box 52
    amtEl("prov_pip_amt", slip.box55) + // Box 55
    amtEl("prov_insu_ern_amt", slip.box56) + // Box 56
    `</T4_AMT>`;

  let otherInfo = "";
  if (slip.otherInfo.length > 0) {
    if (slip.otherInfo.length > 6) {
      // Spec §5.3: overflow goes on an additional slip — a caller bug here.
      throw new Error(
        `T4 XML: slip for ${slip.surname} has ${slip.otherInfo.length} other-information entries; CRA allows at most 6 per slip (spec §5.3) — issue an additional slip for the overflow.`,
      );
    }
    const entries = slip.otherInfo
      .map((entry) => {
        const tag = OTHER_INFO_ELEMENTS[entry.code];
        if (!tag) {
          throw new Error(
            `T4 XML: other-information code ${entry.code} has no unambiguous element mapping in the 1-27-1 XSD and is not supported (see OTHER_INFO_ELEMENTS).`,
          );
        }
        return amtEl(tag, entry.amount) || el(tag, formatAmount(entry.amount));
      })
      .join("");
    otherInfo = `<OTH_INFO>${entries}</OTH_INFO>`;
  }

  return (
    `<T4Slip>` +
    name +
    wrapAddress("EMPE_ADDR", slip.address) +
    el("sin", slip.sin) +
    el("empe_nbr", slip.employeeNumber) +
    el("bn", bn) + // Box 54 — must equal the summary <bn> (spec §3/§5.1)
    el("rpp_dpsp_rgst_nbr", slip.rppRegistrationNumber) + // Box 50
    el("cpp_qpp_xmpt_cd", slip.cppQppExemptCode) + // Box 28
    el("ei_xmpt_cd", slip.eiExemptCode) + // Box 28
    // PPIP exemption exists only for Québec employment (element is optional).
    (slip.provinceOfEmployment === "QC" ? el("prov_pip_xmpt_cd", slip.qpipExemptCode) : "") +
    // Box 29 — opt-in only; see T4XmlOptions.includeEmploymentCode.
    (includeEmploymentCode ? el("empt_cd", slip.employmentCode) : "") +
    el("rpt_tcd", reportType) +
    el("empt_prov_cd", slip.provinceOfEmployment) + // Box 10
    el("empr_dntl_ben_rpt_cd", slip.dentalBenefitsCode) + // Box 45 — mandatory (spec §5.1)
    amounts +
    otherInfo +
    `</T4Slip>`
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function summaryXml(input: T4SubmissionInput, bn: string, reportType: string): string {
  const { employer, summary, taxYear } = input;

  const name =
    `<EMPR_NM>` +
    el("l1_nm", employer.name1) +
    el("l2_nm", employer.name2) +
    el("l3_nm", employer.name3) +
    `</EMPR_NM>`;

  // Summary <CNTC> is ContactType2 in the XSD: name/area/phone/ext, NO email.
  const contact =
    `<CNTC>` +
    el("cntc_nm", employer.contact.name) +
    el("cntc_area_cd", formatAreaCode(employer.contact.areaCode)) +
    el("cntc_phn_nbr", formatPhone(employer.contact.phone)) +
    el("cntc_extn_nbr", employer.contact.ext) +
    `</CNTC>`;

  const proprietor =
    employer.proprietorSin1 || employer.proprietorSin2
      ? `<PPRTR_SIN>` +
        el("pprtr_1_sin", employer.proprietorSin1) +
        el("pprtr_2_sin", employer.proprietorSin2) +
        `</PPRTR_SIN>`
      : "";

  // <T4_TAMT> totals (spec §6). Zero totals are omitted (optional elements);
  // QPP/QPP2/QPIP totals are NOT emitted — no such elements exist in the
  // 1-27-1 XSD, and QPP must never be folded into the CPP totals.
  const totalsBody =
    amtEl("tot_empt_incamt", summary.totalEmploymentIncome) +
    amtEl("tot_empe_cpp_amt", summary.totalEmployeeCpp) +
    amtEl("tot_empe_cppe_amt", summary.totalEmployeeCpp2) +
    amtEl("tot_empe_eip_amt", summary.totalEmployeeEi) +
    amtEl("tot_rpp_cntrb_amt", summary.totalRppContributions) +
    amtEl("tot_itx_ddct_amt", summary.totalIncomeTaxDeducted) +
    amtEl("tot_padj_amt", summary.totalPensionAdjustment) +
    amtEl("tot_empr_cpp_amt", summary.totalEmployerCpp) +
    amtEl("tot_empr_cppe_amt", summary.totalEmployerCpp2) +
    amtEl("tot_empr_eip_amt", summary.totalEmployerEi);
  const totals = totalsBody === "" ? "" : `<T4_TAMT>${totalsBody}</T4_TAMT>`;

  return (
    `<T4Summary>` +
    el("bn", bn) +
    name +
    wrapAddress("EMPR_ADDR", employer.address) +
    contact +
    el("tx_yr", taxYear) +
    el("slp_cnt", summary.slipCount) +
    proprietor +
    el("rpt_tcd", reportType) +
    // <fileramendmentnote> is amendment-only (spec §6) — never for originals.
    totals +
    `</T4Summary>`
  );
}

// ─── T619 transmittal (spec §4) ──────────────────────────────────────────────

function t619Xml(transmitter: T4Transmitter, submissionRefId: string): string {
  if (!transmitter.accountNumber15 && !transmitter.repId) {
    throw new Error("T4 XML: transmitter needs accountNumber15 (bn15) or repId (spec §4)");
  }
  if (!transmitter.contact.email) {
    // cntc_email_area is a REQUIRED element of the T619 contact type in the
    // 1-27-1 XSD — a submission without it cannot validate.
    throw new Error("T4 XML: transmitter contact email is required (T619 <cntc_email_area>)");
  }

  const account = transmitter.accountNumber15
    ? `<TransmitterAccountNumber>${el("bn15", validateBn15(transmitter.accountNumber15, "transmitter account number"))}</TransmitterAccountNumber>`
    : "";
  const repId = transmitter.repId
    ? `<TransmitterRepID>${el("RepID", transmitter.repId)}</TransmitterRepID>`
    : "";

  // Line1Type: only <l1_nm>, max 35 chars (see T4Transmitter.name2 note).
  const transmitterName = [transmitter.name1, transmitter.name2]
    .filter((s): s is string => !!s && s.trim() !== "")
    .join(" ")
    .slice(0, 35);

  const contact =
    `<CNTC>` +
    el("cntc_nm", transmitter.contact.name) +
    el("cntc_area_cd", formatAreaCode(transmitter.contact.areaCode)) +
    el("cntc_phn_nbr", formatPhone(transmitter.contact.phone)) +
    el("cntc_extn_nbr", transmitter.contact.ext) +
    el("cntc_email_area", transmitter.contact.email) +
    `</CNTC>`;

  return (
    `<T619>` +
    account +
    repId +
    el("sbmt_ref_id", submissionRefId) +
    el("summ_cnt", 1) + // Exactly one T4 summary in this submission (spec §4)
    el("lang_cd", transmitter.language) +
    `<TransmitterName>${el("l1_nm", transmitterName)}</TransmitterName>` +
    el("TransmitterCountryCode", transmitter.countryCode) +
    contact +
    `</T619>`
  );
}

// ─── Submission ──────────────────────────────────────────────────────────────

/**
 * Serialize a complete T4 submission (spec §3):
 *   <?xml …?><Submission><T619/><Return><T4><T4Slip/>…<T4Summary/></T4></Return></Submission>
 */
export function buildT4Xml(input: T4SubmissionInput): string {
  const reportType = input.options?.reportType ?? "O";
  const includeEmploymentCode = input.options?.includeEmploymentCode ?? false;

  if (input.slips.length === 0) {
    throw new Error("T4 XML: at least one slip is required");
  }
  if (input.summary.slipCount !== input.slips.length) {
    throw new Error(
      `T4 XML: summary slipCount (${input.summary.slipCount}) does not match the number of slips (${input.slips.length}) — rebuild the summary with computeT4Summary.`,
    );
  }

  // Slip/summary <bn> is the employer's RP payroll account (bnRPType in the
  // XSD: 9 digits + RP + 4 digits) and must be identical on every slip and
  // the summary — one shared value here makes mismatch impossible.
  const bn = validateBn15(input.employer.bn15, "employer payroll account number");
  if (!/^\d{9}RP\d{4}$/i.test(bn)) {
    throw new Error(`T4 XML: employer bn "${input.employer.bn15}" must be an RP payroll account (9 digits + RP + 4 digits)`);
  }

  const submissionRefId = input.transmitter.submissionRefId ?? generateSubmissionRefId();
  if (!/^[A-Za-z]{8}$/.test(submissionRefId)) {
    throw new Error(`T4 XML: submissionRefId must be exactly 8 alpha characters (spec §4), got "${submissionRefId}"`);
  }

  const slips = input.slips.map((s) => slipXml(s, bn, reportType, includeEmploymentCode)).join("");
  const summary = summaryXml(input, bn, reportType);

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Submission xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    t619Xml(input.transmitter, submissionRefId) +
    `<Return><T4>${slips}${summary}</T4></Return>` +
    `</Submission>`
  );
}
