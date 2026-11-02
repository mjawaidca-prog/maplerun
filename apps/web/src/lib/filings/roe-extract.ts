/**
 * ROE Web Payroll Extract XML serializer (pure module, no DB access).
 *
 * Builds the `.BLK` upload file defined by Service Canada / ESDC
 * "ROE Web user requirements" Appendix D (Payroll Extract XML, Version 2.0),
 * summarized in `specs/roe-web.md`. The employer uploads the file to ROE Web,
 * which creates draft (default) or submitted ROEs.
 *
 * Governing rules implemented here:
 *  - Appendix D §2 / spec §2: XML declaration is the FIRST line; dates are
 *    CCYY-MM-DD; postal codes carry no spaces; money is fixed 2 decimals
 *    with no currency symbol; file name is a ≤256-char alphanumeric prefix
 *    + ".BLK".
 *  - Appendix D §8.2.2–8.2.4 / spec §3: <ROEHEADER FileVersion="W-2.0"
 *    SoftwareVendor="Nexvar Lab Inc." ProductName="Nexvar Pay"> wrapping one
 *    <ROE PrintingLanguage Issue> per ROE, in the XSD element order
 *    (B2?, B3?, B5, B6, B8, B9, B10, B11, B12, B13?, B14, B15A, B15C, B16,
 *    B17A?, B17B?, B17C?, B18?, B19?, B20?). Absent optional blocks are
 *    omitted entirely.
 *  - There is NO <B15B> element: Block 15B is auto-calculated by ROE Web
 *    from 15C + insurable Block 17 amounts (Appendix D §8.3 note,
 *    Sept 18 2015; spec §4). Never emit one.
 *
 * Validation philosophy: ROE Web is the final validator, so business-rule
 * violations (Block 12 window, Block 5 first digit, Block 14 recall rules,
 * Block 15A sanity cap, …) are returned as WARNINGS. The serializer THROWS
 * only when the ROE is structurally unbuildable: no pay periods (PP1 is
 * mandatory), Block 16 code "K" without the mandatory Block 18 comment,
 * structurally-required vacation-pay fields missing, more other monies /
 * statutory holidays / special payments than the format allows, or a
 * malformed mandatory identifier/date.
 *
 * Code values: Block 16 / 17A / 17C / 19 XML codes were verified against
 * Appendix D Tables 16.1 / 17A.1 / 17C.1 / 19.1 (canada.ca, fetched
 * 2026-11-02) — these differ from the Appendix A online-entry codes in
 * spec §6–§7 (e.g. online "E" severance is XML "E00"; SUB plan payments
 * split into U12–U15). Where a caller supplies only the online-entry code
 * and the XML value cannot be derived unambiguously, this module throws
 * rather than inventing a value (see `toXmlOtherMoneyCode`).
 */

// ─── Input types ─────────────────────────────────────────────────────────────

export type RoePayPeriodType = "W" | "B" | "S" | "M" | "E" | "O" | "H";

export interface RoeContactInput {
  firstName: string;
  lastName: string;
  /** 3-digit area code (digits only; punctuation is stripped). */
  areaCode: string;
  /** 7-digit local number (punctuation stripped; a leading area code that
   *  duplicates `areaCode` is dropped). */
  phone: string;
  ext?: string;
}

export interface RoeEmployerInput {
  /** CRA payroll account number, 15-char BN + RP form, e.g. "123456789RP0001"
   *  (Appendix D Table 7, Block 5). "RW" is accepted for the ROE Web Demo
   *  environment. */
  payrollAccountNumber: string;
  /**
   * Employer short name, used ONLY for the .BLK file-name prefix (the XML
   * itself carries no employer name — ROE Web identifies the employer by
   * Block 5). Added to the prescribed input shape because Appendix D §2 /
   * Table 3 naming needs a prefix; defaults to "PAYROLL" when absent.
   */
  shortName?: string;
  contact: RoeContactInput;
}

export interface RoeEmployeeInput {
  /** 9-digit SIN (spaces/dashes are stripped). */
  sin: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  /** Address line 1 — number and street (Appendix D Table 7, Block 9 A1). */
  addressLine1: string;
  /** Address line 2 — city/municipality (A2). The XSD requires the A2
   *  element, so an empty <A2></A2> is emitted when this is absent. */
  addressLine2?: string;
  /** Address line 3 — province/country (A3, optional). */
  addressLine3?: string;
  postalCode: string;
  occupation?: string;
  /** Block 10 — first day worked, ISO date. */
  firstDayWorked: string;
  /** Block 11 — last day for which paid (LDFWP), ISO date. */
  lastDayForWhichPaid: string;
  /** Block 12 — final pay period ending date, ISO date. */
  finalPayPeriodEndingDate: string;
}

export interface RoePeriodInput {
  /** Pay period ending date, ISO date. */
  periodEnd: string;
  insurableHours: number;
  insurableEarnings: number;
}

export interface RoeVacationPayInput {
  /** Appendix D Table 17A.1 / spec §7. */
  cd: "1" | "2" | "3" | "4";
  startDate?: string;
  endDate?: string;
  amount?: number;
}

export interface RoeStatutoryHolidayInput {
  date: string;
  amount: number;
}

export interface RoeOtherMoneyInput {
  /**
   * Other-monies code: either the Appendix A online-entry code from
   * spec §7 (single letter, e.g. "E") or the full Appendix D Table 17C.1
   * XML code (e.g. "E00", "B05", "U12"). Single letters are expanded to
   * the "00" XML form; "B" (bonus) and "U" (SUB plan) have no default
   * subtype and must be given in full XML form.
   */
  cd: string;
  startDate?: string;
  endDate?: string;
  amount?: number;
}

export interface RoeSpecialPaymentInput {
  /** Appendix D Table 19.1 XML code: PSL01 | WLI01 | WLI02 | MAT01. */
  cd: string;
  startDate?: string;
  endDate?: string;
  amount: number;
  /** "D" = per day, "W" = per week. */
  period?: "D" | "W";
}

export interface RoeExtractInput {
  employer: RoeEmployerInput;
  employee: RoeEmployeeInput;
  /** Block 3 — employer payroll reference no. (≤26 chars), optional
   *  (Appendix D Table 7, Block 3; spec §4 suggests Nexvar's
   *  employee/pay-run reference). */
  payrollReferenceNumber?: string;
  payPeriodType: RoePayPeriodType;
  /** Per-period history in ANY order — sorted most-recent-first here. */
  periods: RoePeriodInput[];
  /**
   * Block 16 reason-for-separation code (Appendix A §6 / spec §6), either
   * the single letter ("E") or a full Appendix D Table 16.1 XML code
   * ("E02"). Combined with `reasonSubCode` when both are given.
   */
  reasonCode: string;
  /** Block 16 sub-reason: "02", "2", or a full XML code ("E02"). */
  reasonSubCode?: string;
  expectedRecall: { cd: "Y" | "N" | "U"; date?: string };
  vacationPay?: RoeVacationPayInput;
  /** Block 17B — max 10. */
  statutoryHolidays?: RoeStatutoryHolidayInput[];
  /** Block 17C — max 3. */
  otherMonies?: RoeOtherMoneyInput[];
  specialPayments?: RoeSpecialPaymentInput[];
  /** Block 18 — mandatory when `reasonCode` is "K". Max 160 chars. */
  comments?: string;
  /** Block 2 — issued ROE serial number, amendments/replacements only. */
  serialNumber?: string;
  /** Printing/communication language; default "E". */
  language?: "E" | "F";
  /**
   * "D" draft (default — the employer reviews in ROE Web before issuing)
   * or "S" submit (Appendix D §8.2.3 / spec §3).
   */
  issue?: "D" | "S";
}

export interface RoeExtractHeader {
  /** Nexvar Pay product version, ≤10 chars (Appendix D §8.2.2). */
  productVersion: string;
}

export interface RoeExtractResult {
  xml: string;
  filename: string;
  warnings: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Maximum pay periods reported in Blocks 15A/15C, by pay period type
 * (Appendix D Tables 15A.1 / 15C.1; Appendix A §5 / spec §5).
 */
export const ROE_MAX_PERIODS: Record<RoePayPeriodType, number> = {
  W: 53,
  B: 27,
  S: 25,
  E: 25,
  M: 13,
  O: 13,
  H: 14,
};

/** Block 15A absolute maximum: 53 weeks × 7 days × 24 h (Appendix A §5). */
const MAX_INSURABLE_HOURS = 8904;

/** Reason codes with which expected recall "Y" is forbidden (Appendix D
 *  Table 7, Block 14: E00/G00/M00 including all sub-codes). */
const RECALL_FORBIDDEN_REASONS = new Set(["E", "G", "M"]);

/** Other-monies codes whose amount is optional (Appendix D Table 17C.1). */
const OTHER_MONEY_OPTIONAL_AMOUNT = new Set(["U12", "U13", "U14", "U15"]);

// ─── Small helpers ───────────────────────────────────────────────────────────

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function el(tag: string, text: string): string {
  return `<${tag}>${escapeXml(text)}</${tag}>`;
}

/** Money: fixed 2 decimals, "." delimiter, no symbol (Appendix D §2). */
export function formatRoeMoney(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`ROE amount must be a finite number, got ${value}.`);
  }
  return (Math.round(value * 100) / 100).toFixed(2);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Normalize an ISO date/datetime to CCYY-MM-DD; throw when malformed. */
function normalizeDate(value: string, field: string): string {
  const date = value.slice(0, 10);
  if (!DATE_RE.test(date)) {
    throw new Error(`ROE ${field} must be an ISO date (CCYY-MM-DD), got "${value}".`);
  }
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() !== m - 1 ||
    parsed.getUTCDate() !== d
  ) {
    throw new Error(`ROE ${field} is not a real calendar date: "${value}".`);
  }
  return date;
}

function daysBetween(fromCcyyMmDd: string, toCcyyMmDd: string): number {
  return Math.round(
    (Date.parse(`${toCcyyMmDd}T00:00:00Z`) -
      Date.parse(`${fromCcyyMmDd}T00:00:00Z`)) /
      86_400_000,
  );
}

function isMonthEnd(ccyyMmDd: string): boolean {
  const [y, m, d] = ccyyMmDd.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate() === d;
}

function isFebruaryMonthEnd(ccyyMmDd: string): boolean {
  const [, m] = ccyyMmDd.split("-").map(Number) as [number, number, number];
  return m === 2 && isMonthEnd(ccyyMmDd);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Truncate to a format length cap, warning instead of silently cutting. */
function capLength(
  value: string,
  max: number,
  field: string,
  warnings: string[],
): string {
  if (value.length <= max) return value;
  warnings.push(
    `${field} exceeds the ${max}-character ROE Web limit and was truncated.`,
  );
  return value.slice(0, max);
}

// ─── Code composition ────────────────────────────────────────────────────────

/**
 * Compose the Block 16 XML CD (3 chars) from the online-entry reason code
 * and optional sub-reason (Appendix D Table 16.1, verified 2026-11-02:
 * A00/A01, E00/E02/E03/E04/E05/E06/E09/E10/E11, G00/G07, K00/K12–K17,
 * M00/M08, Z00, …). A bare letter defaults to the "00" base code.
 */
function composeReasonCd(reasonCode: string, reasonSubCode?: string): string {
  const base = reasonCode.trim().toUpperCase();
  if (reasonSubCode) {
    const sub = reasonSubCode.trim().toUpperCase();
    if (sub.length === 3) return sub; // already a full XML code, e.g. "E02"
    if (/^\d{1,2}$/.test(sub)) {
      // e.g. reasonCode "K" + sub "12" → "K12"
      return `${base.charAt(0)}${sub.padStart(2, "0")}`;
    }
    return sub;
  }
  if (base.length === 3) return base;
  if (base.length === 1) return `${base}00`;
  return base;
}

/**
 * Expand an other-monies code to its Appendix D Table 17C.1 XML form
 * ([A-Z][0-9]{2} per the XSD). Single letters map to the "00" code —
 * verified for E/G/H/I/J/O/Q/R/S/T/Y (Table 17C.1, fetched 2026-11-02).
 * "B" and "U" have NO "00" form (bonuses are B05–B11 by subtype; SUB plan
 * payments are U12–U15 by subtype), so the caller must supply the full
 * XML code.
 * // VERIFY vs Appendix D Table 7: the spec §7 online-entry codes do not
 * distinguish bonus/SUB subtypes — never guess one here.
 */
function toXmlOtherMoneyCode(cd: string): string {
  const code = cd.trim().toUpperCase();
  if (/^[A-Z]\d{2}$/.test(code)) return code;
  if (/^[A-Z]$/.test(code)) {
    if (code === "B" || code === "U") {
      throw new Error(
        `Block 17C other-monies code "${code}" has no default XML value: ` +
          `bonuses are B05–B11 and SUB plan payments are U12–U15 in ` +
          `Appendix D Table 17C.1 — supply the full XML code.`,
      );
    }
    return `${code}00`;
  }
  throw new Error(
    `Block 17C other-monies code "${cd}" is not a recognized code ` +
      `(expected a spec §7 letter or an Appendix D Table 17C.1 XML code).`,
  );
}

// ─── Block 12 window validation (warnings only) ──────────────────────────────

/**
 * Block 12 must fall in the type-specific window after Block 11
 * (Appendix D Table 7, Block 12; Appendix A §5 / spec §5). ROE Web is the
 * final validator, so violations are warnings, never throws.
 */
function checkFinalPeriodWindow(
  input: RoeExtractInput,
  b11: string,
  b12: string,
  warnings: string[],
): void {
  const diff = daysBetween(b11, b12);
  const type = input.payPeriodType;
  const prefix = "Block 12";
  if (diff < 0) {
    warnings.push(
      `${prefix}: final pay period ending date ${b12} is before the last day for which paid (Block 11) ${b11}.`,
    );
    return;
  }
  const dayOfMonth = Number(b12.slice(8, 10));
  const monthEnd = isMonthEnd(b12);
  const febMonthEnd = isFebruaryMonthEnd(b12);
  switch (type) {
    case "W":
      if (diff > 6)
        warnings.push(`${prefix}: ${b12} is ${diff} days after Block 11 for a weekly (W) ROE; the maximum is 6 days.`);
      break;
    case "B":
      if (diff > 13)
        warnings.push(`${prefix}: ${b12} is ${diff} days after Block 11 for a bi-weekly (B) ROE; the maximum is 13 days.`);
      break;
    case "S":
      if (diff > 15)
        warnings.push(`${prefix}: ${b12} is ${diff} days after Block 11 for a semi-monthly (S) ROE; the maximum is 15 days.`);
      if (dayOfMonth !== 15 && !monthEnd)
        warnings.push(`${prefix}: ${b12} is neither the 15th nor the last day of the month, as required for a semi-monthly (S) ROE.`);
      break;
    case "E":
      if (diff > 15)
        warnings.push(`${prefix}: ${b12} is ${diff} days after Block 11 for a non-standard semi-monthly (E) ROE; the maximum is 15 days.`);
      if ((dayOfMonth === 15 || monthEnd) && !febMonthEnd)
        warnings.push(`${prefix}: ${b12} is the 15th or the last day of the month, which a non-standard semi-monthly (E) ROE must not be (February month-end excepted).`);
      break;
    case "M":
      if (diff > 30)
        warnings.push(`${prefix}: ${b12} is ${diff} days after Block 11 for a monthly (M) ROE; the maximum is 30 days.`);
      if (!monthEnd)
        warnings.push(`${prefix}: ${b12} is not the last day of the month, as required for a monthly (M) ROE.`);
      break;
    case "O":
      if (diff > 30)
        warnings.push(`${prefix}: ${b12} is ${diff} days after Block 11 for a non-standard monthly (O) ROE; the maximum is 30 days.`);
      if (monthEnd && !febMonthEnd)
        warnings.push(`${prefix}: ${b12} is the last day of the month, which a non-standard monthly (O) ROE must not be (February month-end excepted).`);
      break;
    case "H":
      if (diff > 27)
        warnings.push(`${prefix}: ${b12} is ${diff} days after Block 11 for a 13-periods-per-year (H) ROE; the maximum is 27 days.`);
      break;
  }
}

// ─── Per-ROE serialization ───────────────────────────────────────────────────

function buildOneRoe(input: RoeExtractInput, warnings: string[]): string {
  const { employer, employee } = input;
  const lines: string[] = [];
  const language = input.language ?? "E";
  const issue = input.issue ?? "D"; // Appendix D §8.2.3: Nexvar default "D"
  lines.push(`<ROE PrintingLanguage="${language}" Issue="${issue}">`);

  // B2 — serial number, amendments/replacements only (Appendix D Table 7).
  if (input.serialNumber) {
    lines.push(el("B2", capLength(input.serialNumber.trim(), 9, "Block 2 serial number", warnings)));
  }

  // B3 — employer payroll reference number, optional, ≤26 chars.
  if (input.payrollReferenceNumber) {
    lines.push(el("B3", capLength(input.payrollReferenceNumber.trim(), 26, "Block 3 payroll reference number", warnings)));
  }

  // B5 — CRA payroll account number (Appendix D Table 7, Block 5).
  const bn = employer.payrollAccountNumber.replace(/\s/g, "").toUpperCase();
  if (!/^\d{9}R[PW]\d{4}$/.test(bn)) {
    throw new Error(
      `Block 5 payroll account number must be 15 characters (9-digit BN + RP + 4 digits), got "${employer.payrollAccountNumber}".`,
    );
  }
  if (!["1", "7", "8"].includes(bn.charAt(0))) {
    // Appendix A §5: BN first digit must be 1, 7, or 8 — warning only.
    warnings.push(
      `Block 5: payroll account number ${bn} starts with "${bn.charAt(0)}"; the first digit of a business number must be 1, 7, or 8.`,
    );
  }
  lines.push(el("B5", bn));

  // B6 — pay period type.
  lines.push(el("B6", input.payPeriodType));

  // B8 — SIN (Appendix D Table 7, Block 8: 9 digits, not all zeros).
  const sin = digitsOnly(employee.sin);
  if (!/^\d{9}$/.test(sin) || sin === "000000000") {
    throw new Error(`Block 8 SIN must be 9 digits and not 000000000, got "${employee.sin}".`);
  }
  if (sin === bn.slice(0, 9)) {
    warnings.push("Block 8: the employee SIN equals the employer's business number digits, which ROE Web rejects.");
  }
  lines.push(el("B8", sin));

  // B9 — employee name & address (Appendix D Table 7, Block 9).
  const b9: string[] = ["<B9>"];
  b9.push(el("FN", capLength(employee.firstName, 20, "Block 9 first name", warnings)));
  if (employee.middleInitial) {
    b9.push(el("MN", capLength(employee.middleInitial, 4, "Block 9 middle initial", warnings)));
  }
  b9.push(el("LN", capLength(employee.lastName, 28, "Block 9 last name", warnings)));
  b9.push(el("A1", capLength(employee.addressLine1, 35, "Block 9 address line 1", warnings)));
  // A2 is required by PayrollExtractXmlV2.xsd (minOccurs=1): emit it even
  // when empty rather than omitting the element.
  b9.push(el("A2", capLength(employee.addressLine2 ?? "", 35, "Block 9 address line 2", warnings)));
  if (employee.addressLine3) {
    b9.push(el("A3", capLength(employee.addressLine3, 35, "Block 9 address line 3", warnings)));
  }
  // Postal codes carry no spaces in the file (Appendix D §2 / spec §2).
  b9.push(el("PC", capLength(employee.postalCode.replace(/\s/g, "").toUpperCase(), 10, "Block 9 postal code", warnings)));
  b9.push("</B9>");
  lines.push(b9.join(""));

  // B10 / B11 / B12 — work & pay dates (CCYY-MM-DD).
  const b10 = normalizeDate(employee.firstDayWorked, "Block 10 first day worked");
  const b11 = normalizeDate(employee.lastDayForWhichPaid, "Block 11 last day for which paid");
  const b12 = normalizeDate(employee.finalPayPeriodEndingDate, "Block 12 final pay period ending date");
  lines.push(el("B10", b10));
  lines.push(el("B11", b11));
  lines.push(el("B12", b12));
  if (b11 < b10) {
    warnings.push(`Block 11 last day for which paid ${b11} is before Block 10 first day worked ${b10}.`);
  }
  checkFinalPeriodWindow(input, b11, b12, warnings);

  // B13 — occupation, optional, ≤40 chars.
  if (employee.occupation) {
    lines.push(el("B13", capLength(employee.occupation, 40, "Block 13 occupation", warnings)));
  }

  // Periods: sort most-recent-first, truncate to the type maximum
  // (Appendix D Tables 15A.1/15C.1; spec §5). PP1 = most recent period.
  if (input.periods.length === 0) {
    throw new Error(
      "Block 15C requires at least one pay period (PP1 is mandatory); no periods were supplied.",
    );
  }
  const sorted = input.periods
    .map((p) => ({
      periodEnd: normalizeDate(p.periodEnd, "Block 15C period end"),
      insurableHours: p.insurableHours,
      insurableEarnings: p.insurableEarnings,
    }))
    .sort((a, b) => (a.periodEnd < b.periodEnd ? 1 : a.periodEnd > b.periodEnd ? -1 : 0));
  const maxPeriods = ROE_MAX_PERIODS[input.payPeriodType];
  let reported = sorted;
  if (sorted.length > maxPeriods) {
    warnings.push(
      `Block 15C: ${sorted.length} periods supplied for pay period type ${input.payPeriodType}; ` +
        `truncated to the ${maxPeriods} most recent (Appendix D Table 15C.1).`,
    );
    reported = sorted.slice(0, maxPeriods);
  }
  const seenEnds = new Set<string>();
  for (const p of reported) {
    if (seenEnds.has(p.periodEnd)) {
      warnings.push(`Block 15C: duplicate period end date ${p.periodEnd} in the period history.`);
      break;
    }
    seenEnds.add(p.periodEnd);
  }

  // B14 — expected recall (Appendix D Table 7, Block 14; spec §5).
  const reasonBase = input.reasonCode.trim().toUpperCase().charAt(0);
  const b14: string[] = ["<B14>", el("CD", input.expectedRecall.cd)];
  if (input.expectedRecall.cd === "Y") {
    if (!input.expectedRecall.date) {
      warnings.push('Block 14: expected recall code "Y" requires an expected recall date; none was supplied.');
    } else {
      const recallDate = normalizeDate(input.expectedRecall.date, "Block 14 expected recall date");
      if (recallDate <= b11) {
        warnings.push(`Block 14: expected recall date ${recallDate} is not after the last day for which paid (Block 11) ${b11}.`);
      }
      b14.push(el("DT", recallDate));
    }
    if (RECALL_FORBIDDEN_REASONS.has(reasonBase)) {
      warnings.push(
        `Block 14: expected recall code "Y" is not allowed with Block 16 reason code "${reasonBase}" (quit / mandatory retirement / dismissal).`,
      );
    }
  } else if (input.expectedRecall.date) {
    // DT must be blank when CD is N or U — omit it and warn.
    warnings.push(`Block 14: an expected recall date was supplied with code "${input.expectedRecall.cd}"; the date applies only when the code is "Y" and was omitted.`);
  }
  b14.push("</B14>");
  lines.push(b14.join(""));

  // B15A — total insurable hours over the periods REPORTED in 15C:
  // whole hours only, decimals not permitted, round UP — i.e. ceil the
  // total (Appendix D Table 7, Block 15A; Appendix A §5 / spec §5).
  const totalHours = reported.reduce((s, p) => s + p.insurableHours, 0);
  const block15A = Math.ceil(totalHours);
  lines.push(el("B15A", String(block15A)));
  if (block15A < 1 || block15A > MAX_INSURABLE_HOURS) {
    warnings.push(`Block 15A: total insurable hours ${block15A} is outside the permitted range 1–${MAX_INSURABLE_HOURS}.`);
  }
  // Sanity cap (warning, NOT a clamp): 15A ≤ (B11 − B10 + 1 day) × 24.
  const capHours = (daysBetween(b10, b11) + 1) * 24;
  if (block15A > capHours) {
    warnings.push(
      `Block 15A: total insurable hours ${block15A} exceeds the maximum of ${capHours} for the period ` +
        `${b10} to ${b11} ((last day for which paid − first day worked + 1 day) × 24).`,
    );
  }

  // B15C — insurable earnings by pay period, most-recent-first.
  // NOTE: no <B15B> is emitted — ROE Web auto-calculates Block 15B.
  const b15c: string[] = ["<B15C>"];
  reported.forEach((p, i) => {
    if (p.insurableEarnings < 0) {
      throw new Error(
        `Block 15C period ending ${p.periodEnd} has negative insurable earnings (${p.insurableEarnings}).`,
      );
    }
    if (i === 0 && p.insurableEarnings < 1) {
      warnings.push(`Block 15C: PP1 insurable earnings ${formatRoeMoney(p.insurableEarnings)} is below the 1.00 minimum for the most recent period (Appendix D Table 7, Block 15C).`);
    }
    if (p.insurableEarnings > 9_999_999.99) {
      warnings.push(`Block 15C: period ending ${p.periodEnd} has insurable earnings above the 9,999,999.99 format maximum.`);
    }
    b15c.push(`<PP nbr="${i + 1}">${el("AMT", formatRoeMoney(p.insurableEarnings))}</PP>`);
  });
  b15c.push("</B15C>");
  lines.push(b15c.join(""));

  // B16 — reason for separation + issuer contact (Appendix D Table 7).
  const reasonCd = composeReasonCd(input.reasonCode, input.reasonSubCode);
  const contact = employer.contact;
  const telDigits = digitsOnly(contact.phone);
  const tel =
    telDigits.length === 10 && telDigits.startsWith(digitsOnly(contact.areaCode))
      ? telDigits.slice(3)
      : telDigits;
  const ac = digitsOnly(contact.areaCode);
  if (ac.length !== 3) {
    warnings.push(`Block 16: contact area code "${contact.areaCode}" is not 3 digits.`);
  }
  if (tel.length !== 7) {
    warnings.push(`Block 16: contact phone number "${contact.phone}" does not reduce to the required 7 digits.`);
  }
  const b16: string[] = ["<B16>"];
  b16.push(el("CD", reasonCd));
  b16.push(el("FN", capLength(contact.firstName, 20, "Block 16 contact first name", warnings)));
  b16.push(el("LN", capLength(contact.lastName, 28, "Block 16 contact last name", warnings)));
  b16.push(el("AC", ac));
  b16.push(el("TEL", tel));
  if (contact.ext) {
    b16.push(el("EXT", capLength(digitsOnly(contact.ext), 8, "Block 16 contact extension", warnings)));
  }
  b16.push("</B16>");
  lines.push(b16.join(""));

  // B17A — vacation pay (Appendix D Table 17A.1; spec §7). Judgement calls,
  // following the STRICTER of Appendix A (spec §7) and Appendix D where
  // they differ, and throwing for structurally-required fields:
  //  - CD "1" (included with each pay): SDT/EDT/AMT must all be blank —
  //    any supplied values are omitted.
  //  - CD "2": amount mandatory (throw if missing); dates must be blank —
  //    supplied dates are omitted with a warning.
  //  - CD "3": amount mandatory (throw); start AND end dates mandatory per
  //    Appendix A §7 (Appendix D Table 17A.1 marks them optional) — throw
  //    if either is missing.
  //  - CD "4": amount mandatory (throw); start date mandatory per
  //    Appendix A §7 — throw if missing; end date must be blank — a
  //    supplied end date is omitted with a warning.
  if (input.vacationPay) {
    const vp = input.vacationPay;
    const detail: string[] = [el("CD", vp.cd)];
    if (vp.cd === "1") {
      // Amount (and any dates) omitted entirely for "included with each pay".
    } else {
      if (vp.amount === undefined) {
        throw new Error(`Block 17A vacation pay code "${vp.cd}" requires an amount (Appendix D Table 17A.1).`);
      }
      if (vp.cd === "3") {
        if (!vp.startDate || !vp.endDate) {
          throw new Error(
            'Block 17A vacation pay code "3" (paid for a vacation leave period) requires both a start date and an end date.',
          );
        }
        detail.push(el("SDT", normalizeDate(vp.startDate, "Block 17A vacation start date")));
        detail.push(el("EDT", normalizeDate(vp.endDate, "Block 17A vacation end date")));
      } else if (vp.cd === "4") {
        if (!vp.startDate) {
          throw new Error('Block 17A vacation pay code "4" (anniversary / specific date) requires a start date.');
        }
        if (vp.endDate) {
          warnings.push('Block 17A: an end date was supplied for vacation pay code "4"; it must be blank and was omitted.');
        }
        detail.push(el("SDT", normalizeDate(vp.startDate, "Block 17A vacation start date")));
      } else if (vp.cd === "2" && (vp.startDate || vp.endDate)) {
        warnings.push('Block 17A: leave dates were supplied for vacation pay code "2"; they must be blank and were omitted.');
      }
      detail.push(el("AMT", formatRoeMoney(vp.amount)));
    }
    lines.push(`<B17A><VP nbr="1">${detail.join("")}</VP></B17A>`);
  }

  // B17B — statutory holiday pay, max 10 (Appendix D Table 7, Block 17B).
  if (input.statutoryHolidays && input.statutoryHolidays.length > 0) {
    if (input.statutoryHolidays.length > 10) {
      throw new Error(
        `Block 17B allows at most 10 statutory holidays; ${input.statutoryHolidays.length} were supplied.`,
      );
    }
    const entries = input.statutoryHolidays.map(
      (sh, i) =>
        `<SH nbr="${i + 1}">${el("DT", normalizeDate(sh.date, "Block 17B statutory holiday date"))}${el("AMT", formatRoeMoney(sh.amount))}</SH>`,
    );
    lines.push(`<B17B>${entries.join("")}</B17B>`);
  }

  // B17C — other monies, max 3 (Appendix D Table 7, Block 17C). More than
  // 3 is a hard error (throw) rather than a truncation: silently dropping
  // a separation payment would understate the ROE.
  if (input.otherMonies && input.otherMonies.length > 0) {
    if (input.otherMonies.length > 3) {
      throw new Error(
        `Block 17C allows at most 3 other monies entries; ${input.otherMonies.length} were supplied.`,
      );
    }
    const entries = input.otherMonies.map((om, i) => {
      const xmlCd = toXmlOtherMoneyCode(om.cd);
      const parts: string[] = [el("CD", xmlCd)];
      if (om.startDate) parts.push(el("SDT", normalizeDate(om.startDate, "Block 17C start date")));
      if (om.endDate) parts.push(el("EDT", normalizeDate(om.endDate, "Block 17C end date")));
      if (om.amount !== undefined) {
        parts.push(el("AMT", formatRoeMoney(om.amount)));
      } else if (!OTHER_MONEY_OPTIONAL_AMOUNT.has(xmlCd)) {
        warnings.push(`Block 17C: other monies code "${xmlCd}" normally requires an amount; none was supplied.`);
      }
      return `<OM nbr="${i + 1}">${parts.join("")}</OM>`;
    });
    lines.push(`<B17C>${entries.join("")}</B17C>`);
  }

  // B18 — comments. Mandatory when Block 16 code is "K" (including the
  // K15 sub-code) — an ROE with K and no comment is invalid, so throw
  // (Appendix D Table 7, Block 18; spec §6).
  const comments = input.comments?.trim();
  if (reasonBase === "K" && !comments) {
    throw new Error(
      'Block 18 comments are mandatory when Block 16 reason code is "K" (Other); none were supplied.',
    );
  }
  if (comments) {
    lines.push(el("B18", capLength(comments, 160, "Block 18 comments", warnings)));
  }

  // B19 — special payments, max 4, one per type (Appendix D Table 7,
  // Block 19; codes per Table 19.1: PSL01/WLI01/WLI02/MAT01).
  if (input.specialPayments && input.specialPayments.length > 0) {
    if (input.specialPayments.length > 4) {
      throw new Error(
        `Block 19 allows at most 4 special payment entries; ${input.specialPayments.length} were supplied.`,
      );
    }
    const entries = input.specialPayments.map((sp) => {
      const parts: string[] = [];
      if (sp.startDate) parts.push(el("SDT", normalizeDate(sp.startDate, "Block 19 special payment start date")));
      if (sp.endDate) parts.push(el("EDT", normalizeDate(sp.endDate, "Block 19 special payment end date")));
      parts.push(el("AMT", formatRoeMoney(sp.amount)));
      if (sp.period) parts.push(el("PRD", sp.period));
      return `<SP cd="${escapeXml(sp.cd.trim().toUpperCase())}">${parts.join("")}</SP>`;
    });
    lines.push(`<B19>${entries.join("")}</B19>`);
  }

  // B20 — issuer's preferred communication language (Appendix D Table 7).
  lines.push(el("B20", language));

  lines.push("</ROE>");
  return lines.join("");
}

// ─── Public entry point ──────────────────────────────────────────────────────

/** Build the .BLK file name: sanitized employer short name + "_ROE.BLK"
 *  (Appendix D §2 / Table 3: prefix ≤256 alphanumeric chars + ".BLK").
 *  Non-alphanumeric characters are removed from the short name; the
 *  "_ROE" separator follows the prescribed Nexvar naming (and Service
 *  Canada's own "ACME_ROE200.BLK" example). */
function buildFilename(input: RoeExtractInput): string {
  const sanitized = (input.employer.shortName ?? "").replace(/[^A-Za-z0-9]/g, "");
  const base = sanitized.length > 0 ? sanitized : "PAYROLL";
  const prefix = `${base}_ROE`.slice(0, 256);
  return `${prefix}.BLK`;
}

/**
 * Serialize one ROE — or a batch of ROEs sharing a file header — into a
 * ROE Web Payroll Extract (.BLK) document.
 *
 * Returns the XML (declaration as the first line, per Appendix D §2), the
 * upload file name, and every business-rule warning raised along the way.
 * Throws only for structurally unbuildable ROEs (see module header).
 */
export function buildRoeExtractXml(
  roeInputs: RoeExtractInput | RoeExtractInput[],
  header: RoeExtractHeader,
): RoeExtractResult {
  const inputs = Array.isArray(roeInputs) ? roeInputs : [roeInputs];
  if (inputs.length === 0) {
    throw new Error("At least one ROE is required to build a payroll extract file.");
  }
  const warnings: string[] = [];
  if (inputs.length > 1200) {
    // Appendix D §2 / spec §2 recommended maximum per file — warning only.
    warnings.push(
      `The file contains ${inputs.length} ROEs, above the recommended maximum of 1,200 ROEs per file (Appendix D §2).`,
    );
  }
  const version = header.productVersion.trim();
  if (version.length > 10) {
    warnings.push('Header ProductVersion exceeds the 10-character limit and was truncated.');
  }
  const versionAttr = version
    ? ` ProductVersion="${escapeXml(version.slice(0, 10))}"`
    : "";

  const roeXml = inputs.map((input, i) => {
    const own: string[] = [];
    const xml = buildOneRoe(input, own);
    if (inputs.length > 1) {
      const who = `${input.employee.lastName}, ${input.employee.firstName}`;
      for (const w of own) warnings.push(`ROE ${i + 1} (${who}): ${w}`);
    } else {
      warnings.push(...own);
    }
    return xml;
  });

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ROEHEADER FileVersion="W-2.0" SoftwareVendor="Nexvar Lab Inc." ProductName="Nexvar Pay"${versionAttr}>` +
    roeXml.join("") +
    `</ROEHEADER>`;

  return { xml, filename: buildFilename(inputs[0]!), warnings };
}
