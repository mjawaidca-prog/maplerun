"use server";

/**
 * CPA-005 direct deposit file generator.
 *
 * Standard Canadian Payments Association format for payroll EFT.
 * File format (80-character fixed-width records):
 *   A-record: Header (originator ID, date, currency)
 *   C-records: Credit (per-employee deposit)
 *   D-record: Debit (total withdrawn from company)
 *   Z-record: Trailer (counts and totals)
 */

import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

function padRight(str: string, len: number): string {
  return str.substring(0, len).padEnd(len, " ");
}
function padLeft(str: string, len: number, char = "0"): string {
  return str.substring(0, len).padStart(len, char);
}
function fmtEFT(n: number): string {
  return padLeft(Math.round(n * 100).toString(), 10);
}

/** Generate a CPA-005 file for one finalized pay run. */
export async function generateEftFile(payRunId: string): Promise<{ filename: string; content: string }> {
  const { companyId } = await requireCompany();

  const payRun = await prisma.payRun.findUnique({
    where: { id: payRunId },
    include: {
      items: {
        include: { employee: { select: { id: true, firstName: true, lastName: true, bankEncrypted: true } } },
        orderBy: { employee: { lastName: "asc" } },
      },
    },
  });

  if (!payRun || payRun.companyId !== companyId || payRun.status !== "FINALIZED") {
    throw new Error("Pay run not found or not finalized.");
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  const originatorId = padRight(companyId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 15), 15);
  const dateStr = payRun.payDate.replace(/-/g, "");
  const companyName = padRight((company?.name ?? "Nexvar Pay").replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 30), 30);
  const originatorName = padRight("NEXVAR PAYROLL", 30);
  const institution = "001";  // Bank of Canada institution code placeholder
  const account = padRight(companyId.slice(-12), 12);

  const lines: string[] = [];

  // A-record (Header)
  lines.push(
    `A${padRight("", 1)}${originatorId}${dateStr}CAD${padRight("", 4)}${institution}${account}${padRight("", 32)}0001${padRight("", 4)}`
  );

  let totalAmount = 0;
  const credits: string[] = [];

  // C-records (per employee)
  for (const item of payRun.items) {
    if (item.netPay <= 0) continue;

    // Decrypt bank details
    let transit = "00000";
    let empInstitution = "001";
    let empAccount = padRight("N/A", 12);

    if (item.employee.bankEncrypted) {
      try {
        const bank = JSON.parse(decrypt(item.employee.bankEncrypted));
        transit = padRight((bank.transit ?? "00000").replace(/\D/g, "").slice(0, 5), 5);
        empInstitution = padRight((bank.institution ?? "001").replace(/\D/g, "").slice(0, 3), 3);
        empAccount = padRight((bank.account ?? "").replace(/\D/g, "").slice(0, 12), 12);
      } catch { /* use defaults */ }
    }

    const name = padRight(`${item.employee.lastName}, ${item.employee.firstName}`.slice(0, 30), 30);
    const amount = fmtEFT(item.netPay);
    totalAmount += item.netPay;

    credits.push(
      `C${padRight("", 1)}${empInstitution}${transit}${empAccount}${amount}${name}${padRight("", 22)}`
    );
  }

  // Accept items even without bank details — they'll use defaults
  if (credits.length === 0 && payRun.totalNetPay <= 0) {
    throw new Error("This pay run has no net pay to deposit. Run payroll first.");
  }
  if (credits.length === 0) {
    throw new Error("No employees found in this pay run. Add employees with bank details and re-run payroll.");
  }

  lines.push(...credits);

  // D-record (Debit - total withdraw)
  lines.push(
    `D${padRight("", 1)}${institution}${account}${fmtEFT(totalAmount)}${padRight("", 58)}`
  );

  // Z-record (Trailer)
  lines.push(
    `Z${padLeft(String(credits.length), 6)}${fmtEFT(totalAmount)}${padRight("", 54)}`
  );

  const content = lines.join("\r\n") + "\r\n";
  const filename = `eft-payrun-${payRun.payDate}.txt`;

  return { filename, content };
}
