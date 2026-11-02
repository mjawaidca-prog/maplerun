/**
 * RL-1 data export download — the documented interim export from
 * lib/filings/rl1-boxes.ts (buildRl1DataExport), as JSON. This is NOT the
 * Revenu Québec transmission XML: the RL XML XSDs are restricted to
 * registered software partners, so no XML export is offered. Slip numbers
 * are intentionally absent — they are sequential, persisted state assigned
 * by a future filing layer.
 */

import { NextResponse } from "next/server";
import { getRl1Report } from "@/lib/actions/rl1";
import { buildRl1DataExport } from "@/lib/filings/rl1-boxes";

export async function GET(request: Request) {
  const yearParam = Number(new URL(request.url).searchParams.get("year"));
  const year = Number.isInteger(yearParam) && yearParam > 0 ? yearParam : 2026;

  const report = await getRl1Report(year);
  const dataExport = buildRl1DataExport(report.slips, year);

  return new NextResponse(JSON.stringify(dataExport, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="rl1-data-export-${year}.json"`,
    },
  });
}
