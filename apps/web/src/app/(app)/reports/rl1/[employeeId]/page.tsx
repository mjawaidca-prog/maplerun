/**
 * Individual RL-1 slip — Revenu Québec-style layout with ALL boxes and the
 * module's coherence warnings shown verbatim (warnings appear here, never
 * on the printed slip PDF).
 */

import { getRl1Report } from "@/lib/actions/rl1";
import { Logo } from "@/components/logo";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

type Props = { params: Promise<{ employeeId: string }> };

export default async function Rl1SlipPage({ params }: Props) {
  const { employeeId } = await params;
  const year = 2026;
  const report = await getRl1Report(year);
  const slip = report.slips.find((s) => s.employeeId === employeeId);
  if (!slip) notFound();

  const boxes: Array<[string, string, number]> = [
    ["A", "Employment income", slip.boxA],
    ["B.A", "QPP contribution — base + first additional", slip.boxBA],
    ["B.B", "QPP contribution — second additional", slip.boxBB],
    ["C", "EI premiums", slip.boxC],
    ["D", "RPP contributions", slip.boxD],
    ["E", "Québec income tax withheld", slip.boxE],
    ["F", "Union dues", slip.boxF],
    ["G", "QPP pensionable salary/wages", slip.boxG],
    ["H", "QPIP premiums", slip.boxH],
    ["I", "QPIP eligible salary/wages", slip.boxI],
    ["J", "Employer-paid private health services plan", slip.boxJ],
    ["K", "Trips — designated remote areas", slip.boxK],
    ["L", "Other taxable benefits", slip.boxL],
    ["M", "Commissions", slip.boxM],
    ["N", "Charitable donations and gifts", slip.boxN],
    ["O", "Other income", slip.boxO],
    ["Q", "Deferred salary/wages", slip.boxQ],
    ["R", "Income situated on a reserve or premises", slip.boxR],
    ["T", "Tips allocated by the employer", slip.boxT],
  ];

  return (
    <div className="space-y-6 max-w-[816px]">
      <div className="flex items-center justify-between">
        <Link href="/reports/rl1" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to RL-1 list
        </Link>
        <a href={`/reports/rl1/${slip.employeeId}/pdf?year=${year}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold bg-white border border-[#E7E5E4] rounded-[9px] px-3.5 py-2 no-underline text-inherit shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          Download slip PDF
        </a>
      </div>

      <div className="rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.10)] border border-[#E7E5E4] bg-white">
        {/* Header */}
        <div className="px-10 py-7 border-b-[3px] border-[#B3261E] flex justify-between items-start">
          <div>
            <div className="mb-3.5">
              <Logo size={28} />
            </div>
            <p className="text-[11px] text-[#A8A29E] uppercase tracking-[0.1em]">Revenu Québec</p>
            <p className="text-[21px] font-bold mt-0.5 leading-tight">Relevé 1 — Employment and Other Income</p>
            <p className="text-[13px] text-[#78716C] mt-0.5">RL-1 · Tax Year {year}</p>
          </div>
          <div className="border-2 border-[#1C1917] rounded-lg px-4 py-2 text-center">
            <p className="text-[11px] text-[#78716C] uppercase tracking-[0.1em]">Year</p>
            <p className="text-[26px] font-bold font-mono tabular-nums">{year}</p>
          </div>
        </div>

        {/* Parties */}
        <div className="px-10 py-6 grid grid-cols-2 gap-6 border-b border-[#E7E5E4]">
          <div>
            <p className="text-[11px] text-[#A8A29E] uppercase tracking-[0.08em]">Employer&apos;s name</p>
            <p className="text-base font-bold mt-0.5">{report.companyName}</p>
          </div>
          <div>
            <p className="text-[11px] text-[#A8A29E] uppercase tracking-[0.08em]">Employee</p>
            <p className="text-base font-bold mt-0.5">{slip.employeeName}</p>
            <p className="text-[13px] text-[#78716C] mt-0.5">Province of employment · QC</p>
          </div>
        </div>

        {/* All RL-1 boxes */}
        <div className="px-10 py-6 grid grid-cols-3 gap-3.5">
          {boxes.map(([letter, label, value]) => (
            <div key={letter} className="border border-[#D6D3D1] rounded-[10px] p-3.5 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center min-w-[26px] h-[22px] px-1.5 bg-[#1C1917] text-white text-xs font-bold rounded-[5px] font-mono tabular-nums">
                  {letter}
                </span>
                <span className="text-[11px] text-[#78716C] uppercase tracking-[0.04em] leading-tight">{label}</span>
              </div>
              <p className="text-xl font-semibold text-[#1C1917] text-right font-mono tabular-nums">{fmtCAD(value)}</p>
            </div>
          ))}
          <div className="border border-[#D6D3D1] rounded-[10px] p-3.5 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center min-w-[26px] h-[22px] px-1.5 bg-[#1C1917] text-white text-xs font-bold rounded-[5px] font-mono tabular-nums">B</span>
              <span className="text-[11px] text-[#78716C] uppercase tracking-[0.04em] leading-tight">Total QPP (B.A + B.B)</span>
            </div>
            <p className="text-xl font-semibold text-[#1C1917] text-right font-mono tabular-nums">{fmtCAD(slip.qppTotal)}</p>
          </div>
          {slip.caseOCode && (
            <div className="border border-[#D6D3D1] rounded-[10px] p-3.5 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center min-w-[26px] h-[22px] px-1.5 bg-[#1C1917] text-white text-xs font-bold rounded-[5px] font-mono tabular-nums">O code</span>
                <span className="text-[11px] text-[#78716C] uppercase tracking-[0.04em] leading-tight">Code (case O)</span>
              </div>
              <p className="text-xl font-semibold text-[#1C1917] text-right font-mono tabular-nums">{slip.caseOCode}</p>
            </div>
          )}
        </div>

        {/* Warnings — verbatim from the filings module */}
        {slip.warnings.length > 0 && (
          <div className="mx-10 mb-6 flex flex-col gap-1.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-[10px] px-4 py-3.5 text-[13px] text-[#92400E] leading-relaxed">
            <p className="font-bold">Coherence warnings — review before filing:</p>
            {slip.warnings.map((w) => (
              <p key={w}>⚠️ {w}</p>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-10 py-[18px] pb-7 border-t border-[#E7E5E4] bg-[#FAFAF9] flex justify-between items-center">
          <p className="text-xs text-[#78716C]">
            <strong className="text-[#1C1917]">Filing:</strong> RL-1 slips and the RL-1 Summary are due to Revenu Québec by the last day of February {year + 1}.
          </p>
          <p className="text-[11px] text-[#A8A29E] text-right max-w-[320px]">
            Generated by Nexvar Pay. Verify against your Revenu Québec filing. Not a substitute for the official RL-1.
          </p>
        </div>
      </div>

      <div className="flex gap-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-[10px] px-4 py-3.5 text-[13px] text-[#92400E] leading-relaxed">
        <span>ℹ️ RL-1 XML transmission requires Revenu Québec software-partner registration and is not yet available. These slips and the data export are provided for filing through authorized software or an accountant.</span>
      </div>
    </div>
  );
}
