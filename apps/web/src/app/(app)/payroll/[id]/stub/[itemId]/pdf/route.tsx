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
import { buildEarningsLines, parseCustomDeductions } from "@/lib/pay-stub-data";

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

  // Wave 3 B5 — YTD gross pay + income tax live on the YtdLedger (they
  // are current-state totals, like the ledger's other fields the stub
  // already shows via item snapshots for the latest run).
  const year = Number(payRun.payDate.slice(0, 4)) || 2026;
  const ytdLedger = await prisma.ytdLedger.findUnique({
    where: { employeeId_year: { employeeId: item.employeeId, year } },
    select: { grossPay: true, incomeTax: true },
  });

  const pdfData = {
    companyName: company?.name ?? "Nexvar Pay",
    employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
    payDate: payRun.payDate,
    periodStart: payRun.periodStart ?? null,
    payGroup: `${payRun.payGroup.name} · ${payRun.payGroup.frequency.toLowerCase()}`,
    gross: item.gross,
    cpp: item.cpp,
    cpp2: item.cpp2,
    ei: item.ei,
    federalTax: item.federalTax,
    provincialTax: item.provincialTax,
    totalDeductions: item.totalDeductions,
    netPay: item.netPay,
    earnings: buildEarningsLines(item),
    customDeductions: parseCustomDeductions((item as { customDeductions?: unknown }).customDeductions),
    reimbursement: (item as { reimbursement?: number }).reimbursement ?? 0,
    ytdPensionable: item.ytdPensionable,
    ytdCpp: item.ytdCpp,
    ytdCpp2: item.ytdCpp2,
    ytdInsurable: item.ytdInsurable,
    ytdEi: item.ytdEi,
    ytdGrossPay: ytdLedger?.grossPay ?? 0,
    ytdIncomeTax: ytdLedger?.incomeTax ?? 0,
    vacationBalanceAfterCents: item.vacationBalanceAfterCents ?? null,
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
