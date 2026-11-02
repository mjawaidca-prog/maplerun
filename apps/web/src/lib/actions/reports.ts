"use server";

/**
 * Reporting server actions — PD7A remittance, pay period summaries.
 *
 * All remittance math lives in the shared pure module
 * (lib/remittance/aggregate.ts) — this action only fetches finalized runs
 * and delegates. Do NOT recompute remittance figures here or in any page;
 * that is how the hub and the Remittances page used to disagree.
 */

import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  aggregateRemittances,
  type Pd7aPeriod,
  type Pd7aTotals,
} from "@/lib/remittance/aggregate";

// ─── Types ────────────────────────────────────────────────────────────────────

// Re-exported so existing imports from "@/lib/actions/reports" keep working;
// the canonical definitions live in lib/remittance/aggregate.ts.
export type { Pd7aPeriod };

export type Pd7aReport = {
  year: number;
  periods: Pd7aPeriod[];
  totals: Pd7aTotals;
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

  const { periods, totals } = aggregateRemittances(payRuns, grouping);

  return { year, periods, totals };
}
