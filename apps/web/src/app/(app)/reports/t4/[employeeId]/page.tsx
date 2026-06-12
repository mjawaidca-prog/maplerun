/**
 * Individual T4 slip — CRA-style layout with box chips.
 */

import { getT4Report } from "@/lib/actions/t4";
import { requireCompany } from "@/lib/session";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { notFound } from "next/navigation";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

type Props = { params: Promise<{ employeeId: string }> };

export default async function T4SlipPage({ params }: Props) {
  const { employeeId } = await params;
  const { companyId } = await requireCompany();
  const report = await getT4Report(2026);
  const slip = report.slips.find((s) => s.employeeId === employeeId);
  if (!slip) notFound();

  return (
    <div className="space-y-6 max-w-[816px] print:max-w-full">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/reports/t4" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to T4 list
        </Link>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-[10px] border border-input bg-white px-3.5 py-2 text-sm font-medium hover:bg-accent">
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.10)] border border-[#E7E5E4] bg-white print:shadow-none print:rounded-none print:border-0">
        {/* Header */}
        <div className="px-10 py-7 border-b-[3px] border-[#B3261E] flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2.5 mb-3.5">
              <span className="text-2xl">🍁</span>
              <span className="text-lg font-extrabold tracking-tight">MapleRun</span>
            </div>
            <p className="text-[11px] text-[#A8A29E] uppercase tracking-[0.1em]">Canada Revenue Agency</p>
            <p className="text-[21px] font-bold mt-0.5 leading-tight">Statement of Remuneration Paid</p>
            <p className="text-[13px] text-[#78716C] mt-0.5">T4 · Tax Year 2026</p>
          </div>
          <div className="border-2 border-[#1C1917] rounded-lg px-4 py-2 text-center">
            <p className="text-[11px] text-[#78716C] uppercase tracking-[0.1em]">Year</p>
            <p className="text-[26px] font-bold font-mono tabular-nums">2026</p>
          </div>
        </div>

        {/* Parties */}
        <div className="px-10 py-6 grid grid-cols-2 gap-6 border-b border-[#E7E5E4]">
          <div>
            <p className="text-[11px] text-[#A8A29E] uppercase tracking-[0.08em]">Employer's name</p>
            <p className="text-base font-bold mt-0.5">{report.companyName}</p>
            <p className="text-[13px] text-[#78716C] mt-0.5">Business No. —</p>
          </div>
          <div>
            <p className="text-[11px] text-[#A8A29E] uppercase tracking-[0.08em]">Employee</p>
            <p className="text-base font-bold mt-0.5">{slip.employeeName}</p>
            <p className="text-[13px] text-[#78716C] mt-0.5">
              Province · {slip.province} &nbsp;·&nbsp; SIN <span className="font-mono tabular-nums">••• ••• •••</span>
            </p>
          </div>
        </div>

        {/* T4 boxes — 4×2 grid */}
        <div className="px-10 py-6 grid grid-cols-4 gap-3.5">
          {[
            [14, "Employment income", fmtCAD(slip.box14)],
            [22, "Income tax deducted", fmtCAD(slip.box22)],
            [16, "Employee CPP contributions", fmtCAD(slip.box16)],
            ["16A", "Employee CPP2 contributions", fmtCAD(slip.box16A)],
            [18, "Employee EI premiums", fmtCAD(slip.box18)],
            [24, "EI insurable earnings", fmtCAD(slip.box24)],
            [26, "CPP/QPP pensionable earnings", fmtCAD(slip.box26)],
            [28, "CPP/EI exempt", "—"],
          ].map(([num, label, value]) => (
            <div key={String(num)} className="border border-[#D6D3D1] rounded-[10px] p-3.5 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center min-w-[26px] h-[22px] px-1.5 bg-[#1C1917] text-white text-xs font-bold rounded-[5px] font-mono tabular-nums">
                  {num}
                </span>
                <span className="text-[11px] text-[#78716C] uppercase tracking-[0.04em] leading-tight">{label}</span>
              </div>
              <p className="text-xl font-semibold text-[#1C1917] text-right font-mono tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-10 py-[18px] pb-7 border-t border-[#E7E5E4] bg-[#FAFAF9] flex justify-between items-center">
          <p className="text-xs text-[#78716C]">
            <strong className="text-[#1C1917]">Filing deadline:</strong> Distribute to employees &amp; file with CRA by <strong className="text-[#B3261E]">Feb 28, 2027</strong>
          </p>
          <p className="text-[11px] text-[#A8A29E] text-right max-w-[320px]">
            Generated by 🍁 MapleRun. Verify against your CRA filing. Not a substitute for the official CRA T4.
          </p>
        </div>
      </div>
    </div>
  );
}
