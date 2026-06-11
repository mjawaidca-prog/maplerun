/**
 * PDF pay stub download API route.
 * GET /payroll/[id]/stub/[itemId]/pdf → downloads a PDF pay stub.
 */

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { PayStubPdf } from "@/lib/pdf/pay-stub";
import { getPayRun } from "@/lib/actions/payroll";
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id: payRunId, itemId } = await params;
  const { companyId } = await requireCompany();

  const payRun = await getPayRun(payRunId).catch(() => null);
  if (!payRun || payRun.companyId !== companyId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const item = payRun.items.find((i) => i.id === itemId);
  if (!item) {
    return new NextResponse("Not found", { status: 404 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  const pdfData = {
    companyName: company?.name ?? "MapleRun",
    employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
    payDate: payRun.payDate,
    payGroup: `${payRun.payGroup.name} · ${payRun.payGroup.frequency.toLowerCase()}`,
    gross: item.gross,
    cpp: item.cpp,
    cpp2: item.cpp2,
    ei: item.ei,
    federalTax: item.federalTax,
    provincialTax: item.provincialTax,
    totalDeductions: item.totalDeductions,
    netPay: item.netPay,
    ytdPensionable: item.ytdPensionable,
    ytdCpp: item.ytdCpp,
    ytdCpp2: item.ytdCpp2,
    ytdInsurable: item.ytdInsurable,
    ytdEi: item.ytdEi,
    employerCpp: item.employerCpp,
    employerCpp2: item.employerCpp2,
    employerEi: item.employerEi,
    employerTotal: item.employerTotal,
  };

  const buffer = await renderToBuffer(<PayStubPdf data={pdfData} />);

  const filename = `pay-stub-${item.employee.lastName.toLowerCase()}-${payRun.payDate}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length.toString(),
    },
  });
}
