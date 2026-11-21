"use server";

/**
 * T4 Summary ↔ PD7A tie-out — server action.
 *
 * Fetches the year's FINALIZED pay runs (plus REVERSED runs, which feed the
 * cause attribution only — neither side counts them) with their pay slips,
 * and hands everything to the pure tie-out module
 * (lib/filings/t4-pd7a-tieout.ts). All comparison math lives there; this
 * action only fetches and maps. The PD7A figures inside the module come
 * from the shared remittance aggregation (lib/remittance/aggregate.ts) —
 * never recompute remittance figures here.
 *
 * Year parameters come from @maplerun/tax-engine: the 2026 tables for 2026,
 * the published 2027 CPP/EI tables for 2027. Other years fall back to the
 * 2026 tables — the app currently files 2026 (the T4 pages hardcode it),
 * and the engine's table editions only cover 2026 pay dates.
 */

import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  TABLES_2026,
  CPP_2027,
  EI_2027,
  maxCppContribution,
  maxCpp2Contribution,
  type CppTable,
  type EiTable,
} from "@maplerun/tax-engine";
import {
  buildT4Pd7aTieOut,
  type TieOutEmployeeMeta,
  type TieOutParams,
  type TieOutResult,
  type TieOutRunInput,
} from "@/lib/filings/t4-pd7a-tieout";

const PERIODS_PER_YEAR: Record<string, number> = {
  WEEKLY: 52,
  BIWEEKLY: 26,
  SEMIMONTHLY: 24,
  MONTHLY: 12,
};

function paramsForYear(year: number): TieOutParams {
  const cpp: CppTable = year === 2027 ? CPP_2027 : TABLES_2026.cpp;
  const ei: EiTable = year === 2027 ? EI_2027 : TABLES_2026.ei;
  return {
    cppRate: cpp.employeeRate,
    cpp2Rate: cpp.cpp2Rate,
    basicExemption: cpp.basicExemption,
    ympe: cpp.ympe,
    yampe: cpp.yampe,
    maxCpp: maxCppContribution(cpp),
    maxCpp2: maxCpp2Contribution(cpp),
    eiRate: ei.employeeRate,
    eiRateQuebec: ei.employeeRateQuebec,
    maxInsurableEarnings: ei.maxInsurableEarnings,
  };
}

/**
 * Build the T4 ↔ PD7A tie-out for a tax year: every compared field, both
 * sides, and a PIER-style review list of the differences with likely causes.
 */
export async function getT4Pd7aTieOut(year: number): Promise<TieOutResult> {
  const { companyId } = await requireCompany();

  const payRuns = await prisma.payRun.findMany({
    where: {
      companyId,
      payDate: { startsWith: String(year) },
      status: { in: ["FINALIZED", "REVERSED"] },
    },
    orderBy: { payDate: "asc" },
    include: {
      payGroup: { select: { frequency: true } },
      items: {
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, province: true } },
        },
      },
    },
  });

  const employees: Record<string, TieOutEmployeeMeta> = {};
  const runs: TieOutRunInput[] = payRuns.map((run) => {
    for (const item of run.items) {
      const e = item.employee;
      if (e && !employees[e.id]) {
        employees[e.id] = {
          name: `${e.firstName} ${e.lastName}`.trim(),
          province: e.province ?? "ON",
        };
      }
    }
    return {
      id: run.id,
      payDate: run.payDate,
      status: run.status,
      finalizedAt: run.finalizedAt ? run.finalizedAt.toISOString() : null,
      reversedAt: run.reversedAt ? run.reversedAt.toISOString() : null,
      periodsPerYear: PERIODS_PER_YEAR[run.payGroup?.frequency ?? "BIWEEKLY"] ?? 26,
      totalGross: run.totalGross,
      totalCpp: run.totalCpp,
      totalCpp2: run.totalCpp2,
      totalEi: run.totalEi,
      totalFederalTax: run.totalFederalTax,
      totalProvincialTax: run.totalProvincialTax,
      totalEmployerCpp: run.totalEmployerCpp,
      totalEmployerCpp2: run.totalEmployerCpp2,
      totalEmployerEi: run.totalEmployerEi,
      itemCount: run.itemCount,
      items: run.items.map((item) => ({
        employeeId: item.employeeId,
        gross: item.gross,
        cpp: item.cpp,
        cpp2: item.cpp2,
        ei: item.ei,
        federalTax: item.federalTax,
        provincialTax: item.provincialTax,
        employerCpp: item.employerCpp,
        employerCpp2: item.employerCpp2,
        employerEi: item.employerEi,
        ytdPensionable: item.ytdPensionable,
        ytdInsurable: item.ytdInsurable,
      })),
    };
  });

  return buildT4Pd7aTieOut({
    year,
    runs,
    employees,
    params: paramsForYear(year),
  });
}
