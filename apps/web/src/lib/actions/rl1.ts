"use server";

/**
 * RL-1 slip generation (Revenu Québec) — per-employee annual summary from
 * finalized pay runs, computed by the pure module lib/filings/rl1-boxes.ts.
 *
 * INCLUSION RULE: an employee is in scope for the year when their FINALIZED
 * pay-run items for the year carry Québec pension/parental amounts — i.e.
 * at least one item with qpp > 0 or qpip > 0. We follow the taxed money,
 * not the employee profile's province field, which can be stale (an
 * employee who moved provinces mid-year, or whose profile was never
 * updated). Items meeting the same test are that employee's "QC items";
 * all box sums below are over QC items only. In-scope employees are passed
 * to the module with provinceOfEmployment: "QC".
 *
 * Box assembly (Wave 1 dual-write: for QC runs qpp/qpp2 hold the QPP split
 * and qpip the employee QPIP premium; legacy cpp/ei keep combined totals):
 *   A   employment income        = Σ gross over QC items
 *   B.A QPP base + 1st additional = Σ qpp
 *   B.B QPP 2nd additional        = Σ qpp2
 *   C   EI premiums               = Σ ei (the engine already stored the
 *                                  reduced Québec EI rate on QC items)
 *   E   Québec tax withheld       = Σ provincialTax over QC items
 *   G   QPP pensionable earnings  = YtdLedger.pensionableEarnings for
 *                                  (employee, year); fallback: the last QC
 *                                  item's capped ytdPensionable snapshot
 *   H   QPIP premiums (employee)  = Σ qpip
 *   I   QPIP eligible earnings    = min(Σ gross over QC items, QPIP maximum
 *                                  insurable earnings)
 *
 * Box I cap source: QPIP_2026.maxInsurableEarnings = $103,000 from the
 * tax-engine 2026 Québec tables (packages/tax-engine/src/data/2026/
 * quebec.ts, CRA T4127 121st ed. Table 8.8), imported from
 * @maplerun/tax-engine.
 *
 * Boxes with no source data in the app (D RPP, F union dues, J/K/L/M/N/O/
 * Q/R/T) are left undefined so the module defaults them to 0 — nothing is
 * fabricated.
 *
 * RL-1 XML transmission is NOT produced here: Revenu Québec's RL XML XSDs
 * are restricted to registered software partners. buildRl1DataExport (in
 * the filings module) is the documented interim export; slip numbers are
 * sequential state and are assigned by a future filing layer, never here.
 */

import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/session";
import { QPIP_2026 } from "@maplerun/tax-engine";
import {
  computeRl1Slip,
  type Rl1Slip,
} from "@/lib/filings/rl1-boxes";

export type Rl1Report = {
  year: number;
  companyName: string;
  slips: Rl1Slip[];
  totals: {
    employees: number;
    boxA: number;
    boxBA: number;
    boxBB: number;
    boxC: number;
    boxE: number;
    boxG: number;
    boxH: number;
    boxI: number;
  };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getRl1Report(year: number): Promise<Rl1Report> {
  const { companyId } = await requireCompany();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  // All finalized pay runs for the year (payDate is an ISO string; the T4
  // action uses the same startsWith year filter).
  const payRuns = await prisma.payRun.findMany({
    where: {
      companyId,
      status: "FINALIZED",
      payDate: { startsWith: String(year) },
    },
    include: {
      items: {
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { payDate: "asc" },
  });

  type Agg = {
    employeeId: string;
    employeeName: string;
    gross: number;
    qpp: number;
    qpp2: number;
    ei: number;
    provincialTax: number;
    qpip: number;
    lastYtdPensionable: number;
  };
  const empMap = new Map<string, Agg>();

  for (const run of payRuns) {
    for (const item of run.items) {
      // QC item test — the inclusion rule above. Non-QC items (qpp and
      // qpip both zero) never contribute to an RL-1 slip.
      if (!(item.qpp > 0 || item.qpip > 0)) continue;

      let agg = empMap.get(item.employeeId);
      if (!agg) {
        agg = {
          employeeId: item.employeeId,
          employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
          gross: 0,
          qpp: 0,
          qpp2: 0,
          ei: 0,
          provincialTax: 0,
          qpip: 0,
          lastYtdPensionable: 0,
        };
        empMap.set(item.employeeId, agg);
      }
      agg.gross += item.gross;
      agg.qpp += item.qpp;
      agg.qpp2 += item.qpp2;
      agg.ei += item.ei;
      agg.provincialTax += item.provincialTax;
      agg.qpip += item.qpip;
      // Runs are payDate-ascending, so the last write is the latest snapshot.
      agg.lastYtdPensionable = item.ytdPensionable;
    }
  }

  // Box G source of truth: the capped YtdLedger row for (employee, year).
  const employeeIds = Array.from(empMap.keys());
  const ledgers = employeeIds.length
    ? await prisma.ytdLedger.findMany({
        where: { employeeId: { in: employeeIds }, year },
        select: { employeeId: true, pensionableEarnings: true },
      })
    : [];
  const ledgerByEmployee = new Map<string, number>(
    ledgers.map((l: { employeeId: string; pensionableEarnings: number }) => [l.employeeId, l.pensionableEarnings] as const),
  );

  const slips = Array.from(empMap.values())
    .map((agg) =>
      computeRl1Slip({
        employeeId: agg.employeeId,
        employeeName: agg.employeeName,
        provinceOfEmployment: "QC",
        employmentIncome: agg.gross,
        qppBaseAndFirstAdditional: agg.qpp,
        qppSecondAdditional: agg.qpp2,
        eiPremiums: agg.ei,
        quebecTaxWithheld: agg.provincialTax,
        qppPensionableEarnings: ledgerByEmployee.get(agg.employeeId) ?? agg.lastYtdPensionable,
        qpipPremiums: agg.qpip,
        // QPIP_2026.maxInsurableEarnings ($103,000) — see header comment.
        qpipEligibleEarnings: Math.min(agg.gross, QPIP_2026.maxInsurableEarnings),
      }),
    )
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  const totals = {
    employees: slips.length,
    boxA: round2(slips.reduce((s, sl) => s + sl.boxA, 0)),
    boxBA: round2(slips.reduce((s, sl) => s + sl.boxBA, 0)),
    boxBB: round2(slips.reduce((s, sl) => s + sl.boxBB, 0)),
    boxC: round2(slips.reduce((s, sl) => s + sl.boxC, 0)),
    boxE: round2(slips.reduce((s, sl) => s + sl.boxE, 0)),
    boxG: round2(slips.reduce((s, sl) => s + sl.boxG, 0)),
    boxH: round2(slips.reduce((s, sl) => s + sl.boxH, 0)),
    boxI: round2(slips.reduce((s, sl) => s + sl.boxI, 0)),
  };

  return { year, companyName: company?.name ?? "Nexvar Pay", slips, totals };
}
