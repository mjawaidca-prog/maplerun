"use server";

/**
 * Remittance submission actions — recorded CRA submissions + remitter type.
 *
 * Submissions are REAL records (RemittanceSubmission): marking a period
 * submitted snapshots the period's totalRemittance from the shared
 * aggregation (lib/remittance/aggregate.ts) computed server-side from
 * finalized pay runs. The client never supplies the amount — that is what
 * makes the Remittances page's "Submitted" state trustworthy (PR #14
 * removed fabricated submitted dates/references; this restores the state
 * on top of persisted data).
 */

import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  aggregateRemittances,
  groupingForRemitterType,
  isRemitterType,
  type RemitterType,
} from "@/lib/remittance/aggregate";

export type RemittanceSubmissionRecord = {
  periodKey: string;
  totalRemittance: number;
  reference: string | null;
  submittedAt: Date;
  createdById: string | null;
};

/**
 * Current company's remitter type (null = unset → Regular behaviour), or
 * null if the company row is gone.
 */
export async function getRemitterType(): Promise<RemitterType | null> {
  const { companyId } = await requireCompany();
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { remitterType: true },
  });
  return isRemitterType(company?.remitterType) ? company.remitterType : null;
}

/**
 * All recorded submissions for the current company, keyed by periodKey.
 * Company-scoped: the query is filtered by the session's companyId.
 */
export async function getRemittanceSubmissions(): Promise<
  Record<string, RemittanceSubmissionRecord>
> {
  const { companyId } = await requireCompany();
  const rows = await prisma.remittanceSubmission.findMany({
    where: { companyId },
    orderBy: { submittedAt: "asc" },
  });
  const out: Record<string, RemittanceSubmissionRecord> = {};
  for (const r of rows) {
    out[r.periodKey] = {
      periodKey: r.periodKey,
      totalRemittance: r.totalRemittance,
      reference: r.reference,
      submittedAt: r.submittedAt,
      createdById: r.createdById,
    };
  }
  return out;
}

/**
 * Mark a period as submitted to CRA. The recorded amount is the period's
 * CURRENT totalRemittance from the shared aggregation (grouping follows
 * the company's remitter type) — server-computed, never client-supplied.
 * Re-marking an already-submitted period upserts: the snapshot, reference
 * and submittedAt are refreshed.
 */
export async function markRemittanceSubmitted(
  periodKey: string,
  reference?: string,
): Promise<RemittanceSubmissionRecord> {
  const { id: userId, companyId } = await requireCompany();

  if (!/^\d{4}-(\d{2}|Q[1-4])$/.test(periodKey)) {
    throw new Error(`Invalid period key: ${periodKey}`);
  }

  const remitterType = await getRemitterTypeFor(companyId);
  const grouping = groupingForRemitterType(remitterType);

  const payRuns = await prisma.payRun.findMany({
    where: { companyId, status: "FINALIZED" },
    orderBy: { payDate: "asc" },
  });
  const { periods } = aggregateRemittances(payRuns, grouping);
  const period = periods.find((p) => p.period === periodKey);
  const totalRemittance = period?.totalRemittance ?? 0;

  const trimmedRef = reference?.trim() ? reference.trim() : null;

  const row = await prisma.remittanceSubmission.upsert({
    where: { companyId_periodKey: { companyId, periodKey } },
    create: {
      companyId,
      periodKey,
      totalRemittance,
      reference: trimmedRef,
      createdById: userId,
    },
    update: {
      totalRemittance,
      reference: trimmedRef,
      submittedAt: new Date(),
      createdById: userId,
    },
  });

  revalidatePath("/reports/remittance");
  revalidatePath("/reports");

  return {
    periodKey: row.periodKey,
    totalRemittance: row.totalRemittance,
    reference: row.reference,
    submittedAt: row.submittedAt,
    createdById: row.createdById,
  };
}

/** Internal: remitter type for a known company (no extra session hop). */
async function getRemitterTypeFor(companyId: string): Promise<RemitterType | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { remitterType: true },
  });
  return isRemitterType(company?.remitterType) ? company.remitterType : null;
}

/**
 * Set the company's CRA remitter type (Wave 1's Company.remitterType,
 * settable here on the Remittances page). Only the four CRA values are
 * accepted; anything else is rejected before any write.
 */
export async function updateRemitterType(type: string): Promise<RemitterType> {
  const { companyId } = await requireCompany();

  if (!isRemitterType(type)) {
    throw new Error(
      `Invalid remitter type: ${String(type)}. Must be one of REGULAR, QUARTERLY, ACCELERATED1, ACCELERATED2.`,
    );
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { remitterType: type },
  });

  revalidatePath("/reports/remittance");
  revalidatePath("/reports");

  return type;
}
