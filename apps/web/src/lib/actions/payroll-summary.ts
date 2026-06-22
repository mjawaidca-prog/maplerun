"use server";

/**
 * Payroll Summary report — aggregated totals + per-employee breakdown.
 */

import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/session";

export type SummaryEmployee = {
  id: string;
  name: string;
  initial: string;
  gross: number;
  cpp: number;
  ei: number;
  federalTax: number;
  provincialTax: number;
  totalDeductions: number;
  netPay: number;
  employerCpp: number;
  employerEi: number;
  employerTotal: number;
};

export type PayrollSummary = {
  companyName: string;
  totals: {
    gross: number;
    cpp: number;
    ei: number;
    federalTax: number;
    provincialTax: number;
    totalDeductions: number;
    netPay: number;
    employerCpp: number;
    employerEi: number;
    employerTotal: number;
    runs: number;
    employees: number;
  };
  employees: SummaryEmployee[];
};

export async function getPayrollSummary(payGroupId?: string): Promise<PayrollSummary> {
  const { companyId } = await requireCompany();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  const runs = await prisma.payRun.findMany({
    where: {
      companyId,
      status: "FINALIZED",
      ...(payGroupId ? { payGroupId } : {}),
    },
    include: {
      items: {
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { payDate: "desc" },
  });

  const empMap = new Map<string, SummaryEmployee>();

  for (const run of runs) {
    for (const item of run.items) {
      let entry = empMap.get(item.employeeId);
      if (!entry) {
        entry = {
          id: item.employeeId,
          name: `${item.employee.firstName} ${item.employee.lastName}`,
          initial: item.employee.firstName[0],
          gross: 0, cpp: 0, ei: 0, federalTax: 0, provincialTax: 0,
          totalDeductions: 0, netPay: 0, employerCpp: 0, employerEi: 0, employerTotal: 0,
        };
        empMap.set(item.employeeId, entry);
      }
      entry.gross += item.gross;
      entry.cpp += item.cpp;
      entry.ei += item.ei;
      entry.federalTax += item.federalTax;
      entry.provincialTax += item.provincialTax;
      entry.totalDeductions += item.totalDeductions;
      entry.netPay += item.netPay;
      entry.employerCpp += item.employerCpp;
      entry.employerEi += item.employerEi;
      entry.employerTotal += item.employerTotal;
    }
  }

  const employees = Array.from(empMap.values()).map((e) => ({
    ...e,
    gross: r2(e.gross), cpp: r2(e.cpp), ei: r2(e.ei),
    federalTax: r2(e.federalTax), provincialTax: r2(e.provincialTax),
    totalDeductions: r2(e.totalDeductions), netPay: r2(e.netPay),
    employerCpp: r2(e.employerCpp), employerEi: r2(e.employerEi), employerTotal: r2(e.employerTotal),
  }));

  const totals = {
    gross: r2(employees.reduce((s, e) => s + e.gross, 0)),
    cpp: r2(employees.reduce((s, e) => s + e.cpp, 0)),
    ei: r2(employees.reduce((s, e) => s + e.ei, 0)),
    federalTax: r2(employees.reduce((s, e) => s + e.federalTax, 0)),
    provincialTax: r2(employees.reduce((s, e) => s + e.provincialTax, 0)),
    totalDeductions: r2(employees.reduce((s, e) => s + e.totalDeductions, 0)),
    netPay: r2(employees.reduce((s, e) => s + e.netPay, 0)),
    employerCpp: r2(employees.reduce((s, e) => s + e.employerCpp, 0)),
    employerEi: r2(employees.reduce((s, e) => s + e.employerEi, 0)),
    employerTotal: r2(employees.reduce((s, e) => s + e.employerTotal, 0)),
    runs: runs.length,
    employees: employees.length,
  };

  return { companyName: company?.name ?? "Nexvar Pay", totals, employees };
}

function r2(n: number): number { return Math.round(n * 100) / 100; }
