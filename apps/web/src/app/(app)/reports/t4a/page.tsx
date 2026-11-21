/**
 * T4A Summary — payee slip list + T4A Summary totals + tie-out status +
 * CRA XML export. Mirrors the T4 summary page.
 */
import { getT4aReport } from "@/lib/actions/t4a";
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { StubPrintButton } from "@/components/stub-actions";
import { T4aXmlExportForm } from "@/components/t4a-xml-export";
import Link from "next/link";

function fmtCAD(n: number): string { return `$${(n ?? 0).toFixed(2)}`; }

export default async function T4aSummaryPage() {
  const year = 2026;
  const { companyId } = await requireCompany();
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { businessNumber: true },
  });
  const defaultPayerBn15 =
    company?.businessNumber && /^\d{9}$/.test(company.businessNumber)
      ? `${company.businessNumber}RP0001`
      : undefined;

  let report: Awaited<ReturnType<typeof getT4aReport>> | null = null;
  try { report = await getT4aReport(year); } catch {}

  const tied = report !== null && report.tieOutProblems.length === 0 && report.errors.length === 0;

  return (
    <div className="space-y-6">
      <div className="text-[13px] text-[#A8A29E]"><Link href="/reports" className="text-[#A8A29E] no-underline">Reports</Link> › T4A slips</div>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">T4A slips · {year}</h1>
          <p className="text-sm text-muted-foreground mt-1">Statement of pension, retirement, annuity, and other income{report ? ` · ${report.companyName}` : ""}</p>
        </div>
        <StubPrintButton />
      </div>

      {!report || (report.slips.length === 0 && report.errors.length === 0) ? (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-12 text-center space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-base font-bold">No T4A data for {year}</p>
          <p className="text-[13px] text-muted-foreground">
            T4A slips are generated from payments recorded on <Link href="/payees" className="text-[#B3261E]">payees</Link> during the year.
          </p>
        </div>
      ) : (
        <>
          {/* Tie-out status — filing output is blocked unless this is green */}
          {tied ? (
            <div className="flex gap-2.5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[10px] px-4 py-3.5 text-[13px] text-[#166534] leading-relaxed">
              ✅ <span><b>Tie-out passed.</b> Every summary total equals the sum of the slips — the CRA XML below can be generated.</span>
            </div>
          ) : (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[10px] px-4 py-3.5 text-[13px] text-[#991B1B] leading-relaxed space-y-1">
              <p><b>⛔ Filing blocked — the summary does not tie to the slips.</b></p>
              {report.tieOutProblems.map((p, i) => <p key={i}>• {p}</p>)}
            </div>
          )}

          {report.errors.length > 0 && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[10px] px-4 py-3.5 text-[13px] text-[#991B1B] leading-relaxed space-y-1">
              <p><b>⛔ {report.errors.length} payee slip(s) could not be computed</b> — their amounts are excluded from the totals and the XML:</p>
              {report.errors.map((e) => <p key={e.payeeId}>• {e.displayName}: {e.message}</p>)}
            </div>
          )}

          <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em]">Payees</p>
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3 bg-[#FAFAF9] border-b border-[#E7E5E4]">
              {["Payee", "Fees (048)", "Pension (016)", "Other inc. (028)", "Tax (022)", ""].map((h) => (
                <div key={h} className={`text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em] ${h !== "Payee" && h !== "" ? "text-right" : ""}`}>{h}</div>
              ))}
            </div>
            {report.slips.map((row) => (
              <Link key={row.payeeId} href={`/reports/t4a/${row.payeeId}`} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3.5 border-b border-[#F0EFED] last:border-b-0 items-center hover:bg-[#FAFAF9] no-underline text-inherit">
                <div className="flex items-center gap-3">
                  <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-[#B3261E] to-[#E56A5C] flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0">{row.displayName[0]}</div>
                  <div><p className="text-sm font-semibold">{row.displayName}</p><p className="text-xs text-[#A8A29E]">{row.slip.paymentCount} payment{row.slip.paymentCount !== 1 ? "s" : ""}</p></div>
                </div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(row.slip.box048)}</div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(row.slip.box016)}</div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(row.slip.otherInfo.find((o) => o.code === "028")?.amount ?? 0)}</div>
                <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(row.slip.box022)}</div>
                <div className="text-right text-[#B3261E] text-[13px] font-semibold">Slip →</div>
              </Link>
            ))}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3.5 bg-[#1C1917] text-white font-bold text-[13px] items-center">
              <div>T4A Summary · all payees</div>
              <div className="text-right font-mono tabular-nums">{fmtCAD(report.totals.totalFeesForServices)}</div>
              <div className="text-right font-mono tabular-nums">{fmtCAD(report.totals.totalPension)}</div>
              <div className="text-right font-mono tabular-nums">{fmtCAD(report.totals.totalOtherIncome)}</div>
              <div className="text-right font-mono tabular-nums">{fmtCAD(report.totals.totalIncomeTaxDeducted)}</div>
              <div></div>
            </div>
          </div>

          <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em]">T4A Summary totals</p>
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="px-5 py-4 border-b border-[#F0EFED] flex justify-between items-center">
              <span className="text-[15px] font-bold">{report.companyName}</span>
              <span className="text-[13px] text-muted-foreground">{report.totals.slipCount} slip{report.totals.slipCount !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-4 gap-3.5 p-5">
              {[
                ["016 · Pension", report.totals.totalPension],
                ["018 · Lump-sum", report.totals.totalLumpSum],
                ["020 · Commissions", report.totals.totalSelfEmployedCommissions],
                ["024 · Annuities", report.totals.totalAnnuities],
                ["048 · Fees for services", report.totals.totalFeesForServices],
                ["028 · Other income", report.totals.totalOtherIncome],
                ["030 · Patronage", report.totals.totalPatronageAllocations],
                ["032 · RPP past service", report.totals.totalPastService],
                ["034 · Pension adjustment", report.totals.totalPensionAdjustment],
                ["040 · RESP AIP", report.totals.totalRespAip],
                ["042 · RESP EAP", report.totals.totalRespEap],
                ["022 · Income tax deducted", report.totals.totalIncomeTaxDeducted],
                ["Other-info total", report.totals.totalOtherInfoAmounts],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-[11px] text-[#A8A29E] uppercase tracking-[0.05em]"><b className="text-[#1C1917] font-bold">{label as string}</b></p>
                  <p className="text-base font-bold mt-1.5 font-mono tabular-nums">{fmtCAD(value as number)}</p>
                </div>
              ))}
            </div>
          </div>

          {report.warnings.length > 0 && (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[10px] px-4 py-3.5 text-[13px] text-[#92400E] leading-relaxed space-y-1">
              <p><b>⚠️ Before you file:</b></p>
              {report.warnings.map((w, i) => <p key={i}>• {w}</p>)}
            </div>
          )}

          <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em]">CRA XML export</p>
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <T4aXmlExportForm year={year} defaultPayerBn15={defaultPayerBn15} companyName={report.companyName} />
          </div>

          <div className="flex gap-2.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px] px-4 py-3.5 text-[13px] text-[#1E40AF] leading-relaxed">
            ℹ️ Distribute slips to payees and file the T4A Summary with the CRA by <b className="text-[#1E40AF]">Feb 28, 2027</b>.
          </div>
        </>
      )}
    </div>
  );
}
