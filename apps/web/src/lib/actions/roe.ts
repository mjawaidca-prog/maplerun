"use server";

/**
 * Record of Employment (ROE) data computation.
 *
 * CRA ROE Web format expects:
 *  - Block 15A: Total insurable hours
 *  - Block 15B: Total insurable earnings
 *  - Block 15C: Insurable earnings by pay period (last 53 periods)
 *  - Block 16: Reason for issuing ROE
 *
 * Wave 2 wiring: the period history (Blocks 15A/15C) is built by the pure
 * `buildRoePeriods` helper (lib/filings/roe-periods.ts) from the hours
 * RECORDED on each finalized pay-run item (`PayRunItem.hours`). The old
 * caller-supplied `hoursPerPeriod` map — which silently defaulted every
 * period to 0 hours — is gone. Periods that still carry 0 recorded hours
 * are surfaced via `RoeData.warnings` instead of flowing into Block 15A
 * unnoticed.
 *
 * Worked dates come from the employee record (Wave 1 fields): Block 10 is
 * `Employee.startDate` and the last day worked is `Employee.terminationDate`
 * when set. Only when a date is missing do we fall back to the
 * corresponding pay date, and every fallback adds a visible warning.
 * (The PayRun model carries no separate period start/end fields — its
 * `payDate` IS the period end date — so period ends come from `payDate`
 * via `buildRoePeriods`.)
 *
 * The .BLK payroll-extract file is built by `generateRoeBlkFile`, which
 * maps the same source data onto `buildRoeExtractXml`
 * (lib/filings/roe-extract.ts). The SIN is decrypted only inside that
 * function, is never logged, and is scrubbed from any error it rethrows.
 * Block 15B is NOT emitted in the extract — ROE Web computes it.
 */

import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/session";
import { decrypt } from "@/lib/encryption";
import { buildRoePeriods } from "@/lib/filings/roe-periods";
import {
  buildRoeExtractXml,
  type RoeExtractInput,
  type RoeOtherMoneyInput,
  type RoePayPeriodType,
  type RoeVacationPayInput,
} from "@/lib/filings/roe-extract";
import type { EmployeeYtd } from "@maplerun/tax-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RoePayPeriod = {
  periodEnd: string;
  hours: number;
  earnings: number;
};

export type RoeBlock = {
  totalHours: number;
  totalEarnings: number;
  periods: RoePayPeriod[];
};

/** One Block 17C "other monies" separation payment (employer-facing shape). */
export type RoeOtherPaymentInput = {
  /** Appendix D Table 17C.1 code — a spec letter (e.g. "E") or a full XML
   *  code (e.g. "E00"). Invalid codes throw from the extract module. */
  code: string;
  amount: number;
  startDate?: string;
  endDate?: string;
};

export type RoeGenerateOptions = {
  /**
   * Block 17A vacation pay paid on termination, in dollars. When the
   * caller passes nothing, the employee's accrued vacation balance
   * (`Employee.vacationBalanceCents / 100`) is used — the ROE page
   * pre-fills its editable field with that balance.
   */
  vacationPayOnTermination?: number;
  /** Block 17C other monies paid on separation (max 3, module-enforced). */
  otherPayments?: RoeOtherPaymentInput[];
};

export type RoeData = {
  employeeName: string;
  employeeId: string;
  sinMasked: string; // Last 3 digits only
  firstWorkDate: string | null;
  lastWorkDate: string;
  finalPayDate: string;
  reasonCode: string; // A=shortage, B=strike, C=return to school, etc.
  block15A: number; // Total insurable hours
  block15B: number; // Total insurable earnings
  block15C: RoePayPeriod[]; // Last 53 pay periods, most-recent-first
  ytdAtTermination: EmployeeYtd;
  generatedAt: string;
  /** Human-visible data-quality warnings (zero-hour periods, worked-date
   *  fallbacks). Rendered prominently on the ROE detail page. */
  warnings: string[];
  /** Block 17A vacation pay on termination actually used (dollars). */
  vacationPayOnTermination: number;
  /** Block 17C other monies actually used. */
  otherPayments: RoeOtherPaymentInput[];
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** `CCYY-MM-DD` date part from a Date or an ISO date/datetime string. */
function datePart(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value.slice(0, 10);
}

type RoeSource = {
  employee: NonNullable<Awaited<ReturnType<typeof loadEmployee>>>;
  items: Awaited<ReturnType<typeof loadItems>>;
};

/** Structural shape of a finalized pay-run item row used by the builders. */
type RoeItemRow = {
  hours: number;
  gross: number;
  ei: number;
  payRun: { payDate: string };
};

function toPeriodItemInput(item: RoeItemRow) {
  return {
    payDate: item.payRun.payDate,
    hours: item.hours,
    gross: item.gross,
    ei: item.ei,
  };
}

async function loadEmployee(employeeId: string) {
  return prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      ytdLedgers: { where: { year: 2026 }, take: 1 },
    },
  });
}

async function loadItems(employeeId: string, companyId: string) {
  return prisma.payRunItem.findMany({
    where: {
      employeeId,
      payRun: { status: "FINALIZED", companyId },
    },
    include: {
      payRun: { select: { payDate: true } },
    },
    orderBy: { payRun: { payDate: "asc" } },
  });
}

async function loadRoeSource(
  employeeId: string,
  companyId: string,
): Promise<RoeSource> {
  const employee = await loadEmployee(employeeId);
  if (!employee || employee.companyId !== companyId) {
    throw new Error("Employee not found.");
  }
  const items = await loadItems(employeeId, companyId);
  if (items.length === 0) {
    throw new Error("No finalized pay runs found for this employee.");
  }
  return { employee, items };
}

/** Resolve the separation payments actually used for this ROE. */
function resolveSeparationPayments(
  employee: { vacationBalanceCents: number },
  options?: RoeGenerateOptions,
): { vacationPayOnTermination: number; otherPayments: RoeOtherPaymentInput[] } {
  return {
    vacationPayOnTermination:
      options?.vacationPayOnTermination ??
      employee.vacationBalanceCents / 100,
    otherPayments: options?.otherPayments ?? [],
  };
}

/**
 * Worked dates + warnings. First/last pay dates are taken from the
 * chronological (oldest-first) item list; the last period's end is the
 * most recent period end from the builder output.
 */
function resolveWorkedDates(
  employee: { startDate: Date | null; terminationDate: Date | null },
  items: { payRun: { payDate: string } }[],
  lastPeriodEnd: string,
): { firstWorkDate: string; lastWorkDate: string; finalPayDate: string; warnings: string[] } {
  const warnings: string[] = [];
  const firstPayDate = datePart(items[0]!.payRun.payDate);
  const finalPayDate = datePart(items[items.length - 1]!.payRun.payDate);

  let firstWorkDate: string;
  if (employee.startDate) {
    firstWorkDate = datePart(employee.startDate);
  } else {
    firstWorkDate = firstPayDate;
    warnings.push(
      "start date not on file — first pay date used; confirm the actual first day of work",
    );
  }

  let lastWorkDate: string;
  if (employee.terminationDate) {
    lastWorkDate = datePart(employee.terminationDate);
  } else {
    lastWorkDate = lastPeriodEnd;
    warnings.push(
      "termination date not on file — last pay period end used; confirm the actual last day of work",
    );
  }

  return { firstWorkDate, lastWorkDate, finalPayDate, warnings };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function generateRoe(
  employeeId: string,
  reasonCode: string,
  options?: RoeGenerateOptions,
): Promise<RoeData> {
  const { companyId } = await requireCompany();
  const { employee, items } = await loadRoeSource(employeeId, companyId);

  // Period history from the pure builder: hours are the RECORDED item
  // hours (authoritative), periods most-recent-first for Block 15C.
  const { periods, zeroHourPeriods } = buildRoePeriods(
    items.map(toPeriodItemInput),
  );

  const block15C: RoePayPeriod[] = periods.map((p) => ({
    periodEnd: p.periodEnd,
    hours: p.insurableHours,
    earnings: p.insurableEarnings,
  }));
  const block15A = periods.reduce((s, p) => s + p.insurableHours, 0);
  const block15B = periods.reduce((s, p) => s + p.insurableEarnings, 0);

  const dates = resolveWorkedDates(
    employee,
    items,
    periods[0]!.periodEnd,
  );

  const warnings: string[] = [...dates.warnings];
  if (zeroHourPeriods > 0) {
    warnings.push(
      `${zeroHourPeriods} pay periods have no recorded hours; Block 15A may be understated — verify before issuing`,
    );
  }

  const { vacationPayOnTermination, otherPayments } =
    resolveSeparationPayments(employee, options);

  const ytd = employee.ytdLedgers[0];

  return {
    employeeName: `${employee.firstName} ${employee.lastName}`,
    employeeId: employee.id,
    sinMasked: `•••${employee.sinEncrypted.slice(-3)}`, // Won't be actual SIN digits since encrypted
    firstWorkDate: dates.firstWorkDate,
    lastWorkDate: dates.lastWorkDate,
    finalPayDate: dates.finalPayDate,
    reasonCode,
    block15A,
    block15B,
    block15C,
    ytdAtTermination: ytd
      ? {
          pensionableEarnings: ytd.pensionableEarnings,
          cpp: ytd.cpp,
          cpp2: ytd.cpp2,
          insurableEarnings: ytd.insurableEarnings,
          ei: ytd.ei,
        }
      : {
          pensionableEarnings: 0,
          cpp: 0,
          cpp2: 0,
          insurableEarnings: 0,
          ei: 0,
        },
    generatedAt: new Date().toISOString(),
    warnings,
    vacationPayOnTermination,
    otherPayments,
  };
}

/** PayGroup frequency (Prisma enum) → ROE Web pay period type (Block 6). */
const PAY_PERIOD_TYPE_BY_FREQUENCY: Record<string, RoePayPeriodType> = {
  WEEKLY: "W",
  BIWEEKLY: "B",
  SEMIMONTHLY: "S",
  MONTHLY: "M",
};

/** Nexvar Pay product version reported in the extract header (≤10 chars). */
const ROE_PRODUCT_VERSION = "1.0.0";

/**
 * Build the ROE Web Payroll Extract (.BLK) file for one employee.
 *
 * Mapping (all judgement calls documented in the PR):
 *  - Employer: Company.businessNumber (a bare 9-digit BN is completed to
 *    the RP form with "RP0001"; anything else is passed through and the
 *    extract module validates it) + Company.name as the file-name short
 *    name. The Company model has no address fields, and the extract XML
 *    carries no employer address — ROE Web identifies the employer by
 *    Block 5 alone.
 *  - Contact (Block 16): the signed-in user's name. The User/Company
 *    models carry no phone number, so area code / phone are left blank
 *    and the extract module's warnings report that.
 *  - Employee address: addressLine1 / city (Block 9 A2) / province (A3) /
 *    postalCode from the Employee record; occupation from jobTitle.
 *  - Pay period type: the employee's pay group frequency, defaulting to
 *    bi-weekly ("B") when the employee has no pay group.
 *  - Vacation pay: the resolved termination amount (see
 *    `resolveSeparationPayments`) as Block 17A code "2" (paid on
 *    separation), omitted entirely when the amount is 0.
 *  - Other payments: Block 17C other monies, codes validated by the
 *    extract module (invalid codes throw).
 *
 * SIN boundary: the SIN is decrypted ONLY here, used only as the extract
 * input's Block 8 value, never logged, and scrubbed from any error this
 * function rethrows (the extract module's Block 8 error echoes its input).
 */
export async function generateRoeBlkFile(
  employeeId: string,
  reasonCode: string,
  options?: RoeGenerateOptions,
): Promise<{ filename: string; content: string; warnings: string[] }> {
  const session = await requireCompany();
  const { companyId } = session;
  const { employee, items } = await loadRoeSource(employeeId, companyId);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, businessNumber: true },
  });
  if (!company?.businessNumber) {
    throw new Error(
      "Company business number is not on file — add it in company settings before generating an ROE file.",
    );
  }
  const rawBn = company.businessNumber.replace(/\s/g, "").toUpperCase();
  const payrollAccountNumber = /^\d{9}$/.test(rawBn)
    ? `${rawBn}RP0001`
    : rawBn;

  let payPeriodType: RoePayPeriodType = "B";
  if (employee.payGroupId) {
    const payGroup = await prisma.payGroup.findUnique({
      where: { id: employee.payGroupId },
      select: { frequency: true },
    });
    payPeriodType =
      PAY_PERIOD_TYPE_BY_FREQUENCY[String(payGroup?.frequency)] ?? "B";
  }

  const { periods } = buildRoePeriods(items.map(toPeriodItemInput));
  const dates = resolveWorkedDates(employee, items, periods[0]!.periodEnd);
  const { vacationPayOnTermination, otherPayments } =
    resolveSeparationPayments(employee, options);

  // Contact from the signed-in user (Block 16 issuer). Name is split on
  // the last space; no phone exists on the User/Company records.
  const contactName = (session.name ?? "").trim();
  const lastSpace = contactName.lastIndexOf(" ");
  const contactFirst =
    lastSpace > 0 ? contactName.slice(0, lastSpace) : contactName;
  const contactLast = lastSpace > 0 ? contactName.slice(lastSpace + 1) : "";

  const vacationPay: RoeVacationPayInput | undefined =
    vacationPayOnTermination > 0
      ? { cd: "2", amount: vacationPayOnTermination }
      : undefined;
  const otherMonies: RoeOtherMoneyInput[] | undefined =
    otherPayments.length > 0
      ? otherPayments.map((p) => ({
          cd: p.code,
          amount: p.amount,
          startDate: p.startDate,
          endDate: p.endDate,
        }))
      : undefined;

  // SIN is decrypted inside this function only (see header note).
  const sin = decrypt(employee.sinEncrypted);
  try {
    const input: RoeExtractInput = {
      employer: {
        payrollAccountNumber,
        shortName: company.name,
        contact: {
          firstName: contactFirst,
          lastName: contactLast,
          areaCode: "",
          phone: "",
        },
      },
      employee: {
        sin,
        firstName: employee.firstName,
        lastName: employee.lastName,
        addressLine1: employee.addressLine1 ?? "",
        addressLine2: employee.city ?? employee.addressLine2 ?? "",
        addressLine3: employee.province ?? undefined,
        postalCode: employee.postalCode ?? "",
        occupation: employee.jobTitle ?? undefined,
        firstDayWorked: dates.firstWorkDate,
        lastDayForWhichPaid: dates.lastWorkDate,
        finalPayPeriodEndingDate: periods[0]!.periodEnd,
      },
      payrollReferenceNumber: employee.id.slice(0, 26),
      payPeriodType,
      periods: periods.map((p) => ({
        periodEnd: p.periodEnd,
        insurableHours: p.insurableHours,
        insurableEarnings: p.insurableEarnings,
      })),
      reasonCode,
      expectedRecall: { cd: "U" },
      vacationPay,
      otherMonies,
    };

    const { xml, warnings } = buildRoeExtractXml(input, {
      productVersion: ROE_PRODUCT_VERSION,
    });

    const safeName =
      `${employee.firstName}-${employee.lastName}`.replace(
        /[^A-Za-z0-9-]/g,
        "",
      ) || "employee";
    return { filename: `${safeName}-roe.blk`, content: xml, warnings };
  } catch (e) {
    // Scrub the decrypted SIN (raw and digits-only forms) from any error
    // before it can reach a log or an HTTP response.
    const digits = sin.replace(/\D/g, "");
    let message = e instanceof Error ? e.message : "Failed to build ROE file.";
    if (sin) message = message.split(sin).join("•••");
    if (digits && digits !== sin) message = message.split(digits).join("•••");
    throw new Error(message);
  }
}

// NOTE: ROE_REASON_CODES lives in lib/roe-constants.ts and must be imported
// from there directly — re-exporting it from this "use server" file is a
// build error (only async functions may be exported), which is why the old
// re-export that sat here unused was removed when this module was wired in.
