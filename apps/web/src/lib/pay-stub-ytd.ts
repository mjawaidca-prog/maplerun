/**
 * Server-side loader for the Quebec YTD split (Wave 4, W4-D3).
 *
 * The pure math lives in lib/payroll-display.ts (splitQuebecYtd); this
 * is the one place that fetches its inputs — the employee's finalized
 * items in finalization order — so the web stub page and both stub PDF
 * routes split Sophie-style blended YTD snapshots identically.
 */

import { prisma } from "@/lib/prisma";
import { splitQuebecYtd, type QuebecYtdSplit } from "@/lib/payroll-display";

export async function getQuebecYtdSplit(item: {
  id: string;
  employeeId: string;
  ytdEi: number;
  ytdInsurable: number;
}): Promise<QuebecYtdSplit> {
  const items = await prisma.payRunItem.findMany({
    where: { employeeId: item.employeeId, payRun: { status: "FINALIZED" } },
    orderBy: [{ payRun: { finalizedAt: "asc" } }, { payRun: { createdAt: "asc" } }],
    select: { id: true, qpip: true, ytdInsurable: true },
  });
  return splitQuebecYtd(items, item.id, item.ytdEi, item.ytdInsurable);
}
