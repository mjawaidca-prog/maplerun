"use server";

/**
 * Reporting server actions — PD7A remittance, pay period summaries.
 */

import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Pd7aPeriod = {
  period: string; // e.g. "2026-01", "2026-Q1"
  payRuns: number;
  employees: number;
  employeeCpp: number;
  employeeCpp2: number;
  employeeEi: number;
  employerCpp: number;
  employerCpp2: number;
  employerEi: number;
  federalTax: number;
  provincialTax: number;
  incomeTax: number; // federal + provincial
  totalRemittance: number;
};

export type Pd7aReport = {
  year: number;
  periods: Pd7aPeriod[];
  totals: {
    payRuns: number;
    employeeCpp: number;
    employeeCpp2: number;
    employeeEi: number;
    employerCpp: number;
    employerCpp2: number;
    employerEi: number;
    federalTax: number;
    provincialTax: number;
    incomeTax: number;
    totalRemittance: number;
  };
};

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Generate a PD7A-style remittance report for a given year.
 * Groups finalized pay runs by month or quarter.
 */
export async function getPd7aReport(year: number, grouping: "monthly" | "quarterly" = "monthly"): Promise<Pd7aReport> {
  const { companyId } = await requireCompany();

  const payRuns = await prisma.payRun.findMany({
    where: {
      companyId,
      status: "FINALIZED",
      payDate: {
        startsWith: String(year),
      },
    },
    orderBy: { payDate: "asc" },
    include: {
      items: true,
    },
  });

  const periods: Pd7aPeriod[] = [];
  let totals = {
    payRuns: 0,
    employeeCpp: 0,
    employeeCpp2: 0,
    employeeEi: 0,
    employerCpp: 0,
    employerCpp2: 0,
    employerEi: 0,
    federalTax: 0,
    provincialTax: 0,
    incomeTax: 0,
    totalRemittance: 0,
  };

  // Group by period key
  const grouped: Record<string, typeof payRuns> = {};
  for (const pr of payRuns) {
    const key = periodKey(pr.payDate, grouping);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(pr);
  }

  for (const [period, runs] of Object.entries(grouped)) {
    const p: Pd7aPeriod = {
      period,
      payRuns: runs.length,
      employees: 0,
      employeeCpp: 0,
      employeeCpp2: 0,
      employeeEi: 0,
      employerCpp: 0,
      employerCpp2: 0,
      employerEi: 0,
      federalTax: 0,
      provincialTax: 0,
      incomeTax: 0,
      totalRemittance: 0,
    };

    for (const run of runs) {
      p.employees += run.itemCount;
      p.employeeCpp += run.totalCpp;
      p.employeeCpp2 += run.totalCpp2;
      p.employeeEi += run.totalEi;
      p.employerCpp += run.totalEmployerCpp;
      p.employerCpp2 += run.totalEmployerCpp2;
      p.employerEi += run.totalEmployerEi;
      p.federalTax += run.totalFederalTax;
      p.provincialTax += run.totalProvincialTax;
    }

    p.incomeTax = p.federalTax + p.provincialTax;

    // PD7A remittance = all source deductions: CPP + CPP2 + EI + income tax
    p.totalRemittance =
      p.employeeCpp + p.employerCpp +
      p.employeeCpp2 + p.employerCpp2 +
      p.employeeEi + p.employerEi +
      p.federalTax + p.provincialTax;

    // Round everything
    for (const k of Object.keys(p) as Array<keyof Pd7aPeriod>) {
      if (typeof p[k] === "number" && k !== "payRuns" && k !== "employees") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p as any)[k] = Math.round((p[k] as number) * 100) / 100;
      }
    }

    periods.push(p);

    totals.payRuns += p.payRuns;
    totals.employeeCpp += p.employeeCpp;
    totals.employeeCpp2 += p.employeeCpp2;
    totals.employeeEi += p.employeeEi;
    totals.employerCpp += p.employerCpp;
    totals.employerCpp2 += p.employerCpp2;
    totals.employerEi += p.employerEi;
    totals.federalTax += p.federalTax;
    totals.provincialTax += p.provincialTax;
    totals.incomeTax += p.incomeTax;
    totals.totalRemittance += p.totalRemittance;
  }

  // Round totals
  for (const k of Object.keys(totals) as Array<keyof typeof totals>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (totals as any)[k] === "number" && k !== "payRuns") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (totals as any)[k] = Math.round((totals as any)[k] * 100) / 100;
    }
  }

  return { year, periods, totals };
}

function periodKey(payDate: string, grouping: "monthly" | "quarterly"): string {
  const [y, m] = payDate.split("-") as [string, string];
  if (grouping === "quarterly") {
    const q = Math.ceil(parseInt(m) / 3);
    return `${y}-Q${q}`;
  }
  return `${y}-${m}`;
}
