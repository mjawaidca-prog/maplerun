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
  type Pd7aPeriod as AggregatePd7aPeriod,
  type Pd7aTotals,
} from "@/lib/remittance/aggregate";

// ─── Types ────────────────────────────────────────────────────────────────────

// Local type-alias declaration (NOT a bare `export type { … }` re-export):
// Turbopack's server-actions transform treats a bare re-export in a
// "use server" file as a runtime export and the build fails, because the
// type is erased. The canonical definition lives in
// lib/remittance/aggregate.ts; existing imports from "@/lib/actions/reports"
// keep working through this alias.
export type Pd7aPeriod = AggregatePd7aPeriod;

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
