/**
 * T4 Summary — employee list + T4 Summary totals with dark total row.
 */
import { getT4Report } from "@/lib/actions/t4";
import { StubPrintButton } from "@/components/stub-actions";
import Link from "next/link";

function fmtCAD(n: number): string { return `$${(n ?? 0).toFixed(2)}`; }

export default async function T4SummaryPage() {
  const year = 2026;
  let report: Awaited<ReturnType<typeof getT4Report>> | null = null;
  try { report = await getT4Report(year); } catch {}

  return (
    <div className="space-y-6">
      <div className="text-[13px] text-[#A8A29E]"><Link href="/reports" className="text-[#A8A29E] no-underline">Reports</Link> › T4 slips</div>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">T4 slips · {year}</h1>
          <p className="text-sm text-muted-foreground mt-1">Statement of remuneration paid{report ? ` · ${report.companyName}` : ""}</p>
        </div>
        <StubPrintButton />
      </div>

      {!report || report.slips.length === 0 ? (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-12 text-center space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-base font-bold">No T4 data for {year}</p>
          <p className="text-[13px] text-muted-foreground">T4 slips are generated from finalized pay runs.</p>
        </div>
      ) : (
        <>
          <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em]">Employees</p>
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3 bg-[#FAFAF9] border-b border-[#E7E5E4]">
              {["Employee","Income (14)","CPP (16)","EI (18)","Tax (22)",""].map(h=><div key={h} className={`text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em] ${h!=="Employee"?"text-right":""}`}>{h}</div>)}
            </div>
            {report.slips.map(slip=>(
              <Link key={slip.employeeId} href={`/reports/t4/${slip.employeeId}`} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3.5 border-b border-[#F0EFED] last:border-b-0 items-center hover:bg-[#FAFAF9] no-underline text-inherit">
                <div className="flex items-center gap-3">
                  <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-[#B3261E] to-[#E56A5C] flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0">{slip.employeeName[0]}</div>
                  <div><p className="text-sm font-semibold">{slip.employeeName}</p><p className="text-xs text-[#A8A29E]">{slip.payPeriods} pay period{slip.payPeriods !== 1 ? "s" : ""}</p></div>
                </div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(slip.box14)}</div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(slip.box16)}</div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(slip.box18)}</div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(slip.box22)}</div>
                <div className="text-right text-[#B3261E] text-[13px] font-semibold">Slip →</div>
              </Link>
            ))}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3.5 bg-[#1C1917] text-white font-bold text-[13px] items-center">
              <div>T4 Summary · all employees</div>
              <div className="text-right font-mono tabular-nums">{fmtCAD(report.totals.box14)}</div>
              <div className="text-right font-mono tabular-nums">{fmtCAD(report.totals.box16)}</div>
              <div className="text-right font-mono tabular-nums">{fmtCAD(report.totals.box18)}</div>
              <div className="text-right font-mono tabular-nums">{fmtCAD(report.totals.box22)}</div>
              <div></div>
            </div>
          </div>

          <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em]">T4 Summary totals</p>
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="px-5 py-4 border-b border-[#F0EFED] flex justify-between items-center"><span className="text-[15px] font-bold">{report.companyName}</span></div>
            <div className="grid grid-cols-4 gap-3.5 p-5">
              {[["Box 14 · Employment income",report.totals.box14],["Box 16 · CPP",report.totals.box16],["Box 16A · CPP2",report.totals.box16A],["Box 18 · EI",report.totals.box18],["Box 22 · Income tax",report.totals.box22],["Box 24 · EI earnings",report.totals.box24],["Box 26 · Pensionable",report.totals.box26],["Employer remitted","—"]].map(([label,value])=>(
                <div key={label as string}><p className="text-[11px] text-[#A8A29E] uppercase tracking-[0.05em]"><b className="text-[#1C1917] font-bold">{label as string}</b></p><p className="text-base font-bold mt-1.5 font-mono tabular-nums">{typeof value === "number" ? fmtCAD(value) : value}</p></div>
              ))}
            </div>
          </div>

          <div className="flex gap-2.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px] px-4 py-3.5 text-[13px] text-[#1E40AF] leading-relaxed">
            ℹ️ Distribute slips to employees and file the T4 Summary with the CRA by <b className="text-[#1E40AF]">Feb 28, 2027</b>. Figures use 2026 rate tables; past years keep their own rates.
          </div>
        </>
      )}
    </div>
  );
}
