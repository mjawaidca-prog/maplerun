/**
 * Payroll Summary report — totals grid, per-employee table, PDF/CSV export.
 */
import { getPayrollSummary } from "@/lib/actions/payroll-summary";
import { StubPrintButton } from "@/components/stub-actions";
import Link from "next/link";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

export default async function PayrollSummaryPage() {
  let summary: Awaited<ReturnType<typeof getPayrollSummary>> | null = null;
  try { summary = await getPayrollSummary(); } catch {}

  return (
    <div className="space-y-6">
      <div className="text-[13px] text-[#A8A29E]">
        <Link href="/reports" className="text-[#A8A29E] no-underline">Reports</Link> › Payroll Summary
      </div>
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Payroll Summary</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Total wages, deductions, and employer costs{summary ? ` for ${summary.companyName}` : ""}
          </p>
        </div>
        <div className="flex gap-2.5">
          <StubPrintButton />
        </div>
      </div>

      {!summary || summary.employees.length === 0 ? (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-12 text-center space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-base font-bold">No payroll data yet</p>
          <p className="text-[13px] text-muted-foreground">Finalize pay runs to see the summary here.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-5 border border-[#E7E5E4] rounded-[14px] overflow-hidden">
            {[
              ["Gross pay", summary.totals.gross], ["Total deductions", summary.totals.totalDeductions],
              ["Net pay", summary.totals.netPay], ["Employer contributions", summary.totals.employerTotal],
              ["Pay runs", summary.totals.runs],
            ].map(([label, value]) => (
              <div key={label as string} className={`bg-white p-4 ${label === "Net pay" ? "bg-gradient-to-br from-[#FEF2F2] to-[#FEE2E2]" : ""}`}>
                <p className={`text-[11px] font-bold uppercase tracking-[0.06em] ${label === "Net pay" ? "text-[#991B1B]" : "text-[#A8A29E]"}`}>
                  {label as string}
                </p>
                <p className={`text-[22px] font-bold mt-1.5 tracking-[-0.01em] font-mono tabular-nums ${label === "Net pay" ? "text-[#B3261E]" : ""}`}>
                  {label === "Pay runs" ? value : fmtCAD(value as number)}
                </p>
              </div>
            ))}
          </div>

          <div className="flex gap-[22px] text-xs text-muted-foreground px-0.5">
            <span><b className="text-[#1C1917] font-bold">{summary.totals.employees}</b> employees</span>
            <span><b className="text-[#1C1917] font-bold">{summary.totals.runs}</b> finalized pay runs</span>
          </div>

          <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em]">By employee</p>
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <table className="w-full">
              <thead>
                <tr className="bg-[#FAFAF9] text-[11px] font-bold text-[#78716C] uppercase tracking-[0.04em]">
                  {["Employee","Gross","CPP","EI","Tax","Deductions","Net"].map(h=>(
                    <th key={h} className={`px-3.5 py-[11px] ${h==="Employee"?"text-left":"text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.employees.map(emp=>(
                  <tr key={emp.id} className="border-b border-[#F0EFED] hover:bg-[#FAFAF9]">
                    <td className="px-3.5 py-3 text-[13px]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#B3261E] to-[#E56A5C] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">{emp.initial}</div>
                        <p className="text-[13px] font-semibold">{emp.name}</p>
                      </div>
                    </td>
                    <td className="text-right px-3.5 py-3 text-[13px] font-mono tabular-nums">{fmtCAD(emp.gross)}</td>
                    <td className="text-right px-3.5 py-3 text-[13px] font-mono tabular-nums">{fmtCAD(emp.cpp)}</td>
                    <td className="text-right px-3.5 py-3 text-[13px] font-mono tabular-nums">{fmtCAD(emp.ei)}</td>
                    <td className="text-right px-3.5 py-3 text-[13px] font-mono tabular-nums">{fmtCAD(emp.federalTax+emp.provincialTax)}</td>
                    <td className="text-right px-3.5 py-3 text-[13px] font-mono tabular-nums">{fmtCAD(emp.totalDeductions)}</td>
                    <td className="text-right px-3.5 py-3 text-[13px] font-bold text-[#B3261E] font-mono tabular-nums">{fmtCAD(emp.netPay)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#1C1917] text-white font-bold text-[13px]">
                  <td className="text-left px-3.5 py-3.5">Totals</td>
                  <td className="text-right px-3.5 py-3.5 font-mono tabular-nums">{fmtCAD(summary.totals.gross)}</td>
                  <td className="text-right px-3.5 py-3.5 font-mono tabular-nums">{fmtCAD(summary.totals.cpp)}</td>
                  <td className="text-right px-3.5 py-3.5 font-mono tabular-nums">{fmtCAD(summary.totals.ei)}</td>
                  <td className="text-right px-3.5 py-3.5 font-mono tabular-nums">{fmtCAD(summary.totals.federalTax+summary.totals.provincialTax)}</td>
                  <td className="text-right px-3.5 py-3.5 font-mono tabular-nums">{fmtCAD(summary.totals.totalDeductions)}</td>
                  <td className="text-right px-3.5 py-3.5 font-mono tabular-nums">{fmtCAD(summary.totals.netPay)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex gap-[11px] bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px] px-4 py-3.5 text-[12.5px] text-[#1E40AF] leading-relaxed">
            ℹ️ Figures are aggregated from <b>{summary.totals.runs}</b> finalized pay runs. Verify against your CRA payroll account before filing.
          </div>
        </>
      )}
    </div>
  );
}
