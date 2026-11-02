/**
 * RL-1 slips list — Québec employees for the year, key boxes, totals,
 * data-export download, and the honest no-XML statement.
 */
import { getRl1Report } from "@/lib/actions/rl1";
import Link from "next/link";

function fmtCAD(n: number): string { return `$${(n ?? 0).toFixed(2)}`; }

export default async function Rl1ListPage() {
  const year = 2026;
  let report: Awaited<ReturnType<typeof getRl1Report>> | null = null;
  try { report = await getRl1Report(year); } catch {}

  return (
    <div className="space-y-6">
      <div className="text-[13px] text-[#A8A29E]"><Link href="/reports" className="text-[#A8A29E] no-underline">Reports</Link> › RL-1 slips</div>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">RL-1 slips · {year}</h1>
          <p className="text-sm text-muted-foreground mt-1">Revenu Québec statement of employment income{report ? ` · ${report.companyName}` : ""}</p>
        </div>
        {report && report.slips.length > 0 && (
          <a href={`/reports/rl1/export?year=${year}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold bg-white border border-[#E7E5E4] rounded-[9px] px-3.5 py-2 no-underline text-inherit shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            Download data export (JSON)
          </a>
        )}
      </div>

      {!report || report.slips.length === 0 ? (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-12 text-center space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-base font-bold">No Québec employees for {year}</p>
          <p className="text-[13px] text-muted-foreground">RL-1 slips are generated from finalized pay runs with QPP/QPIP amounts. This company has no Québec payroll for {year}.</p>
        </div>
      ) : (
        <>
          <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em]">Employees</p>
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3 bg-[#FAFAF9] border-b border-[#E7E5E4]">
              {["Employee", "A · Income", "B.A · QPP", "B.B · QPP2", "C · EI", "E · QC tax", "H · QPIP", "I · QPIP earn.", ""].map((h) => <div key={h} className={`text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em] ${h !== "Employee" ? "text-right" : ""}`}>{h}</div>)}
            </div>
            {report.slips.map((slip) => (
              <Link key={slip.employeeId} href={`/reports/rl1/${slip.employeeId}`} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3.5 border-b border-[#F0EFED] last:border-b-0 items-center hover:bg-[#FAFAF9] no-underline text-inherit">
                <div className="flex items-center gap-3">
                  <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-[#B3261E] to-[#E56A5C] flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0">{slip.employeeName[0]}</div>
                  <div>
                    <p className="text-sm font-semibold">{slip.employeeName}</p>
                    <p className="text-xs text-[#A8A29E]">Box G (QPP pensionable) {fmtCAD(slip.boxG)}{slip.warnings.length > 0 ? ` · ${slip.warnings.length} warning${slip.warnings.length !== 1 ? "s" : ""}` : ""}</p>
                  </div>
                </div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(slip.boxA)}</div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(slip.boxBA)}</div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(slip.boxBB)}</div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(slip.boxC)}</div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(slip.boxE)}</div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(slip.boxH)}</div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(slip.boxI)}</div>
                <div className="text-right text-[#B3261E] text-[13px] font-semibold">Slip →</div>
              </Link>
            ))}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3.5 bg-[#1C1917] text-white font-bold text-[13px] items-center">
              <div>RL-1 totals · all employees</div>
              <div className="text-right font-mono tabular-nums">{fmtCAD(report.totals.boxA)}</div>
              <div className="text-right font-mono tabular-nums">{fmtCAD(report.totals.boxBA)}</div>
              <div className="text-right font-mono tabular-nums">{fmtCAD(report.totals.boxBB)}</div>
              <div className="text-right font-mono tabular-nums">{fmtCAD(report.totals.boxC)}</div>
              <div className="text-right font-mono tabular-nums">{fmtCAD(report.totals.boxE)}</div>
              <div className="text-right font-mono tabular-nums">{fmtCAD(report.totals.boxH)}</div>
              <div className="text-right font-mono tabular-nums">{fmtCAD(report.totals.boxI)}</div>
              <div></div>
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-[10px] px-4 py-3.5 text-[13px] text-[#92400E] leading-relaxed">
        <span>ℹ️ RL-1 XML transmission requires Revenu Québec software-partner registration and is not yet available. The slips and the data export above are provided for filing through authorized software or an accountant.</span>
      </div>
    </div>
  );
}
