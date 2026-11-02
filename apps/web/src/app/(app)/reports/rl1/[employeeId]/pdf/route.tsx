/**
 * PDF RL-1 slip download route — sibling of the pay-stub PDF route.
 * GET /reports/rl1/[employeeId]/pdf?year=2026 → downloads the employee's
 * RL-1 slip PDF. Warnings are NOT printed on the slip (see the web detail
 * view for those).
 */

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { Rl1SlipPdf, rl1PdfBoxes } from "@/lib/pdf/rl1-slip";
import { getRl1Report } from "@/lib/actions/rl1";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  const { employeeId } = await params;
  const yearParam = Number(new URL(request.url).searchParams.get("year"));
  const year = Number.isInteger(yearParam) && yearParam > 0 ? yearParam : 2026;

  const report = await getRl1Report(year).catch(() => null);
  const slip = report?.slips.find((s) => s.employeeId === employeeId);
  if (!report || !slip) {
    return new NextResponse("Not found", { status: 404 });
  }

  const buffer = await renderToBuffer(
    <Rl1SlipPdf
      data={{
        companyName: report.companyName,
        employeeName: slip.employeeName,
        year,
        boxes: rl1PdfBoxes(slip),
        caseOCode: slip.caseOCode,
      }}
    />,
  );

  const filename = `rl1-${year}-${slip.employeeName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length.toString(),
    },
  });
}
