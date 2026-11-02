"use server";

/**
 * Server actions for payroll runs.
 *
 * Flow: select pay group → load employees → calculate via tax engine →
 * preview → finalize (immutable, updates YTD ledgers).
 */

import { requireCompany } from "@/lib/session";
import { trialGate, trialBlockMessage } from "@/lib/trial";
import { prisma } from "@/lib/prisma";
import {
  calculatePay,
  ZERO_YTD,
  type PayResult,
  type ProvinceCode,
  type PayFrequency,
  type EmployeeYtd,
} from "@maplerun/tax-engine";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { syncPayRun, voidPayRunSync } from "@/lib/ledgerpro-sync";
import { ledgerProSyncDeps } from "@/lib/ledgerpro-store";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PayRunPreviewItem = {
  employeeId: string;
  employeeName: string;
  gross: number;
  result: PayResult;
  ytdBefore: EmployeeYtd;
  hours: number;
  vacationPay: number;
  vacationRate: number;
  bonus: number;
};

export type PayRunPreview = {
  payGroupName: string;
  payDate: string;
  frequency: PayFrequency;
  province: ProvinceCode;
  items: PayRunPreviewItem[];
  totals: {
    gross: number;
    cpp: number;
    cpp2: number;
    ei: number;
    federalTax: number;
    provincialTax: number;
    deductions: number;
    netPay: number;
    employerCpp: number;
    employerCpp2: number;
    employerEi: number;
    employerTotal: number;
  };
};

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Build a preview for a pay run — calculates deductions for all active
 * employees in the selected pay group. Does NOT save anything.
 */
export async function previewPayRun(formData: FormData): Promise<PayRunPreview> {
  const { companyId } = await requireCompany();
  return computePayRun(companyId, formData);
}

/**
 * The single calculation path for a pay run, shared by preview AND
 * finalize (Wave 1 PR C). Takes the run INPUTS (pay group, pay date,
 * per-employee gross/hours/bonus/vacation) and computes every figure on
 * the server through the tax engine. Finalize persists ONLY what this
 * function computed — client-posted totals are never read.
 */
async function computePayRun(companyId: string, formData: FormData): Promise<PayRunPreview> {

  const payGroupId = formData.get("payGroupId") as string;
  const payDate = formData.get("payDate") as string;
  const grossAmountsStr = formData.get("grossAmounts") as string;

  if (!payGroupId || !payDate || !grossAmountsStr) {
    throw new Error("Pay group, pay date, and gross amounts are required.");
  }

  // Verify pay group ownership
  const payGroup = await prisma.payGroup.findUnique({ where: { id: payGroupId } });
  if (!payGroup || payGroup.companyId !== companyId) {
    throw new Error("Invalid pay group.");
  }

  // Parse gross amounts per employee (JSON: { [employeeId]: amount })
  const grossAmounts: Record<string, number> = JSON.parse(grossAmountsStr);

  // Parse hours, bonus, and vacation data from wizard
  const hoursStr = formData.get("hours") as string;
  const vacationStr = formData.get("vacation") as string;
  const bonusStr = formData.get("bonus") as string;
  const hoursData: Record<string, number> = hoursStr ? JSON.parse(hoursStr) : {};
  const vacationData: Record<string, { enabled: boolean; rate: number; amount: number }> = vacationStr ? JSON.parse(vacationStr) : {};
  const bonusData: Record<string, number> = bonusStr ? JSON.parse(bonusStr) : {};

  // Load active employees with YTD and TD1.
  // Wave 1 pay-group scoping rule: an employee assigned to THIS pay group
  // is in scope; an employee assigned to a DIFFERENT group is excluded;
  // an unassigned employee (payGroupId NULL — every employee created
  // before Wave 1, and any not yet assigned) stays in scope for every
  // group's runs until they are assigned. This keeps all pre-Wave-1
  // companies behaving exactly as before (their employees are unassigned)
  // while making assignment meaningful the moment it is used.
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      active: true,
      OR: [{ payGroupId }, { payGroupId: null }],
    },
    include: {
      td1Profiles: { where: { year: 2026 }, take: 1 },
      ytdLedgers: { where: { year: 2026 }, take: 1 },
    },
    orderBy: { lastName: "asc" },
  });

  const items: PayRunPreviewItem[] = [];
  const totals = {
    gross: 0,
    cpp: 0,
    cpp2: 0,
    ei: 0,
    federalTax: 0,
    provincialTax: 0,
    deductions: 0,
    netPay: 0,
    employerCpp: 0,
    employerCpp2: 0,
    employerEi: 0,
    employerTotal: 0,
  };

  const freqMap: Record<string, PayFrequency> = {
    WEEKLY: "weekly",
    BIWEEKLY: "biweekly",
    SEMIMONTHLY: "semimonthly",
    MONTHLY: "monthly",
  };

  const frequency = freqMap[payGroup.frequency] ?? "biweekly";
  const province = payGroup.defaultProvince as ProvinceCode;

  for (const emp of employees) {
    const gross = grossAmounts[emp.id];
    if (gross === undefined || gross <= 0) continue;

    const td1 = emp.td1Profiles[0];
    const ytdLedger = emp.ytdLedgers[0];

    const ytd: EmployeeYtd = ytdLedger
      ? {
          pensionableEarnings: ytdLedger.pensionableEarnings,
          cpp: ytdLedger.cpp,
          cpp2: ytdLedger.cpp2,
          insurableEarnings: ytdLedger.insurableEarnings,
          ei: ytdLedger.ei,
        }
      : { ...ZERO_YTD };

    // Apply bonus and vacation pay — add to gross income before calculation
    const empVacation = vacationData[emp.id];
    const bonusAmount = bonusData[emp.id] ?? 0;
    const vacationAmount = empVacation?.amount ?? 0;
    const effectiveGross = gross + bonusAmount + vacationAmount;

    const result = calculatePay({
      payDate,
      province,
      frequency,
      grossPeriodIncome: effectiveGross,
      federalClaim: td1?.federalClaim ?? undefined,
      provincialClaim: td1?.provincialClaim ?? undefined,
      cppExempt: td1?.cppExempt ?? false,
      eiExempt: td1?.eiExempt ?? false,
      ytd,
    });

    items.push({
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      gross: effectiveGross,
      result,
      ytdBefore: ytd,
      hours: hoursData[emp.id] ?? 0,
      vacationPay: vacationAmount,
      vacationRate: empVacation?.rate ?? 0,
      bonus: bonusAmount,
    });

    totals.gross += result.gross;
    totals.cpp += result.cpp;
    totals.cpp2 += result.cpp2;
    totals.ei += result.ei;
    totals.federalTax += result.federalTax;
    totals.provincialTax += result.provincialTax;
    totals.deductions += result.totalDeductions;
    totals.netPay += result.netPay;
    totals.employerCpp += result.employer.cpp;
    totals.employerCpp2 += result.employer.cpp2;
    totals.employerEi += result.employer.ei;
    totals.employerTotal += result.employer.total;
  }

  return {
    payGroupName: payGroup.name,
    payDate,
    frequency,
    province,
    items,
    totals,
  };
}

/**
 * Finalize a pay run — create immutable PayRun + PayRunItem records
 * and update each employee's YTD ledger.
 *
 * Wave 1 PR C (the trust fix): finalize accepts the run INPUTS — the
 * same fields previewPayRun takes — and recomputes every figure on the
 * server via computePayRun. Any client-posted totals or "preview" JSON
 * are ignored entirely; what persists is exactly what the tax engine
 * computed here, from the inputs, against current YTD/TD1 state.
 */
export async function finalizePayRun(formData: FormData) {
  const { companyId } = await requireCompany();

  const payGroupId = formData.get("payGroupId") as string;
  const payDate = formData.get("payDate") as string;
  const actualPayDate = (formData.get("actualPayDate") as string) || payDate;

  if (!payGroupId || !payDate) {
    throw new Error("Missing required fields.");
  }

  // Server-side recompute from inputs (also verifies pay-group
  // ownership). Nothing in the request body is trusted for figures.
  const preview = await computePayRun(companyId, formData);
  if (preview.items.length === 0) {
    throw new Error("Nothing to finalize — no employees with gross pay in this run.");
  }

  // Free trial gate — trialEndsAt (14-day period) + pay-run cap, via the
  // shared helper in lib/trial. The New Pay Run page uses the same helper
  // to explain the state up front; this throw is the server-side backstop
  // (promo users, trialEndsAt = null, are never gated).
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { plan: true, freePayRunsUsed: true, maxFreePayRuns: true, trialEndsAt: true } });
  const blockMessage = trialBlockMessage(
    trialGate({
      trialEndsAt: company?.trialEndsAt ?? null,
      freePayRunsUsed: company?.freePayRunsUsed ?? 0,
      maxFreePayRuns: company?.maxFreePayRuns ?? 2,
    }),
  );
  if (blockMessage) throw new Error(blockMessage);

  // Create the pay run
  const payRun = await prisma.payRun.create({
    data: {
      companyId,
      payGroupId,
      payDate,
      actualPayDate: actualPayDate || null,
      status: "FINALIZED",
      totalGross: preview.totals.gross,
      totalCpp: preview.totals.cpp,
      totalCpp2: preview.totals.cpp2,
      totalEi: preview.totals.ei,
      totalFederalTax: preview.totals.federalTax,
      totalProvincialTax: preview.totals.provincialTax,
      totalDeductions: preview.totals.deductions,
      totalNetPay: preview.totals.netPay,
      totalEmployerCpp: preview.totals.employerCpp,
      totalEmployerCpp2: preview.totals.employerCpp2,
      totalEmployerEi: preview.totals.employerEi,
      totalEmployerCost: preview.totals.employerTotal,
      itemCount: preview.items.length,
      finalizedAt: new Date(),
    },
  });

  // Create items and update YTD ledgers
  for (const item of preview.items) {
    const newYtd = item.result.newYtd;
    // Safety: ensure all values are defined numbers (JSON.parse may produce nulls)
    const n = (v: any, fallback = 0) => (typeof v === "number" ? v : fallback);

    await prisma.payRunItem.create({
      data: {
        payRunId: payRun.id,
        employeeId: item.employeeId,
        gross: n(item.result.gross),
        cpp: n(item.result.cpp),
        cpp2: n(item.result.cpp2),
        ei: n(item.result.ei),
        // Wave 1 Quebec split (dual-write): for QC runs the engine's
        // cpp/cpp2 ARE the QPP/QPP2 amounts; qpip is surfaced separately.
        // Legacy cpp/cpp2/ei keep holding the combined totals.
        qpp: preview.province === "QC" ? n(item.result.cpp) : 0,
        qpp2: preview.province === "QC" ? n(item.result.cpp2) : 0,
        qpip: n((item.result as any).qpip),
        federalTax: n(item.result.federalTax),
        provincialTax: n(item.result.provincialTax),
        totalDeductions: n(item.result.totalDeductions),
        netPay: n(item.result.netPay),
        employerCpp: n(item.result.employer?.cpp),
        employerCpp2: n(item.result.employer?.cpp2),
        employerEi: n(item.result.employer?.ei),
        employerTotal: n(item.result.employer?.total),
        ytdPensionable: n(newYtd?.pensionableEarnings),
        ytdCpp: n(newYtd?.cpp),
        ytdCpp2: n(newYtd?.cpp2),
        ytdInsurable: n(newYtd?.insurableEarnings),
        ytdEi: n(newYtd?.ei),
        warnings: Array.isArray(item.result.warnings) ? item.result.warnings.join("; ") : "",
        hours: n(item.hours, 0),
        vacationPay: n(item.vacationPay, 0),
        vacationPayRate: n(item.vacationRate, 0),
        bonus: n(item.bonus, 0),
      },
    });

    // Upsert YTD ledger
    await prisma.ytdLedger.upsert({
      where: {
        employeeId_year: {
          employeeId: item.employeeId,
          year: 2026,
        },
      },
      create: {
        employeeId: item.employeeId,
        year: 2026,
        pensionableEarnings: newYtd.pensionableEarnings,
        cpp: newYtd.cpp,
        cpp2: newYtd.cpp2,
        insurableEarnings: newYtd.insurableEarnings,
        ei: newYtd.ei,
      },
      update: {
        pensionableEarnings: newYtd.pensionableEarnings,
        cpp: newYtd.cpp,
        cpp2: newYtd.cpp2,
        insurableEarnings: newYtd.insurableEarnings,
        ei: newYtd.ei,
      },
    });
  }

  // Increment free trial counter
  await prisma.company.update({
    where: { id: companyId },
    data: { freePayRunsUsed: { increment: 1 } },
  });

  // LedgerPro sync (M4) — AFTER all persistence above completes, and only
  // when the company has a connection with sync enabled (checked inside
  // syncPayRun). Failure-isolated: syncPayRun never throws, and this extra
  // guard means a sync problem can never roll back or block finalization —
  // a FAILED/BLOCKED sync record is left behind for Retry instead.
  try {
    await syncPayRun(ledgerProSyncDeps, payRun.id);
  } catch {
    // Intentionally swallowed — see above.
  }

  revalidatePath("/payroll");
  redirect("/payroll");
}

/**
 * List pay runs for the current company.
 */
export async function getPayRuns() {
  const { companyId } = await requireCompany();

  return prisma.payRun.findMany({
    where: { companyId },
    include: { payGroup: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/**
 * Get a single pay run with all items.
 */
/**
 * Reverse a finalized pay run (Wave 1 PR D) — the supported correction
 * path, replacing delete-and-lose-the-trail:
 *  - the run row is KEPT, marked REVERSED with reversedAt set, so the
 *    audit trail survives; every report (they all filter FINALIZED)
 *    stops counting it immediately;
 *  - each employee's YTD ledger is decremented by exactly the
 *    increments this run added — its items' stored YTD-after minus the
 *    YTD-after of the employee's previous finalized item (finalization
 *    order). Reversing in LIFO order restores the ledger exactly;
 *    reversing an earlier run while a later one stands removes exactly
 *    this run's own contribution (the later run's stored snapshots stay
 *    as historical record);
 *  - vacation accrued by this run (PayRunItem.vacationAccruedCents,
 *    Wave 1 PR E) is subtracted back from the employee's balance;
 *  - a SYNCED LedgerPro journal is voided FIRST (the M5 rule): if the
 *    void fails, the reversal is blocked and nothing changes;
 *  - EFT: files are generated on demand from FINALIZED runs only, so
 *    the status flip voids this run for direct deposit —
 *    generateEftFile refuses a REVERSED run. (There is no batch table.)
 * The trial free-run counter is NOT refunded — a finalize consumed it.
 */
export async function reversePayRun(formData: FormData) {
  "use server";
  const { companyId } = await requireCompany();
  const id = formData.get("id") as string;
  if (!id) throw new Error("Pay run ID required.");
  const run = await prisma.payRun.findUnique({ where: { id }, include: { items: true } });
  if (!run || run.companyId !== companyId) throw new Error("Pay run not found.");
  if (run.status !== "FINALIZED") {
    throw new Error("Only a finalized pay run can be reversed.");
  }

  // LedgerPro void-then-reverse (M5 rule): if this run was posted to
  // LedgerPro, reverse that journal FIRST and only proceed once the
  // void confirms. If the void cannot complete, BLOCK the reversal —
  // never leave a live LedgerPro journal pointing at a reversed run.
  const syncRecord = await prisma.ledgerProSyncRecord.findUnique({ where: { payRunId: id } });
  if (syncRecord?.status === "SYNCED" && syncRecord.ledgerEntryId) {
    const voidResult = await voidPayRunSync(ledgerProSyncDeps, id);
    if (voidResult.outcome === "failed") {
      throw new Error(
        `This pay run was posted to LedgerPro on ${syncRecord.syncedAt ? syncRecord.syncedAt.toISOString().slice(0, 10) : "an earlier date"}, and that journal could not be reversed (${voidResult.error}). Reversal blocked — fix the LedgerPro connection or period, then try again.`,
      );
    }
  }

  const year = Number(run.payDate.slice(0, 4)) || 2026;

  // Roll back YTD by exactly this run's own increments, per employee.
  for (const item of run.items) {
    // Baseline: the YTD snapshot of the employee's previous finalized
    // item (finalization order: finalizedAt, then createdAt).
    const prev = await prisma.payRunItem.findFirst({
      where: {
        employeeId: item.employeeId,
        payRunId: { not: id },
        payRun: {
          status: "FINALIZED",
          companyId,
          OR: [
            { finalizedAt: { lt: run.finalizedAt! } },
            { finalizedAt: run.finalizedAt!, createdAt: { lt: run.createdAt } },
          ],
        },
      },
      orderBy: [{ payRun: { finalizedAt: "desc" } }, { payRun: { createdAt: "desc" } }],
      select: { ytdPensionable: true, ytdCpp: true, ytdCpp2: true, ytdInsurable: true, ytdEi: true },
    });

    const ledger = await prisma.ytdLedger.findUnique({
      where: { employeeId_year: { employeeId: item.employeeId, year } },
    });
    if (ledger) {
      await prisma.ytdLedger.update({
        where: { employeeId_year: { employeeId: item.employeeId, year } },
        data: {
          pensionableEarnings: ledger.pensionableEarnings - (item.ytdPensionable - (prev?.ytdPensionable ?? 0)),
          cpp: ledger.cpp - (item.ytdCpp - (prev?.ytdCpp ?? 0)),
          cpp2: ledger.cpp2 - (item.ytdCpp2 - (prev?.ytdCpp2 ?? 0)),
          insurableEarnings: ledger.insurableEarnings - (item.ytdInsurable - (prev?.ytdInsurable ?? 0)),
          ei: ledger.ei - (item.ytdEi - (prev?.ytdEi ?? 0)),
        },
      });
    }

    // Unwind vacation accrued by this run (no-op until PR E lands —
    // every item carries 0 before accrual wiring exists).
    if (item.vacationAccruedCents > 0) {
      await prisma.employee.update({
        where: { id: item.employeeId },
        data: { vacationBalanceCents: { decrement: item.vacationAccruedCents } },
      });
    }
  }

  await prisma.payRun.update({
    where: { id },
    data: { status: "REVERSED", reversedAt: new Date() },
  });

  revalidatePath("/payroll");
  revalidatePath(`/payroll/${id}`);
}

export async function deletePayRun(formData: FormData) {
  "use server";
  const { companyId } = await requireCompany();
  const id = formData.get("id") as string;
  if (!id) throw new Error("Pay run ID required.");
  const run = await prisma.payRun.findUnique({ where: { id } });
  if (!run || run.companyId !== companyId) throw new Error("Pay run not found.");

  // Wave 1 PR D: a FINALIZED run can no longer be hard-deleted — that
  // path silently orphaned YTD increments. Reverse it first (the
  // reversal unwinds YTD, vacation and the LedgerPro journal exactly);
  // drafts and already-reversed runs may still be deleted.
  if (run.status === "FINALIZED") {
    throw new Error(
      "This pay run is finalized and can't be deleted directly. Reverse it first — reversal keeps the audit trail and unwinds its YTD totals and LedgerPro journal exactly. You can delete the run afterwards if you still need to.",
    );
  }

  // LedgerPro void-then-delete (M5): if this run was posted to LedgerPro,
  // reverse that journal FIRST and only delete once the void confirms.
  // If the void cannot complete, BLOCK the deletion — never leave a live
  // LedgerPro journal pointing at a deleted pay run.
  const syncRecord = await prisma.ledgerProSyncRecord.findUnique({ where: { payRunId: id } });
  if (syncRecord?.status === "SYNCED" && syncRecord.ledgerEntryId) {
    const voidResult = await voidPayRunSync(ledgerProSyncDeps, id);
    if (voidResult.outcome === "failed") {
      throw new Error(
        `This pay run was posted to LedgerPro on ${syncRecord.syncedAt ? syncRecord.syncedAt.toISOString().slice(0, 10) : "an earlier date"}, and that journal could not be reversed (${voidResult.error}). Delete blocked — fix the LedgerPro connection or period, then try again.`,
      );
    }
  }

  await prisma.payRun.delete({ where: { id } });
  revalidatePath("/payroll");
  redirect("/payroll");
}

export async function getPayRun(id: string) {
  const { companyId } = await requireCompany();

  const payRun = await prisma.payRun.findUnique({
    where: { id },
    include: {
      payGroup: { select: { name: true, frequency: true, defaultProvince: true } },
      ledgerProSync: true,
      items: {
        include: {
          employee: { select: { firstName: true, lastName: true } },
        },
        orderBy: { employee: { lastName: "asc" } },
      },
    },
  });

  if (!payRun || payRun.companyId !== companyId) {
    throw new Error("Pay run not found.");
  }

  return payRun;
}
