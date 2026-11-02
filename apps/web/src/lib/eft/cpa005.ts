/**
 * CPA-005 (Payments Canada Standard 005) AFT credit file generator — pure module.
 *
 * Governing spec summary: ~/workspace/nexvar-pay-versatility/specs/cpa-005-eft.md
 * (field tables from RBC's CPA-005 Credit File Format Specifications v10,
 * cross-checked against Antradar's implementation guide; the official
 * Standard 005 text and the receiving bank's onboarding test remain the
 * final arbiters where sources disagree — see the flagged conflicts below).
 *
 * This module is deliberately PURE: no imports from prisma, session, or any
 * server code, no I/O, no clocks. The caller supplies the originator profile,
 * the payments, and the creation date, and gets back the exact file bytes as
 * a string plus an audit summary (included count, control total, problems).
 * The server-action rewire that feeds real pay runs through here is a
 * separate step; this file replaces the format logic of the old (invalid)
 * 80-character export in src/lib/actions/eft.ts, it does not call it.
 *
 * Money rule: amounts are INTEGER CENTS everywhere inside this module.
 * Dollar floats never enter — a float amount is rejected as a bad payment.
 *
 * Format rules applied throughout (spec §1):
 *   - Every logical record is EXACTLY 1,464 characters.
 *   - Numeric (N) fields: right-justified, zero-filled; unused = all zeros.
 *   - Alphanumeric (AN) fields: left-justified, space-padded; unused = spaces.
 *   - Dates are Julian `0YYDDD` (literal leading 0, 2-digit year, 3-digit
 *     day-of-year). Example from the spec: Jan 15, 2027 = `027015`.
 *   - Institution + transit is always the 9-digit form:
 *     "0" + 3-digit institution + 5-digit transit.
 *   - Account numbers are at most 12 digits (CPA rule).
 */

/** Length of every logical record in the file (spec §1). */
export const CPA005_RECORD_LENGTH = 1464;

/** Number of 240-character payment segments carried by one C record (spec §3). */
const SEGMENTS_PER_CREDIT_RECORD = 6;
const SEGMENT_LENGTH = 240;

/** Due-date acceptance window, in days relative to the creation date (spec §3, RBC rule). */
const DUE_DATE_MIN_DAYS = -30;
const DUE_DATE_MAX_DAYS = 173;

/** Largest amount that fits the 10N segment amount field, in cents. */
const MAX_SEGMENT_AMOUNT_CENTS = 9_999_999_999;

/**
 * FLAGGED SPEC CONFLICT — returns account, segment positions 194–214 (spec §3).
 *
 * The CPA standard as implemented in working files (per Antradar's
 * reverse-engineering of production files) REQUIRES the originator's return
 * account in these positions. RBC's published table instead labels those
 * same positions "reserved" (194–202 zero-fill, 203–214 blank) — that is the
 * conflict. In working files, payments reject or returns cannot be routed
 * if the fields are left reserved.
 *
 * DECISION (per build instructions, pending the receiving bank's onboarding
 * test file): POPULATE them — 194–202 = "0" + returnInstitution +
 * returnTransit (9N), 203–214 = return account (12 AN) — because the
 * originator profile now supplies a real return account. The settlement code
 * at segment positions 252–253 ("01" per CPA/Antradar; "reserved" per RBC)
 * follows the same side of the conflict.
 *
 * This constant is the single flip point: set it to `false` to emit the
 * RBC-reserved variant instead (194–202 zeros, 203–214 spaces, 252–253
 * spaces) if the bank's test file says so.
 */
export const POPULATE_RETURNS_ACCOUNT = true;

/** Originator (client) profile — bank-issued values, never fabricated (spec §8). */
export interface Cpa005Originator {
  /** Bank-assigned client/originator number, 10 AN (header pos 11–20). */
  clientNumber: string;
  /** File creation number, exactly 4 AN, or "TEST" for test files (pos 21–24). Must not repeat any of the previous 9 submissions (spec §2). */
  fileCreationNumber: string;
  /** Processing/data centre, 5 N, bank-specific (pos 31–35). */
  dataCentre: string;
  /** Destination currency for the whole logical file; one currency per file (spec §1). */
  currency: "CAD" | "USD";
  /** Originator short name, ≤15 AN — appears on the payee's statement. */
  originatorShortName: string;
  /** Originator long (legal) name, ≤30 AN. Mandatory in every segment. */
  originatorLongName: string;
  /** Return-account institution number, exactly 3 digits. */
  returnInstitution: string;
  /** Return-account transit (branch) number, exactly 5 digits. */
  returnTransit: string;
  /** Return-account number, ≤12 digits. */
  returnAccount: string;
}

/** One payroll credit (direct deposit) to one payee (spec §3). */
export interface Cpa005Payment {
  /** Cross-reference / customer number, ≤19 AN — the trace key for returns and inquiries (segment pos 175–193). AN display field: longer values are truncated to the field width. */
  employeeRef: string;
  /** Payee legal name — MANDATORY; a payment without it rejects at the bank (segment pos 105–134). AN field: truncated to 30. */
  payeeName: string;
  /** Payee's institution number, exactly 3 digits. */
  institution: string;
  /** Payee's transit (branch) number, exactly 5 digits. */
  transit: string;
  /** Payee's account number, ≤12 digits. Spaces and dashes are stripped before validation; any other non-digit makes the payment invalid. */
  account: string;
  /** Net pay in integer cents, > 0. Floats and dollar amounts are not accepted. */
  amountCents: number;
  /** Payment/due date; must fall within −30/+173 days of the creation date (spec §3). */
  dueDate: Date | string;
  /** CPA Standard 007 transaction code; payroll default "200". */
  transactionCode?: string;
}

/** Why a single payment was excluded from the file. The file is still built from the remaining payments. */
export interface Cpa005Problem {
  /** The offending payment's employeeRef ("" if the payment carried none). */
  employeeRef: string;
  /** The field that failed validation, e.g. "transit". */
  field: string;
  /** Human-readable reason. */
  reason: string;
}

export interface Cpa005BuildResult {
  /** The complete file content: records joined by CRLF, with a trailing CRLF. */
  content: string;
  /** How many payments were actually written into C-record segments. */
  includedCount: number;
  /** Sum of the included payments' amounts, in integer cents. Balances to Z pos 47–60. */
  totalCents: number;
  /** One entry per validation failure on an excluded payment. */
  problems: Cpa005Problem[];
}

/* ------------------------------------------------------------------ */
/* Formatting helpers (spec §1)                                        */
/* ------------------------------------------------------------------ */

/** AN field: left-justified, truncated to width, space-padded. */
function padAn(value: string, length: number): string {
  return value.substring(0, length).padEnd(length, " ");
}

/** N field from an integer: right-justified, zero-filled. Throws if it cannot fit — that is an internal invariant, never caller data (amounts are pre-validated). */
function formatN(value: number, length: number): string {
  const digits = String(value);
  if (digits.length > length || !/^\d+$/.test(digits)) {
    throw new Error(`Internal error: value ${value} does not fit a ${length}-digit CPA-005 numeric field`);
  }
  return digits.padStart(length, "0");
}

const DAY_MS = 86_400_000;

/**
 * Normalize a Date or ISO string to a UTC calendar day (midnight UTC).
 * Dates are compared and converted by calendar day, so time-of-day and the
 * host timezone must never shift a payment across a day boundary. ISO
 * date-only strings ("2027-01-15") are read as that exact calendar date.
 * Returns null for anything unparseable.
 */
function toUtcCalendarDay(input: Date | string): Date | null {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (isoDate) {
      const year = Number(isoDate[1]);
      const month = Number(isoDate[2]);
      const day = Number(isoDate[3]);
      const candidate = new Date(Date.UTC(year, month - 1, day));
      // Reject overflow dates like 2027-02-30, which Date.UTC silently rolls over.
      if (
        candidate.getUTCFullYear() !== year ||
        candidate.getUTCMonth() !== month - 1 ||
        candidate.getUTCDate() !== day
      ) {
        return null;
      }
      return candidate;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  }
  return null;
}

/** Format a date as Julian `0YYDDD` (spec §1). Throws on an invalid date. */
export function toCpa005Julian(input: Date | string): string {
  const day = toUtcCalendarDay(input);
  if (day === null) {
    throw new Error(`Invalid date for CPA-005 Julian conversion: ${String(input)}`);
  }
  const year = day.getUTCFullYear();
  const dayOfYear = Math.floor((day.getTime() - Date.UTC(year, 0, 1)) / DAY_MS) + 1;
  const yy = String(year % 100).padStart(2, "0");
  const ddd = String(dayOfYear).padStart(3, "0");
  return `0${yy}${ddd}`;
}

/** Whole days from `from` to `to`, both already normalized to UTC calendar days. */
function dayDifference(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** Account digits after stripping spaces/dashes, or null if anything else remains. */
function stripAccount(raw: string): string | null {
  const stripped = raw.replace(/[\s-]/g, "");
  return /^\d*$/.test(stripped) ? stripped : null;
}

/** Guard rail: every record this module emits must be exactly 1,464 chars (spec §7.1). */
function assertRecordLength(record: string): string {
  if (record.length !== CPA005_RECORD_LENGTH) {
    throw new Error(
      `Internal error: CPA-005 record is ${record.length} characters, expected ${CPA005_RECORD_LENGTH}`,
    );
  }
  return record;
}

/* ------------------------------------------------------------------ */
/* Originator validation — fatal                                       */
/* ------------------------------------------------------------------ */

interface NormalizedOriginator {
  clientNumber: string;
  fileCreationNumber: string;
  dataCentre: string;
  currency: "CAD" | "USD";
  originatorShortName: string;
  originatorLongName: string;
  /** "0" + returnInstitution + returnTransit (9N). */
  returnRouting: string;
  /** Return account digits, spaces/dashes stripped. */
  returnAccount: string;
}

/**
 * Validate the originator profile. Unlike a single bad payment, a bad
 * originator makes the WHOLE file meaningless — banks reject outright, and
 * a fabricated client number or return account is exactly the defect this
 * rebuild exists to remove (spec §8, §9). So this throws, listing every
 * problem found in one message.
 */
function validateOriginator(originator: Cpa005Originator): NormalizedOriginator {
  const issues: string[] = [];
  const o: Cpa005Originator =
    originator !== null && typeof originator === "object"
      ? originator
      : ({} as Cpa005Originator);

  const clientNumber = typeof o.clientNumber === "string" ? o.clientNumber.trim() : "";
  if (clientNumber.length === 0) {
    issues.push("clientNumber is required (bank-assigned originator number, 10 AN) — it must never be fabricated");
  } else if (clientNumber.length > 10) {
    issues.push(`clientNumber must be at most 10 characters, got ${clientNumber.length}`);
  } else if (!/^[A-Za-z0-9]+$/.test(clientNumber)) {
    issues.push("clientNumber must be alphanumeric (AN)");
  }

  const fileCreationNumber = typeof o.fileCreationNumber === "string" ? o.fileCreationNumber.trim() : "";
  if (!/^[A-Za-z0-9]{4}$/.test(fileCreationNumber)) {
    issues.push('fileCreationNumber must be exactly 4 alphanumeric characters (or "TEST" for test files)');
  }

  const dataCentre = typeof o.dataCentre === "string" ? o.dataCentre.trim() : "";
  if (!/^\d{5}$/.test(dataCentre)) {
    issues.push("dataCentre must be exactly 5 digits (bank-assigned processing centre)");
  }

  if (o.currency !== "CAD" && o.currency !== "USD") {
    issues.push('currency must be "CAD" or "USD" (one currency per logical file)');
  }

  const originatorShortName = typeof o.originatorShortName === "string" ? o.originatorShortName.trim() : "";
  if (originatorShortName.length === 0) {
    issues.push("originatorShortName is required (appears on the payee's statement)");
  } else if (originatorShortName.length > 15) {
    issues.push(`originatorShortName must be at most 15 characters, got ${originatorShortName.length}`);
  }

  const originatorLongName = typeof o.originatorLongName === "string" ? o.originatorLongName.trim() : "";
  if (originatorLongName.length === 0) {
    issues.push("originatorLongName is required (mandatory in every payment segment)");
  } else if (originatorLongName.length > 30) {
    issues.push(`originatorLongName must be at most 30 characters, got ${originatorLongName.length}`);
  }

  const returnInstitution = typeof o.returnInstitution === "string" ? o.returnInstitution.trim() : "";
  if (!/^\d{3}$/.test(returnInstitution)) {
    issues.push("returnInstitution must be exactly 3 digits (return account routing)");
  }

  const returnTransit = typeof o.returnTransit === "string" ? o.returnTransit.trim() : "";
  if (!/^\d{5}$/.test(returnTransit)) {
    issues.push("returnTransit must be exactly 5 digits (return account routing)");
  }

  const returnAccountRaw = typeof o.returnAccount === "string" ? o.returnAccount : "";
  const returnAccount = returnAccountRaw.length > 0 ? stripAccount(returnAccountRaw) : null;
  if (returnAccount === null || returnAccount.length === 0) {
    issues.push("returnAccount is required and must be numeric (the real settlement/return account) — it must never be fabricated");
  } else if (returnAccount.length > 12) {
    issues.push(`returnAccount must be at most 12 digits, got ${returnAccount.length}`);
  }

  if (issues.length > 0) {
    throw new Error(`Invalid CPA-005 originator: ${issues.join("; ")}`);
  }

  return {
    clientNumber,
    fileCreationNumber,
    dataCentre,
    currency: o.currency,
    originatorShortName,
    originatorLongName,
    returnRouting: `0${returnInstitution}${returnTransit}`,
    // Non-null/non-empty is proven by the checks above.
    returnAccount: returnAccount as string,
  };
}

/* ------------------------------------------------------------------ */
/* Payment validation — exclusion, never fabrication (spec §7, §8)     */
/* ------------------------------------------------------------------ */

interface NormalizedPayment {
  employeeRef: string;
  payeeName: string;
  /** "0" + institution + transit (9N). */
  routing: string;
  /** Account digits, spaces/dashes stripped. */
  account: string;
  amountCents: number;
  /** Due date normalized to a UTC calendar day. */
  dueDay: Date;
  transactionCode: string;
}

/**
 * Validate one payment. Returns the normalized payment, or null when it must
 * be excluded — every failure is appended to `problems`. A bad payment is
 * NEVER given dummy banking values and NEVER aborts the file (spec §8:
 * employees without banking are "excluded with a visible warning").
 *
 * Exclusion triggers (money-routing and value fields — defects here would
 * send money to the wrong place or for the wrong amount):
 * institution, transit, account, payeeName, amountCents, dueDate,
 * transactionCode. The cross-reference is a trace label, not a routing
 * field, so an overlong one is truncated to its 19-char field rather than
 * dropping an otherwise payable employee.
 */
function validatePayment(
  payment: Cpa005Payment,
  creationDay: Date,
  problems: Cpa005Problem[],
): NormalizedPayment | null {
  const p: Cpa005Payment =
    payment !== null && typeof payment === "object" ? payment : ({} as Cpa005Payment);
  const employeeRef = typeof p.employeeRef === "string" ? p.employeeRef : "";
  const failuresBefore = problems.length;
  const fail = (field: string, reason: string): void => {
    problems.push({ employeeRef, field, reason });
  };

  const institution = typeof p.institution === "string" ? p.institution.trim() : "";
  if (!/^\d{3}$/.test(institution)) {
    fail("institution", "institution must be exactly 3 digits");
  }

  const transit = typeof p.transit === "string" ? p.transit.trim() : "";
  if (!/^\d{5}$/.test(transit)) {
    fail("transit", "transit must be exactly 5 digits");
  }

  let account = "";
  if (typeof p.account !== "string" || p.account.trim().length === 0) {
    fail("account", "account is required");
  } else {
    const stripped = stripAccount(p.account);
    if (stripped === null) {
      fail("account", "account must be numeric (only spaces and dashes may separate digits)");
    } else if (stripped.length === 0) {
      fail("account", "account is required");
    } else if (stripped.length > 12) {
      fail("account", `account must be at most 12 digits, got ${stripped.length}`);
    } else {
      account = stripped;
    }
  }

  const payeeName = typeof p.payeeName === "string" ? p.payeeName.trim() : "";
  if (payeeName.length === 0) {
    fail("payeeName", "payeeName is required — the payment rejects at the bank without it");
  }

  const amountCents = p.amountCents;
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents)) {
    fail("amountCents", "amountCents must be an integer number of cents (dollar floats never enter this module)");
  } else if (amountCents <= 0) {
    fail("amountCents", "amountCents must be greater than zero");
  } else if (amountCents > MAX_SEGMENT_AMOUNT_CENTS) {
    fail("amountCents", "amountCents exceeds the 10-digit segment amount field");
  }

  const dueDay = toUtcCalendarDay(p.dueDate);
  if (dueDay === null) {
    fail("dueDate", "dueDate is not a valid date");
  } else {
    const offset = dayDifference(creationDay, dueDay);
    if (offset < DUE_DATE_MIN_DAYS || offset > DUE_DATE_MAX_DAYS) {
      fail(
        "dueDate",
        `dueDate is ${offset} days from the creation date; the bank window is ${DUE_DATE_MIN_DAYS} to +${DUE_DATE_MAX_DAYS} days`,
      );
    }
  }

  const transactionCode =
    p.transactionCode === undefined
      ? "200"
      : typeof p.transactionCode === "string"
        ? p.transactionCode.trim()
        : "";
  if (!/^\d{3}$/.test(transactionCode)) {
    fail("transactionCode", 'transactionCode must be exactly 3 digits (payroll default "200")');
  }

  if (problems.length > failuresBefore || dueDay === null) {
    return null;
  }

  return {
    employeeRef,
    payeeName,
    routing: `0${institution}${transit}`,
    account,
    amountCents,
    dueDay,
    transactionCode,
  };
}

/* ------------------------------------------------------------------ */
/* Record builders (positions are 1-based, per the spec tables)        */
/* ------------------------------------------------------------------ */

/** "A" header record (spec §2). */
function buildHeaderRecord(originator: NormalizedOriginator, creationDay: Date): string {
  const record =
    "A" + //                                          pos 1      record type
    formatN(1, 9) + //                                 pos 2–10   record count, first record
    padAn(originator.clientNumber, 10) + //            pos 11–20  client number
    padAn(originator.fileCreationNumber, 4) + //       pos 21–24  file creation number
    toCpa005Julian(creationDay) + //                   pos 25–30  creation date (Julian)
    originator.dataCentre + //                         pos 31–35  data centre (5 N, validated)
    " ".repeat(20) + //                                pos 36–55  reserved, spaces
    originator.currency + //                           pos 56–58  currency — explicit CAD/USD, not the blank default
    // Pos 59–1464: filler, ALL SPACES per the RBC table (spec §2).
    // NOTE: a reverse-engineered guide reports an undocumented settlement
    // block at pos 1249–1270 of this filler. It is UNVERIFIED against the
    // official Standard 005 text, so per the spec's own warning we ship
    // spaces; do not populate 1249–1270 from a secondary source alone.
    " ".repeat(CPA005_RECORD_LENGTH - 58);
  return assertRecordLength(record);
}

/**
 * One used 240-char payment segment (spec §3). Comments give the segment-1
 * absolute positions; add 240 per subsequent segment.
 */
function buildSegment(originator: NormalizedOriginator, payment: NormalizedPayment): string {
  const segment =
    padAn(payment.transactionCode, 3) + //              pos 25–27    transaction code ("200" payroll)
    formatN(payment.amountCents, 10) + //               pos 28–37    amount, implied cents
    toCpa005Julian(payment.dueDay) + //                 pos 38–43    due date (Julian)
    payment.routing + //                                pos 44–52    "0" + institution + transit
    padAn(payment.account, 12) + //                     pos 53–64    account, 12 AN, SPACE-padded — do NOT zero-fill
    "0".repeat(25) + //                                pos 65–89    reserved, zero-filled (22 + 3)
    padAn(originator.originatorShortName, 15) + //      pos 90–104   originator short name
    padAn(payment.payeeName, 30) + //                   pos 105–134  payee name
    padAn(originator.originatorLongName, 30) + //       pos 135–164  originator long name
    padAn(originator.clientNumber, 10) + //             pos 165–174  client number (repeat of header)
    padAn(payment.employeeRef, 19) + //                 pos 175–193  cross-reference
    // Pos 194–214, returns account — see POPULATE_RETURNS_ACCOUNT above.
    (POPULATE_RETURNS_ACCOUNT ? originator.returnRouting : "0".repeat(9)) + // pos 194–202  bank ID for returns (9 N)
    (POPULATE_RETURNS_ACCOUNT ? padAn(originator.returnAccount, 12) : " ".repeat(12)) + // pos 203–214  account no. for returns (12 AN)
    " ".repeat(15) + //                                pos 215–229  client sundry information (unused)
    " ".repeat(22) + //                                pos 230–251  reserved, blank
    (POPULATE_RETURNS_ACCOUNT ? "01" : "  ") + //       pos 252–253  settlement code "01" (same side of the §3 conflict)
    "0".repeat(11); //                                 pos 254–264  reserved, zero-filled
  if (segment.length !== SEGMENT_LENGTH) {
    throw new Error(`Internal error: CPA-005 segment is ${segment.length} characters, expected ${SEGMENT_LENGTH}`);
  }
  return segment;
}

/**
 * One unused segment: numeric fields zero-filled, AN fields blank, field by
 * field in the same layout as a used segment (spec §3: "Unused segments:
 * numeric fields zero-filled, AN fields blank").
 */
function buildUnusedSegment(): string {
  const segment =
    " ".repeat(3) + //   transaction code (AN)
    "0".repeat(10) + //  amount (N)
    "0".repeat(6) + //   due date (N)
    "0".repeat(9) + //   institution + transit (N)
    " ".repeat(12) + //  account (AN)
    "0".repeat(25) + //  reserved (N)
    " ".repeat(15) + //  originator short name (AN)
    " ".repeat(30) + //  payee name (AN)
    " ".repeat(30) + //  originator long name (AN)
    " ".repeat(10) + //  client number (AN)
    " ".repeat(19) + //  cross-reference (AN)
    "0".repeat(9) + //   bank ID for returns (N)
    " ".repeat(12) + //  account no. for returns (AN)
    " ".repeat(15) + //  sundry information (AN)
    " ".repeat(22) + //  reserved (AN)
    " ".repeat(2) + //   settlement code (AN)
    "0".repeat(11); //   segment tail (zero-filled)
  if (segment.length !== SEGMENT_LENGTH) {
    throw new Error(`Internal error: CPA-005 unused segment is ${segment.length} characters, expected ${SEGMENT_LENGTH}`);
  }
  return segment;
}

/** One "C" credit record: header fields + up to 6 segments (spec §3). Credit-only file — no D record in a payroll submission (spec §5). */
function buildCreditRecord(
  originator: NormalizedOriginator,
  batch: NormalizedPayment[],
  recordCount: number,
): string {
  let record =
    "C" + //                                           pos 1      record type
    formatN(recordCount, 9) + //                        pos 2–10   record count (sequence continues from the A record)
    padAn(originator.clientNumber, 10) + //             pos 11–20  client number (same as header)
    padAn(originator.fileCreationNumber, 4); //         pos 21–24  file creation number (same as header)
  for (let i = 0; i < SEGMENTS_PER_CREDIT_RECORD; i++) {
    const payment = batch[i];
    record += payment ? buildSegment(originator, payment) : buildUnusedSegment();
  }
  return assertRecordLength(record);
}

/** "Z" trailer record (spec §6). The Z record count equals the total number of records in the logical file. */
function buildTrailerRecord(
  originator: NormalizedOriginator,
  recordCount: number,
  totalCents: number,
  includedCount: number,
): string {
  const record =
    "Z" + //                                           pos 1      record type
    formatN(recordCount, 9) + //                        pos 2–10   record count (last sequence number)
    padAn(originator.clientNumber, 10) + //             pos 11–20  client number (matches header)
    padAn(originator.fileCreationNumber, 4) + //        pos 21–24  file creation number (matches header)
    "0".repeat(14) + //                                pos 25–38  reserved, zero-filled
    "0".repeat(8) + //                                 pos 39–46  reserved, zero-filled
    formatN(totalCents, 14) + //                        pos 47–60  TOTAL credit amount, implied cents — file balances to this
    formatN(includedCount, 8) + //                      pos 61–68  TOTAL credit transaction count (segments used, not records)
    "0".repeat(CPA005_RECORD_LENGTH - 68); //           pos 69–1464 filler, zero-filled
  return assertRecordLength(record);
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Build one CPA-005 logical file (A → C… → Z) for a batch of payroll credits.
 *
 * @param originator  Bank-issued originator profile. Invalid → throws,
 *                    listing every problem (no file is meaningful without a
 *                    real client number and return account).
 * @param payments    Payroll credits. Individually invalid payments are
 *                    EXCLUDED and reported in `problems` — never dummy-filled,
 *                    never fatal (spec §8). If every payment is excluded the
 *                    result is an A + Z file with count/total of zero, so the
 *                    caller can surface the problems instead of crashing.
 * @param creationDate File creation date (Date or ISO string); anchors the
 *                    header Julian date and the −30/+173 due-date window.
 */
export function buildCpa005File(
  originator: Cpa005Originator,
  payments: Cpa005Payment[],
  creationDate: Date | string,
): Cpa005BuildResult {
  const normalizedOriginator = validateOriginator(originator);

  const creationDay = toUtcCalendarDay(creationDate);
  if (creationDay === null) {
    throw new Error(`Invalid CPA-005 creation date: ${String(creationDate)}`);
  }

  const problems: Cpa005Problem[] = [];
  const included: NormalizedPayment[] = [];
  for (const payment of payments ?? []) {
    const normalized = validatePayment(payment, creationDay, problems);
    if (normalized !== null) {
      included.push(normalized);
    }
  }

  const totalCents = included.reduce((sum, p) => sum + p.amountCents, 0);

  const records: string[] = [buildHeaderRecord(normalizedOriginator, creationDay)];
  for (let start = 0; start < included.length; start += SEGMENTS_PER_CREDIT_RECORD) {
    const batch = included.slice(start, start + SEGMENTS_PER_CREDIT_RECORD);
    // Record count: A is 1, so the first C record is 2 (sequence is unbroken across A/C/Z, spec §7.2).
    records.push(buildCreditRecord(normalizedOriginator, batch, records.length + 1));
  }
  // The Z record's own count is the total record count, including itself.
  records.push(
    buildTrailerRecord(normalizedOriginator, records.length + 1, totalCents, included.length),
  );

  // Line endings (spec §1): CRLF between records, and a trailing CRLF after
  // the Z record — this matches the current export behaviour and Antradar's
  // working files. UNVERIFIED against the official standard: some banks want
  // LF only or NO delimiter with fixed 1,464 blocking. If a bank says so,
  // this join (and the trailing terminator) is the one line to change.
  const content = records.join("\r\n") + "\r\n";

  return { content, includedCount: included.length, totalCents, problems };
}
