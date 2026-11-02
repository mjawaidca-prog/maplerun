/**
 * Employee pay stub — premium bank-statement design. Light + dark.
 */

import { getPayRun } from "@/lib/actions/payroll";
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildEarningsLines, buildDeductionLines, buildEmployerLines, parseCustomDeductions, vacationBalanceLine } from "@/lib/pay-stub-data";
import { getQuebecYtdSplit } from "@/lib/pay-stub-ytd";
import { parseBankDetails, bankAccountLast4 } from "@/lib/banking";
import { StubBackLink, StubPdfLink, StubPrintButton } from "@/components/stub-actions";
import { Logo } from "@/components/logo";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string; itemId: string }> };

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

export default async function PayStubPage({ params }: Props) {
  const { id: payRunId, itemId } = await params;
  const { companyId } = await requireCompany();
  const payRun = await getPayRun(payRunId).catch(() => null);
  if (!payRun || payRun.companyId !== companyId) notFound();
  // W4-D6 — stubs are served for FINALIZED runs only, matching the
  // portal PDF route and the EFT side (generateEftFile refuses
  // non-FINALIZED runs). A reversed run's item snapshots are
  // pre-reversal history; serving them showed stale vacation/CPP/EI
  // YTD that no longer exists in the ledger.
  if (payRun.status !== "FINALIZED") notFound();
  const item = payRun.items.find((i) => i.id === itemId);
  if (!item) notFound();
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true, businessNumber: true } });
  const employee = await prisma.employee.findUnique({
    where: { id: item.employeeId },
    select: { firstName: true, lastName: true, addressLine1: true, city: true, province: true, postalCode: true, provinceOfEmployment: true, bankEncrypted: true },
  });

  // W4-D3 — Quebec resolution + split of the blended YTD snapshots.
  const isQuebec = (employee?.provinceOfEmployment ?? payRun.payGroup.defaultProvince) === "QC";
  const ytdSplit = isQuebec ? await getQuebecYtdSplit(item) : null;
  const stubItem = { ...item, isQuebec };
  const deductionLines = buildDeductionLines(stubItem, isQuebec ? "Quebec Tax" : "Provincial Tax");
  const employerLines = buildEmployerLines(stubItem);

  // W4-D5 — the payment-method line follows the ONE banking
  // completeness rule (lib/banking.ts): all of institution + transit +
  // account present and well-formed, else the pay was by cheque.
  const bank = parseBankDetails(employee?.bankEncrypted);
  const bankLast4 = bankAccountLast4(bank);
  const paymentMethodLine = bankLast4
    ? `Deposited to account •••• ${bankLast4}`
    : "Paid by cheque — no direct-deposit details on file";

  // Sum YTD income tax from all finalized pay run items for this employee in 2026
  const ytdTaxAgg = await prisma.payRunItem.aggregate({
    where: {
      employeeId: item.employeeId,
      payRun: { status: "FINALIZED", payDate: { startsWith: "2026" } },
    },
    _sum: { federalTax: true, provincialTax: true },
  });
  const ytdFederalTax = (ytdTaxAgg._sum.federalTax ?? 0);
  const ytdProvincialTax = (ytdTaxAgg._sum.provincialTax ?? 0);

  // Wave 3 B5 — YTD gross pay + total income tax from the YtdLedger
  // (finalize increments them per item; reversal decrements exactly).
  // Pre-B5 ledgers carry the 0 default, so fall back to an item
  // aggregate when the ledger has no gross recorded yet.
  const ytdLedger = await prisma.ytdLedger.findUnique({
    where: { employeeId_year: { employeeId: item.employeeId, year: 2026 } },
    select: { grossPay: true, incomeTax: true },
  });
  let ytdGrossPay = ytdLedger?.grossPay ?? 0;
  let ytdIncomeTax = ytdLedger?.incomeTax ?? 0;
  if (ytdGrossPay === 0) {
    const ytdGrossAgg = await prisma.payRunItem.aggregate({
      where: {
        employeeId: item.employeeId,
        payRun: { status: "FINALIZED", payDate: { startsWith: "2026" } },
      },
      _sum: { gross: true },
    });
    ytdGrossPay = ytdGrossAgg._sum.gross ?? 0;
    ytdIncomeTax = ytdFederalTax + ytdProvincialTax;
  }

  const earningsLines = buildEarningsLines(item);
  const customDeductionLines = parseCustomDeductions((item as { customDeductions?: unknown }).customDeductions);
  const reimbursement = (item as { reimbursement?: number }).reimbursement ?? 0;
  const vacBalance = vacationBalanceLine(item);

  return (
    <div className="space-y-6 max-w-[816px] print:max-w-full">
      {/* Actions */}
      <div className="flex items-center justify-between print:hidden">
        <StubBackLink href={`/payroll/${payRunId}`} />
        <div className="flex items-center gap-2">
          <StubPdfLink href={`/payroll/${payRunId}/stub/${itemId}/pdf`} />
          <StubPrintButton />
        </div>
      </div>

      {/* Pay Stub — elevated document */}
      <div className="rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.10)] border border-[#E7E5E4] dark:border-[#292524] bg-white dark:bg-[#1C1917] print:shadow-none print:rounded-none print:border-0">
        {/* Header — premium dark */}
        <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white px-10 py-8 flex justify-between items-start dark:from-[#0F172A] dark:to-[#1E293B]">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Logo size={30} />
            </div>
            <p className="text-[20px] font-extrabold tracking-[-0.01em]">{company?.name ?? "Nexvar Pay"}</p>
            {company?.businessNumber && (
              <p className="text-[12px] opacity-70 mt-0.5">BN: {company.businessNumber}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[13px] font-semibold tracking-[0.18em] opacity-85">PAY STUB</p>
            {payRun.periodStart ? (
              <p className="text-[13px] opacity-90 mt-1">Period · {payRun.periodStart} → {payRun.payDate}</p>
            ) : (
              <p className="text-[13px] opacity-90 mt-1">Period End · {payRun.payDate}</p>
            )}
            {/* W4-D4 — the pay date always renders, not only when it
                differs from the period end. */}
            <p className="text-[13px] opacity-90 mt-1">Pay Date · {payRun.actualPayDate ?? payRun.payDate}</p>
            <p className="text-[13px] opacity-90 mt-1">{payRun.payGroup.frequency.toLowerCase()}</p>
          </div>
        </div>

        {/* Employee + Employer info row */}
        <div className="px-10 py-7 border-b border-[#E7E5E4] dark:border-[#292524] flex justify-between">
          <div>
            <p className="text-xs text-[#A8A29E] uppercase tracking-[0.08em] font-semibold">Employee</p>
            <p className="text-lg font-bold text-[#1C1917] dark:text-[#FAFAF9] mt-0.5">
              {item.employee.firstName} {item.employee.lastName}
            </p>
            {(employee?.addressLine1 || employee?.city) && (
              <p className="text-[13px] text-[#78716C] dark:text-[#A8A29E] mt-0.5">
                {[employee.addressLine1, employee.city, employee.province, employee.postalCode].filter(Boolean).join(", ")}
              </p>
            )}
            <p className="text-[13px] text-[#78716C] dark:text-[#A8A29E] mt-0.5">
              {payRun.payGroup.defaultProvince ?? "ON"} · SIN •••-•••-•••
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#A8A29E] uppercase tracking-[0.08em] font-semibold">Pay Date</p>
            <p className="text-sm font-semibold text-[#1C1917] dark:text-[#FAFAF9] mt-0.5">
              {payRun.actualPayDate ?? payRun.payDate}
            </p>
            <p className="text-[13px] text-[#78716C] dark:text-[#A8A29E] mt-0.5">
              {payRun.payGroup.frequency.toLowerCase()} · {payRun.periodStart ? `${payRun.periodStart} → ` : "period end "}{payRun.payDate}
            </p>
          </div>
        </div>

        {/* Earnings / Deductions grid */}
        <div className="px-10 py-6 grid grid-cols-2 gap-6">
          {/* Earnings — itemized (Wave 3 B5) */}
          <div>
            <p className="text-xs font-bold text-[#78716C] dark:text-[#A8A29E] uppercase tracking-[0.08em] mb-2.5">Earnings</p>
            <div className="bg-[#F0FDF4] dark:bg-[#0F2A17] border border-[#BBF7D0] dark:border-[#166534] rounded-xl overflow-hidden">
              {earningsLines.map((line) => (
                <div key={line.label} className="flex justify-between items-center px-4 py-[9px] text-[13px]">
                  <div>
                    <span className="text-[#15803D] dark:text-[#4ADE80] font-medium">{line.label}</span>
                    {line.detail && (
                      <p className="text-[11px] text-[#15803D]/70 dark:text-[#4ADE80]/70 mt-0.5">{line.detail}</p>
                    )}
                  </div>
                  <span className="font-mono tabular-nums text-[#15803D] dark:text-[#4ADE80]">{fmtCAD(line.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center px-4 py-[11px] border-t border-[#BBF7D0] dark:border-[#166534]">
                <span className="text-sm font-bold text-[#15803D] dark:text-[#4ADE80]">Gross Pay</span>
                <span className="text-lg font-semibold text-[#15803D] dark:text-[#4ADE80] font-mono tabular-nums">{fmtCAD(item.gross)}</span>
              </div>
            </div>
          </div>

          {/* Deductions ledger */}
          <div>
            <p className="text-xs font-bold text-[#78716C] dark:text-[#A8A29E] uppercase tracking-[0.08em] mb-2.5">Deductions</p>
            <div className="border border-[#E7E5E4] dark:border-[#292524] rounded-xl overflow-hidden">
              {[
                ...deductionLines.map((l) => [l.label, fmtCAD(l.amount)] as [string, string]),
                ...customDeductionLines.map((d) => [d.name, fmtCAD(d.amount)] as [string, string]),
              ].map(([label, value], i) => (
                <div key={label} className={`flex justify-between px-3.5 py-[9px] text-[13px] ${i % 2 === 1 ? "bg-[#FAFAF9] dark:bg-[#1C1917]" : ""}`}>
                  <span className="text-[#57534E] dark:text-[#A8A29E]">{label}</span>
                  <span className="font-mono tabular-nums dark:text-[#E7E5E4]">{value}</span>
                </div>
              ))}
              <div className="flex justify-between px-3.5 py-[11px] text-[13px] font-bold border-t-2 border-[#E7E5E4] dark:border-[#292524]">
                <span className="text-[#1C1917] dark:text-[#FAFAF9]">Total Deductions</span>
                <span className="font-mono tabular-nums text-[#B3261E] dark:text-[#E56A5C]">{fmtCAD(item.totalDeductions)}</span>
              </div>
            </div>
            {reimbursement > 0 && (
              <p className="text-[12px] text-[#78716C] dark:text-[#A8A29E] mt-2">
                Includes {fmtCAD(reimbursement)} non-taxable reimbursement added to net pay.
              </p>
            )}
          </div>
        </div>

        {/* Net Pay band */}
        <div className="mx-10 my-1 mb-6 bg-gradient-to-br from-[#FEF2F2] to-[#FEE2E2] dark:from-[#2A1110] dark:to-[#3F1413] border border-[#FECACA] dark:border-[#7F211B] rounded-[14px] px-7 py-5 flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-[#991B1B] dark:text-[#FCA5A5] uppercase tracking-[0.08em]">Net Pay</p>
            <p className="text-xs text-[#B91C1C]/80 dark:text-[#F87171]/80 mt-0.5">{paymentMethodLine}</p>
          </div>
          <span className="text-[38px] font-bold text-[#B3261E] dark:text-[#E56A5C] font-mono tabular-nums tracking-[-0.02em]">
            {fmtCAD(item.netPay)}
          </span>
        </div>

        {/* Employer + YTD */}
        <div className="px-10 pb-8 grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-bold text-[#78716C] dark:text-[#A8A29E] uppercase tracking-[0.08em] mb-2.5">Employer Costs</p>
            <div className="border border-[#E7E5E4] dark:border-[#292524] rounded-xl overflow-hidden">
              {employerLines.map((l) => [l.label, fmtCAD(l.amount)] as [string, string]).map(([label, value], i) => (
                <div key={label} className={`flex justify-between px-3.5 py-[9px] text-[13px] ${i % 2 === 1 ? "bg-[#FAFAF9] dark:bg-[#1C1917]" : ""}`}>
                  <span className="text-[#57534E] dark:text-[#A8A29E]">{label}</span>
                  <span className="font-mono tabular-nums dark:text-[#E7E5E4]">{value}</span>
                </div>
              ))}
              <div className="flex justify-between px-3.5 py-[11px] text-[13px] font-bold border-t-2 border-[#E7E5E4] dark:border-[#292524]">
                <span className="text-[#1C1917] dark:text-[#FAFAF9]">Total</span>
                <span className="font-mono tabular-nums">{fmtCAD(item.employerTotal)}</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-[#78716C] dark:text-[#A8A29E] uppercase tracking-[0.08em] mb-2.5">Year to Date · 2026</p>
            <div className="border border-[#E7E5E4] dark:border-[#292524] rounded-xl overflow-hidden">
              {[
                ["Gross Pay", fmtCAD(ytdGrossPay)], ["Income Tax", fmtCAD(ytdIncomeTax)],
                ["Pensionable", fmtCAD(item.ytdPensionable)],
                // W4-D3 — for Quebec stubs the blended insurable/EI
                // snapshots are split: EI-only here, QPIP separate.
                [isQuebec ? "Insurable (EI)" : "Insurable", fmtCAD(ytdSplit ? ytdSplit.ytdEiInsurable : item.ytdInsurable)],
                ...(isQuebec ? [["Insurable (QPIP)", fmtCAD(ytdSplit?.ytdQpipInsurable ?? 0)] as [string, string]] : []),
                [isQuebec ? "QPP" : "CPP", fmtCAD(item.ytdCpp)],
                ["EI", fmtCAD(ytdSplit ? ytdSplit.ytdEiPure : item.ytdEi)],
                ...(isQuebec ? [["QPIP", fmtCAD(ytdSplit?.ytdQpip ?? 0)] as [string, string]] : []),
                [isQuebec ? "QPP2" : "CPP2", fmtCAD(item.ytdCpp2)],
                ["Federal Tax", fmtCAD(ytdFederalTax)], [isQuebec ? "Quebec Tax" : "Provincial Tax", fmtCAD(ytdProvincialTax)],
                ...(vacBalance ? [["Vacation Balance", vacBalance] as [string, string]] : []),
              ].map(([label, value], i) => (
                <div key={label} className={`flex justify-between px-3.5 py-[9px] text-[13px] ${i % 2 === 1 ? "bg-[#FAFAF9] dark:bg-[#1C1917]" : ""}`}>
                  <span className="text-[#57534E] dark:text-[#A8A29E]">{label}</span>
                  <span className="font-mono tabular-nums dark:text-[#E7E5E4]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-4 pb-8 border-t border-[#E7E5E4] dark:border-[#292524] flex justify-between items-center">
          <span className="text-[11px] text-[#A8A29E] dark:text-[#78716C]">Generated by Nexvar Pay</span>
          <span className="text-[11px] text-[#A8A29E] dark:text-[#78716C] text-right max-w-[380px]">
            This statement is for your records. Amounts calculated per CRA payroll guidelines. Not an official CRA document.
          </span>
        </div>
      </div>
    </div>
  );
}
