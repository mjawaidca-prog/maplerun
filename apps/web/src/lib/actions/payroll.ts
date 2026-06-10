"use server";

/**
 * Server actions for payroll runs.
 *
 * Flow: select pay group → load employees → calculate via tax engine →
 * preview → finalize (immutable, updates YTD ledgers).
 */

import { requireCompany } from "@/lib/session";
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

// ─── Types ────────────────────────────────────────────────────────────────────

export type PayRunPreviewItem = {
  employeeId: string;
  employeeName: string;
  gross: number;
  result: PayResult;
  ytdBefore: EmployeeYtd;
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

  // Load active employees with YTD and TD1
  const employees = await prisma.employee.findMany({
    where: { companyId, active: true },
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

    const result = calculatePay({
      payDate,
      province,
      frequency,
      grossPeriodIncome: gross,
      federalClaim: td1?.federalClaim ?? undefined,
      provincialClaim: td1?.provincialClaim ?? undefined,
      cppExempt: td1?.cppExempt ?? false,
      eiExempt: td1?.eiExempt ?? false,
      ytd,
    });

    items.push({
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      gross,
      result,
      ytdBefore: ytd,
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
 */
export async function finalizePayRun(formData: FormData) {
  const { companyId } = await requireCompany();

  const payGroupId = formData.get("payGroupId") as string;
  const payDate = formData.get("payDate") as string;
  const previewJson = formData.get("preview") as string;

  if (!payGroupId || !payDate || !previewJson) {
    throw new Error("Missing required fields.");
  }

  const preview: PayRunPreview = JSON.parse(previewJson);

  // Verify ownership
  const payGroup = await prisma.payGroup.findUnique({ where: { id: payGroupId } });
  if (!payGroup || payGroup.companyId !== companyId) {
    throw new Error("Invalid pay group.");
  }

  // Create the pay run
  const payRun = await prisma.payRun.create({
    data: {
      companyId,
      payGroupId,
      payDate,
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

    await prisma.payRunItem.create({
      data: {
        payRunId: payRun.id,
        employeeId: item.employeeId,
        gross: item.result.gross,
        cpp: item.result.cpp,
        cpp2: item.result.cpp2,
        ei: item.result.ei,
        federalTax: item.result.federalTax,
        provincialTax: item.result.provincialTax,
        totalDeductions: item.result.totalDeductions,
        netPay: item.result.netPay,
        employerCpp: item.result.employer.cpp,
        employerCpp2: item.result.employer.cpp2,
        employerEi: item.result.employer.ei,
        employerTotal: item.result.employer.total,
        ytdPensionable: newYtd.pensionableEarnings,
        ytdCpp: newYtd.cpp,
        ytdCpp2: newYtd.cpp2,
        ytdInsurable: newYtd.insurableEarnings,
        ytdEi: newYtd.ei,
        warnings: item.result.warnings.join("; "),
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

  revalidatePath("/app/payroll");
  redirect("/app/payroll");
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
export async function getPayRun(id: string) {
  const { companyId } = await requireCompany();

  const payRun = await prisma.payRun.findUnique({
    where: { id },
    include: {
      payGroup: { select: { name: true, frequency: true, defaultProvince: true } },
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
