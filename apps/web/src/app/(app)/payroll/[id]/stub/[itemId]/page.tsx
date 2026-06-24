/**
 * Employee pay stub — premium bank-statement design. Light + dark.
 */

import { getPayRun } from "@/lib/actions/payroll";
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
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
  const item = payRun.items.find((i) => i.id === itemId);
  if (!item) notFound();
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true, businessNumber: true } });
  const employee = await prisma.employee.findUnique({
    where: { id: item.employeeId },
    select: { firstName: true, lastName: true, addressLine1: true, city: true, province: true, postalCode: true },
  });

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
            <p className="text-[13px] opacity-90 mt-1">Period End · {payRun.payDate}</p>
            {payRun.actualPayDate && payRun.actualPayDate !== payRun.payDate && (
              <p className="text-[13px] opacity-90 mt-1">Pay Date · {payRun.actualPayDate}</p>
            )}
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
            <p className="text-xs text-[#A8A29E] uppercase tracking-[0.08em] font-semibold">Pay Period</p>
            <p className="text-sm font-semibold text-[#1C1917] dark:text-[#FAFAF9] mt-0.5">
              {payRun.payGroup.frequency.toLowerCase()} · {payRun.payDate}
            </p>
          </div>
        </div>

        {/* Earnings / Deductions grid */}
        <div className="px-10 py-6 grid grid-cols-2 gap-6">
          {/* Earnings */}
          <div>
            <p className="text-xs font-bold text-[#78716C] dark:text-[#A8A29E] uppercase tracking-[0.08em] mb-2.5">Earnings</p>
            <div className="bg-[#F0FDF4] dark:bg-[#0F2A17] border border-[#BBF7D0] dark:border-[#166534] rounded-xl p-4 flex justify-between items-center">
              <div>
                <span className="text-sm text-[#15803D] dark:text-[#4ADE80] font-medium">Gross Pay</span>
                {item.hours > 0 && (
                  <p className="text-[11px] text-[#15803D]/70 dark:text-[#4ADE80]/70 mt-0.5">
                    {item.hours} hours · {fmtCAD(item.gross / item.hours)}/hr
                  </p>
                )}
              {item.vacationPay > 0 && (
                <p className="text-[11px] text-[#15803D]/70 dark:text-[#4ADE80]/70 mt-0.5">
                  Incl. {fmtCAD(item.vacationPay)} vacation pay ({(item.vacationPayRate * 100).toFixed(1)}%)
                </p>
              )}
              </div>
              <span className="text-xl font-semibold text-[#15803D] dark:text-[#4ADE80] font-mono tabular-nums">{fmtCAD(item.gross)}</span>
            </div>
          </div>

          {/* Deductions ledger */}
          <div>
            <p className="text-xs font-bold text-[#78716C] dark:text-[#A8A29E] uppercase tracking-[0.08em] mb-2.5">Deductions</p>
            <div className="border border-[#E7E5E4] dark:border-[#292524] rounded-xl overflow-hidden">
              {[
                ["CPP", fmtCAD(item.cpp)], ["CPP2", fmtCAD(item.cpp2)], ["EI", fmtCAD(item.ei)],
                ["Federal Tax", fmtCAD(item.federalTax)], ["Provincial Tax", fmtCAD(item.provincialTax)],
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
          </div>
        </div>

        {/* Net Pay band */}
        <div className="mx-10 my-1 mb-6 bg-gradient-to-br from-[#FEF2F2] to-[#FEE2E2] dark:from-[#2A1110] dark:to-[#3F1413] border border-[#FECACA] dark:border-[#7F211B] rounded-[14px] px-7 py-5 flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-[#991B1B] dark:text-[#FCA5A5] uppercase tracking-[0.08em]">Net Pay</p>
            <p className="text-xs text-[#B91C1C]/80 dark:text-[#F87171]/80 mt-0.5">Deposited to account •••• XXXX</p>
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
              {[
                ["CPP Match", fmtCAD(item.employerCpp)], ["CPP2 Match", fmtCAD(item.employerCpp2)],
                ["EI (1.4×)", fmtCAD(item.employerEi)],
              ].map(([label, value], i) => (
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
                ["Pensionable", fmtCAD(item.ytdPensionable)], ["Insurable", fmtCAD(item.ytdInsurable)],
                ["CPP", fmtCAD(item.ytdCpp)], ["EI", fmtCAD(item.ytdEi)], ["CPP2", fmtCAD(item.ytdCpp2)],
                ["Federal Tax", fmtCAD(ytdFederalTax)], ["Provincial Tax", fmtCAD(ytdProvincialTax)],
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
