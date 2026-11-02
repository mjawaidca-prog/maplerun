/**
 * Employee portal — pay stub PDF download (Wave 3, A4).
 * GET /portal/stubs/[itemId]/pdf
 *
 * Same PayStubPdf component as the employer route, but scoped to the
 * portal session's employee: the item query is ANDed with the resolved
 * employeeId, so another employee's item id returns 404.
 */

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { PayStubPdf } from "@/lib/pdf/pay-stub";
import { prisma } from "@/lib/prisma";
import { getActivePortalEmployee } from "@/lib/employee-portal-session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const session = await getActivePortalEmployee();
  if (!session) return new NextResponse("Not found", { status: 404 });

  const item = await prisma.payRunItem.findFirst({
    where: { id: itemId, employeeId: session.active.employeeId },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      payRun: {
        include: { payGroup: { select: { name: true, frequency: true } } },
      },
    },
  });
  if (!item || item.payRun.status !== "FINALIZED") {
    return new NextResponse("Not found", { status: 404 });
  }

  const company = await prisma.company.findUnique({
    where: { id: session.active.companyId },
    select: { name: true },
  });

  const pdfData = {
    companyName: company?.name ?? "Nexvar Pay",
    employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
    payDate: item.payRun.payDate,
    payGroup: `${item.payRun.payGroup.name} · ${item.payRun.payGroup.frequency.toLowerCase()}`,
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

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="pay-stub-${item.employee.lastName.toLowerCase()}-${item.payRun.payDate}.pdf"`,
      "Content-Length": buffer.length.toString(),
    },
  });
}
