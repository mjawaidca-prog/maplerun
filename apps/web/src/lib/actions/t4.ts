"use server";

/**
 * T4 slip generation — per-employee annual summary from finalized pay runs.
 *
 * CRA T4 boxes:
 *   14 — Employment income (total gross)
 *   16 — Employee CPP contributions
 *   16A — Employee CPP2 contributions
 *   18 — Employee EI premiums
 *   22 — Income tax deducted (federal + provincial)
 *   24 — EI insurable earnings
 *   26 — CPP/QPP pensionable earnings
 *   28 — Exempt (CPP/EI) — always blank for now
 *   29 — Employment code
 *   44 — Union dues — always blank
 *   46 — Charitable donations
 *   50 — RPP or DPSP registration number
 *   52 — Pension adjustment
 *   55 — Employee's PPIP premiums
 *   56 — PPIP insurable earnings
 */

import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/session";

export type T4Slip = {
  employeeId: string;
  employeeName: string;
  sinMasked: string;
  province: string;
  box14: number; // Employment income
  box16: number; // Employee CPP
  box16A: number; // Employee CPP2
  box18: number; // Employee EI
  box22: number; // Income tax deducted
  box24: number; // EI insurable earnings
  box26: number; // CPP pensionable earnings
  box55: number; // QPIP premiums (QC only)
  box56: number; // QPIP insurable earnings (QC only)
  payPeriods: number;
};

export type T4Report = {
  year: number;
  companyName: string;
  slips: T4Slip[];
  totals: {
    employees: number;
    box14: number;
    box16: number;
    box16A: number;
    box18: number;
    box22: number;
    box24: number;
    box26: number;
  };
};

export async function getT4Report(year: number): Promise<T4Report> {
  const { companyId } = await requireCompany();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  // Get all finalized pay runs for the year
  const payRuns = await prisma.payRun.findMany({
    where: {
      companyId,
      status: "FINALIZED",
      payDate: { startsWith: String(year) },
    },
    include: {
      items: {
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, province: true } },
        },
      },
    },
    orderBy: { payDate: "asc" },
  });

  // Aggregate per employee
  const empMap = new Map<string, T4Slip>();

  for (const run of payRuns) {
    for (const item of run.items) {
      let slip = empMap.get(item.employeeId);
      if (!slip) {
        slip = {
          employeeId: item.employeeId,
          employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
          sinMasked: "•••-•••-•••",
          province: item.employee.province ?? "ON",
          box14: 0,
          box16: 0,
          box16A: 0,
          box18: 0,
          box22: 0,
          box24: 0,
          box26: 0,
          box55: 0,
          box56: 0,
          payPeriods: 0,
        };
        empMap.set(item.employeeId, slip);
      }

      slip.box14 += item.gross;
      slip.box16 += item.cpp;
      slip.box16A += item.cpp2;
      slip.box18 += item.ei;
      slip.box22 += item.federalTax + item.provincialTax;
      slip.box24 += item.ei > 0 ? item.gross : 0;
      slip.box26 += item.cpp > 0 ? item.gross : 0;
      slip.payPeriods += 1;
    }
  }

  const slips = Array.from(empMap.values()).map((s) => ({
    ...s,
    box14: round2(s.box14),
    box16: round2(s.box16),
    box16A: round2(s.box16A),
    box18: round2(s.box18),
    box22: round2(s.box22),
    box24: round2(s.box24),
    box26: round2(s.box26),
    box55: round2(s.box55),
    box56: round2(s.box56),
  }));

  const totals = {
    employees: slips.length,
    box14: round2(slips.reduce((s, sl) => s + sl.box14, 0)),
    box16: round2(slips.reduce((s, sl) => s + sl.box16, 0)),
    box16A: round2(slips.reduce((s, sl) => s + sl.box16A, 0)),
    box18: round2(slips.reduce((s, sl) => s + sl.box18, 0)),
    box22: round2(slips.reduce((s, sl) => s + sl.box22, 0)),
    box24: round2(slips.reduce((s, sl) => s + sl.box24, 0)),
    box26: round2(slips.reduce((s, sl) => s + sl.box26, 0)),
  };

  return { year, companyName: company?.name ?? "MapleRun", slips, totals };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
