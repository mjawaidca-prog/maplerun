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
 * This module computes ROE data from finalized pay runs for a given employee.
 * Insurable hours must be provided (not tracked automatically yet — Phase 4 MVP
 * uses a default assumption or explicit input).
 */

import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/session";
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
  block15C: RoePayPeriod[]; // Last 53 pay periods
  ytdAtTermination: EmployeeYtd;
  generatedAt: string;
};

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function generateRoe(
  employeeId: string,
  reasonCode: string,
  hoursPerPeriod?: Record<string, number>
): Promise<RoeData> {
  const { companyId } = await requireCompany();

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      ytdLedgers: { where: { year: 2026 }, take: 1 },
    },
  });

  if (!employee || employee.companyId !== companyId) {
    throw new Error("Employee not found.");
  }

  // Get all finalized pay run items for this employee
  const items = await prisma.payRunItem.findMany({
    where: {
      employeeId,
      payRun: { status: "FINALIZED", companyId },
    },
    include: {
      payRun: { select: { payDate: true } },
    },
    orderBy: { payRun: { payDate: "asc" } },
  });

  if (items.length === 0) {
    throw new Error("No finalized pay runs found for this employee.");
  }

  const firstItem = items[0]!;
  const lastItem = items[items.length - 1]!;

  // Compute insurable earnings (last 53 periods per CRA)
  const periods: RoePayPeriod[] = items.map((item) => ({
    periodEnd: item.payRun.payDate,
    hours: hoursPerPeriod?.[item.payRun.payDate] ?? 0,
    earnings: item.ei > 0 ? item.gross : 0, // Insurable if EI was deducted
  }));

  const totalHours = periods.reduce((s, p) => s + p.hours, 0);
  const totalEarnings = items.reduce((s, i) => s + (i.ei > 0 ? i.gross : 0), 0);

  const ytd = employee.ytdLedgers[0];

  return {
    employeeName: `${employee.firstName} ${employee.lastName}`,
    employeeId: employee.id,
    sinMasked: `•••${employee.sinEncrypted.slice(-3)}`, // Won't be actual SIN digits since encrypted
    firstWorkDate: firstItem.payRun.payDate,
    lastWorkDate: lastItem.payRun.payDate,
    finalPayDate: lastItem.payRun.payDate,
    reasonCode,
    block15A: totalHours,
    block15B: totalEarnings,
    block15C: periods,
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
  };
}

// ROE reason codes moved to a separate non-server file (lib/roe-constants.ts)
// because "use server" files can only export async functions.
export { ROE_REASON_CODES } from "@/lib/roe-constants";
