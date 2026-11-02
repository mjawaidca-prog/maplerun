"use server";

/**
 * CPA-005 direct deposit (EFT) wiring — Wave 2.
 *
 * This module is the SERVER side of the pure CPA-005 builder in
 * src/lib/eft/cpa005.ts: it loads a finalized pay run plus the company's
 * bank-issued originator profile from Settings, maps them onto
 * Cpa005Originator / Cpa005Payment, and hands back the built file together
 * with a per-employee inclusion/exclusion audit.
 *
 * It replaces the old 80-character generator that FABRICATED routing
 * values (originator ID derived from the company ID, institution "001",
 * transit "00000", account "N/A"). Nothing here invents a bank value:
 * an incomplete originator profile is a hard, user-facing error naming
 * the Settings fields to fill in, and an employee whose banking is
 * missing or undecryptable is passed to the builder with empty banking
 * fields so the BUILDER excludes them and reports the reason — the
 * exclusion is surfaced to the user, never papered over with defaults.
 */

import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/encryption";
import { parseBankDetails } from "@/lib/banking";
import { revalidatePath } from "next/cache";
import {
  buildCpa005File,
  type Cpa005Originator,
  type Cpa005Payment,
} from "@/lib/eft/cpa005";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface EftExcludedEmployee {
  employeeName: string;
  reasons: string[];
}

export interface EftIncludedEmployee {
  employeeName: string;
  amountCents: number;
}

export interface EftFileResult {
  filename: string;
  content: string;
  includedCount: number;
  totalCents: number;
  excluded: EftExcludedEmployee[];
}

export interface EftPreviewResult {
  /**
   * Settings labels of the originator-profile fields that are missing or
   * invalid. Non-empty means NO file can be built for any run until the
   * profile is completed in Settings → Payroll.
   */
  profileProblems: string[];
  included: EftIncludedEmployee[];
  excluded: EftExcludedEmployee[];
  includedCount: number;
  totalCents: number;
}

/* ------------------------------------------------------------------ */
/* Originator profile — Settings labels + completeness check           */
/* ------------------------------------------------------------------ */

/** Settings → Payroll field labels, used in every user-facing message. */
const FIELD_LABELS = {
  clientNumber: "Originator ID / client number",
  originatorShortName: "Originator short name",
  dataCentre: "Data centre",
  returnInstitution: "Institution number",
  returnTransit: "Transit number",
  returnAccount: "Account number",
} as const;

type CompanyEftFields = {
  name: string;
  eftOriginatorName: string | null;
  eftOriginatorId: string | null;
  eftDataCentre: string | null;
  eftInstitution: string | null;
  eftTransit: string | null;
  eftAccount: string | null;
};

/** Decrypt the stored return account; null when unset or undecryptable. */
function decryptReturnAccount(company: CompanyEftFields): string | null {
  if (!company.eftAccount) return null;
  try {
    const plain = decrypt(company.eftAccount).replace(/[\s-]/g, "");
    return plain.length > 0 ? plain : null;
  } catch {
    return null;
  }
}

/**
 * Which originator-profile fields are missing or malformed, as Settings
 * labels. Mirrors the builder's originator validation so the user gets a
 * "go fill these in" message instead of a raw format error. (The company
 * legal name is always present, so originatorLongName never appears here;
 * it is truncated to the 30-char field width at mapping time.)
 */
function originatorProfileProblems(company: CompanyEftFields): string[] {
  const problems: string[] = [];
  const id = company.eftOriginatorId?.trim() ?? "";
  if (!id || id.length > 10 || !/^[A-Za-z0-9]+$/.test(id)) {
    problems.push(FIELD_LABELS.clientNumber);
  }
  const shortName = company.eftOriginatorName?.trim() ?? "";
  if (!shortName || shortName.length > 15) {
    problems.push(FIELD_LABELS.originatorShortName);
  }
  if (!/^\d{5}$/.test(company.eftDataCentre?.trim() ?? "")) {
    problems.push(FIELD_LABELS.dataCentre);
  }
  if (!/^\d{3}$/.test(company.eftInstitution?.trim() ?? "")) {
    problems.push(FIELD_LABELS.returnInstitution);
  }
  if (!/^\d{5}$/.test(company.eftTransit?.trim() ?? "")) {
    problems.push(FIELD_LABELS.returnTransit);
  }
  const account = decryptReturnAccount(company);
  if (!account || !/^\d+$/.test(account) || account.length > 12) {
    problems.push(FIELD_LABELS.returnAccount);
  }
  return problems;
}

function profileError(problems: string[]): Error {
  return new Error(
    `Your EFT originator profile is incomplete. Complete these fields in Settings → Payroll before downloading an EFT file: ${problems.join(", ")}.`,
  );
}

/* ------------------------------------------------------------------ */
/* Loading + mapping                                                   */
/* ------------------------------------------------------------------ */

interface EftContext {
  payDate: string;
  fileCreationNumber: string;
  originator: Cpa005Originator;
  payments: Cpa005Payment[];
  /** employeeRef (employee.id, truncated to 19) → display name, in run order. */
  namesByRef: Map<string, string>;
  /** Positive-net payments only; zero/negative-net items never reach the builder. */
  payableRefs: Set<string>;
  /** Exclusions decided before the builder runs (currently: net pay ≤ 0). */
  preExcluded: EftExcludedEmployee[];
}

/**
 * File creation number — INTERIM derivation.
 *
 * The FCN is a SENDER-side rotating sequence (it must not repeat any of
 * the previous 9 submissions to the bank); it is NOT a bank-assigned
 * value. Until the durable fix lands — persisted per-file generation
 * state, per spec §8 — it is derived deterministically from the pay-run
 * history: this run's 1-based position among the company's FINALIZED
 * pay runs ordered by (payDate, createdAt), wrapped into 0001–9999.
 * The derivation is stable per run (re-downloading a run reproduces the
 * same FCN) and rotates monotonically as new runs are finalized.
 */
async function deriveFileCreationNumber(
  companyId: string,
  payRun: { payDate: string; createdAt: Date },
): Promise<string> {
  const position = await prisma.payRun.count({
    where: {
      companyId,
      status: "FINALIZED",
      OR: [
        { payDate: { lt: payRun.payDate } },
        { payDate: payRun.payDate, createdAt: { lte: payRun.createdAt } },
      ],
    },
  });
  const sequence = ((Math.max(position, 1) - 1) % 9999) + 1;
  return String(sequence).padStart(4, "0");
}

async function loadEftContext(payRunId: string): Promise<{
  ctx: EftContext;
  profileProblems: string[];
}> {
  const { companyId } = await requireCompany();

  const payRun = await prisma.payRun.findUnique({
    where: { id: payRunId },
    include: {
      items: {
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, bankEncrypted: true },
          },
        },
        orderBy: { employee: { lastName: "asc" } },
      },
    },
  });

  if (!payRun || payRun.companyId !== companyId || payRun.status !== "FINALIZED") {
    throw new Error("Pay run not found or not finalized.");
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      eftOriginatorName: true,
      eftOriginatorId: true,
      eftDataCentre: true,
      eftInstitution: true,
      eftTransit: true,
      eftAccount: true,
    },
  });
  if (!company) throw new Error("Company not found.");

  const problems = originatorProfileProblems(company);
  if (problems.length > 0) {
    return {
      profileProblems: problems,
      ctx: {
        payDate: payRun.payDate,
        fileCreationNumber: "0000",
        originator: {} as Cpa005Originator,
        payments: [],
        namesByRef: new Map(),
        payableRefs: new Set(),
        preExcluded: [],
      },
    };
  }

  /*
   * Originator mapping (Company → Cpa005Originator). Every value comes
   * from the bank-issued profile saved in Settings → Payroll; the checks
   * above guarantee each one is present and well-formed, so the builder's
   * own validation below is a backstop, not the user interface.
   *   clientNumber        ← Company.eftOriginatorId (bank-assigned, ≤10 AN)
   *   originatorShortName ← Company.eftOriginatorName (≤15, form-limited;
   *                         appears on employees' bank statements)
   *   originatorLongName  ← Company.name, truncated to the 30-char field
   *   dataCentre          ← Company.eftDataCentre (bank-assigned, 5 digits)
   *   returnInstitution   ← Company.eftInstitution (3 digits)
   *   returnTransit       ← Company.eftTransit (5 digits)
   *   returnAccount       ← decrypt(Company.eftAccount) — stored AES-256-GCM
   *                         encrypted, same convention as Employee.bankEncrypted
   *   currency            ← "CAD" (this product files Canadian-dollar payroll)
   *   fileCreationNumber  ← sender-side rotating sequence (see above)
   */
  const originator: Cpa005Originator = {
    clientNumber: (company.eftOriginatorId as string).trim(),
    fileCreationNumber: await deriveFileCreationNumber(companyId, payRun),
    dataCentre: (company.eftDataCentre as string).trim(),
    currency: "CAD",
    originatorShortName: (company.eftOriginatorName as string).trim(),
    originatorLongName: company.name.substring(0, 30),
    returnInstitution: (company.eftInstitution as string).trim(),
    returnTransit: (company.eftTransit as string).trim(),
    returnAccount: decryptReturnAccount(company) as string,
  };

  const payments: Cpa005Payment[] = [];
  const namesByRef = new Map<string, string>();
  const payableRefs = new Set<string>();
  const preExcluded: EftExcludedEmployee[] = [];

  for (const item of payRun.items) {
    const employeeName = `${item.employee.firstName} ${item.employee.lastName}`;
    // Cross-reference: the employee id, truncated to 19 chars to match the
    // builder's 19-AN segment field (the builder truncates AN fields to
    // width; doing it here keeps problem reports keyed consistently).
    const employeeRef = item.employee.id.substring(0, 19);
    namesByRef.set(employeeRef, employeeName);

    if (item.netPay <= 0) {
      preExcluded.push({ employeeName, reasons: ["net pay is zero or negative"] });
      continue;
    }
    payableRefs.add(employeeRef);

    // Banking: the shared parser (lib/banking.ts) reads the encrypted
    // Employee.bankEncrypted JSON {institution, transit, account}. When
    // it is missing or undecryptable the payment goes to the builder
    // with EMPTY banking fields on purpose — the builder excludes it
    // and its reasons are reported to the user (the builder's payee
    // validation IS the completeness rule lib/banking.ts mirrors).
    // Banking is never defaulted or fabricated here.
    const bank = parseBankDetails(item.employee.bankEncrypted);
    const institution = bank?.institution ?? "";
    const transit = bank?.transit ?? "";
    const account = bank?.account ?? "";

    payments.push({
      employeeRef,
      payeeName: employeeName,
      institution,
      transit,
      account,
      amountCents: Math.round(item.netPay * 100),
      dueDate: payRun.payDate,
    });
  }

  return {
    profileProblems: [],
    ctx: {
      payDate: payRun.payDate,
      fileCreationNumber: originator.fileCreationNumber,
      originator,
      payments,
      namesByRef,
      payableRefs,
      preExcluded,
    },
  };
}

/** Run the pure builder over a loaded context and shape the audit lists. */
function buildFromContext(ctx: EftContext): {
  content: string;
  included: EftIncludedEmployee[];
  excluded: EftExcludedEmployee[];
  includedCount: number;
  totalCents: number;
} {
  let result;
  try {
    result = buildCpa005File(ctx.originator, ctx.payments, new Date());
  } catch (e) {
    // Backstop: the pre-checks above should make an originator throw
    // unreachable, but if the builder still rejects the profile, surface
    // its message as a Settings problem rather than a stack-flavoured 500.
    throw new Error(
      `Your EFT originator profile in Settings → Payroll cannot be used: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const reasonsByRef = new Map<string, string[]>();
  for (const problem of result.problems) {
    const list = reasonsByRef.get(problem.employeeRef) ?? [];
    list.push(problem.reason);
    reasonsByRef.set(problem.employeeRef, list);
  }

  const included: EftIncludedEmployee[] = [];
  const excluded: EftExcludedEmployee[] = [...ctx.preExcluded];
  for (const payment of ctx.payments) {
    const employeeName = ctx.namesByRef.get(payment.employeeRef) ?? payment.employeeRef;
    const reasons = reasonsByRef.get(payment.employeeRef);
    if (reasons) {
      excluded.push({ employeeName, reasons });
    } else {
      included.push({ employeeName, amountCents: payment.amountCents });
    }
  }

  return {
    content: result.content,
    included,
    excluded,
    includedCount: result.includedCount,
    totalCents: result.totalCents,
  };
}

/* ------------------------------------------------------------------ */
/* Public actions                                                      */
/* ------------------------------------------------------------------ */

/** Generate the CPA-005 file for one finalized pay run. */
export async function generateEftFile(payRunId: string): Promise<EftFileResult> {
  const { ctx, profileProblems } = await loadEftContext(payRunId);
  if (profileProblems.length > 0) throw profileError(profileProblems);

  const built = buildFromContext(ctx);
  return {
    filename: `eft-payrun-${ctx.payDate}.txt`,
    content: built.content,
    includedCount: built.includedCount,
    totalCents: built.totalCents,
    excluded: built.excluded,
  };
}

/**
 * Dry-run preview for the Direct Deposit page: who WILL be in the file
 * and who will be excluded (with reasons), without the user downloading
 * anything. The builder is pure, so a preview build has no side effects.
 * An incomplete originator profile is reported via `profileProblems`
 * instead of throwing, so the page can render its Settings prompt state.
 */
export async function previewEftFile(payRunId: string): Promise<EftPreviewResult> {
  const { ctx, profileProblems } = await loadEftContext(payRunId);
  if (profileProblems.length > 0) {
    return { profileProblems, included: [], excluded: [], includedCount: 0, totalCents: 0 };
  }
  const built = buildFromContext(ctx);
  return {
    profileProblems: [],
    included: built.included,
    excluded: built.excluded,
    includedCount: built.includedCount,
    totalCents: built.totalCents,
  };
}

/* ------------------------------------------------------------------ */
/* Settings → Payroll: save the originator profile                     */
/* ------------------------------------------------------------------ */

/**
 * Save the EFT originator profile from Settings → Payroll.
 *
 * All values are bank-issued and validated server-side against the same
 * rules the CPA-005 builder enforces. The account number is stored
 * ENCRYPTED (AES-256-GCM via lib/encryption) in Company.eftAccount —
 * the same convention as Employee.bankEncrypted — and is never rendered
 * back in full. Leaving the account field blank keeps the stored value.
 */
export async function updateEftOriginatorProfile(formData: FormData) {
  const { companyId } = await requireCompany();

  const shortName = ((formData.get("eftOriginatorName") as string) || "").trim();
  const originatorId = ((formData.get("eftOriginatorId") as string) || "").trim();
  const dataCentre = ((formData.get("eftDataCentre") as string) || "").trim();
  const institution = ((formData.get("eftInstitution") as string) || "").trim();
  const transit = ((formData.get("eftTransit") as string) || "").trim();
  const accountRaw = ((formData.get("eftAccount") as string) || "").trim();

  if (!shortName || shortName.length > 15) {
    throw new Error("Originator short name is required and must be at most 15 characters.");
  }
  if (!originatorId || originatorId.length > 10 || !/^[A-Za-z0-9]+$/.test(originatorId)) {
    throw new Error("Originator ID / client number is required, alphanumeric, at most 10 characters (as assigned by your bank).");
  }
  if (!/^\d{5}$/.test(dataCentre)) {
    throw new Error("Data centre must be exactly 5 digits (as assigned by your bank).");
  }
  if (!/^\d{3}$/.test(institution)) {
    throw new Error("Institution number must be exactly 3 digits.");
  }
  if (!/^\d{5}$/.test(transit)) {
    throw new Error("Transit number must be exactly 5 digits.");
  }

  const data: {
    eftOriginatorName: string;
    eftOriginatorId: string;
    eftDataCentre: string;
    eftInstitution: string;
    eftTransit: string;
    eftAccount?: string;
  } = {
    eftOriginatorName: shortName,
    eftOriginatorId: originatorId,
    eftDataCentre: dataCentre,
    eftInstitution: institution,
    eftTransit: transit,
  };

  if (accountRaw) {
    const account = accountRaw.replace(/[\s-]/g, "");
    if (!/^\d+$/.test(account) || account.length > 12) {
      throw new Error("Account number must be numeric, at most 12 digits.");
    }
    data.eftAccount = encrypt(account);
  } else {
    // Blank means "keep the current account" — but a first-time save
    // with no stored account is an incomplete profile, so refuse it.
    const existing = await prisma.company.findUnique({
      where: { id: companyId },
      select: { eftAccount: true },
    });
    if (!existing?.eftAccount) {
      throw new Error("Account number is required.");
    }
  }

  await prisma.company.update({ where: { id: companyId }, data });

  revalidatePath("/company");
  revalidatePath("/reports/direct-deposit");
}
