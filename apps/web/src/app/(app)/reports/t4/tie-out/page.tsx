/**
 * T4 ↔ PD7A tie-out — year-end PIER-style review: T4 Summary totals against
 * the year's PD7A remittances, difference by difference, before filing.
 */
import { getT4Pd7aTieOut } from "@/lib/actions/t4-tieout";
import type { TieOutResult } from "@/lib/filings/t4-pd7a-tieout";
import Link from "next/link";

function fmtCAD(n: number): string { return `$${(n ?? 0).toFixed(2)}`; }
function fmtSigned(n: number): string { return `${n > 0 ? "+" : n < 0 ? "−" : ""}$${Math.abs(n ?? 0).toFixed(2)}`; }

export default async function T4TieOutPage() {
  const year = 2026;
  let result: TieOutResult | null = null;
  try { result = await getT4Pd7aTieOut(year); } catch {}

  return (
    <div className="space-y-6">
      <div className="text-[13px] text-[#A8A29E]">
        <Link href="/reports" className="text-[#A8A29E] no-underline">Reports</Link> ›{" "}
        <Link href="/reports/t4" className="text-[#A8A29E] no-underline">T4 slips</Link> › Tie-out
      </div>
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">T4 ↔ PD7A tie-out · {year}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The T4 Summary against the year&apos;s PD7A remittances — the check CRA&apos;s PIER review runs after filing, done here before it.
        </p>
      </div>

      {!result || result.payRunCount === 0 ? (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-12 text-center space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-base font-bold">No finalized pay runs for {year}</p>
          <p className="text-[13px] text-muted-foreground">The tie-out compares finalized pay runs — finalize at least one run to run the check.</p>
        </div>
      ) : (
        <>
          {result.tiesOut ? (
            <div className="flex gap-2.5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[10px] px-4 py-3.5 text-[13px] text-[#166534] leading-relaxed">
              <span>✅</span>
              <span><b className="text-[#166534]">Ties out.</b> The T4 Summary and the {year} PD7A remittances agree to the cent on every compared field — {result.employeeCount} employee{result.employeeCount !== 1 ? "s" : ""}, {result.payRunCount} finalized pay run{result.payRunCount !== 1 ? "s" : ""}.</span>
            </div>
          ) : (
            <div className="flex gap-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-[10px] px-4 py-3.5 text-[13px] text-[#92400E] leading-relaxed">
              <span>⚠️</span>
              <span><b className="text-[#92400E]">{result.differenceCount} difference{result.differenceCount !== 1 ? "s" : ""} to review</b> before filing the T4 Summary. Each one is listed below with its most likely cause — differences are shown individually, never netted against each other.</span>
            </div>
          )}

          <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em]">Compared totals</p>
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-5 py-3 bg-[#FAFAF9] border-b border-[#E7E5E4]">
              {["Field", "PD7A remitted", "T4 Summary", "Difference"].map((h, i) => (
                <div key={h} className={`text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em] ${i > 0 ? "text-right" : ""}`}>{h}</div>
              ))}
            </div>
            {result.comparedTotals.map((row) => (
              <div key={row.field} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-5 py-3 border-b border-[#F0EFED] last:border-b-0 items-center">
                <div className="text-[13px] font-semibold">{row.fieldLabel}</div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(row.pd7aAmount)}</div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(row.t4Amount)}</div>
                <div className={`text-[13px] text-right font-mono tabular-nums font-bold ${row.difference === 0 ? "text-[#A8A29E]" : "text-[#B3261E]"}`}>
                  {row.difference === 0 ? "— ✓" : fmtSigned(row.difference)}
                </div>
              </div>
            ))}
          </div>

          {result.differences.length > 0 && (
            <>
              <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em]">Differences to review</p>
              <div className="space-y-3">
                {result.differences.map((d, i) => (
                  <div key={`${d.scope}-${d.employeeId ?? "all"}-${d.field}-${i}`} className="bg-white border border-[#E7E5E4] rounded-[14px] px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-bold">{d.employeeName} <span className="text-[#A8A29E] font-semibold">· {d.fieldLabel}</span></p>
                      <p className="text-[13px] font-mono tabular-nums">
                        <span className="text-[#78716C]">PD7A</span> <b>{fmtCAD(d.pd7aAmount)}</b>
                        <span className="text-[#78716C]"> · T4</span> <b>{fmtCAD(d.t4Amount)}</b>
                        <span className="text-[#78716C]"> · Diff</span> <b className="text-[#B3261E]">{fmtSigned(d.difference)}</b>
                      </p>
                    </div>
                    <p className="text-[13px] text-[#57534E] leading-relaxed mt-2">{d.cause}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex gap-2.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px] px-4 py-3.5 text-[13px] text-[#1E40AF] leading-relaxed">
            <span>ℹ️</span>
            <span>The PD7A side is what the year&apos;s remittance reporting carries (stored pay-run totals); the T4 side is the slips as the T4 report builds them. Earnings boxes (24/26) are checked against the payroll engine&apos;s capped year-to-date earnings. Resolve every difference — or confirm it is one CRA accepts, like per-period rounding — before filing by <b className="text-[#1E40AF]">Feb 28, 2027</b>.</span>
          </div>
        </>
      )}
    </div>
  );
}
