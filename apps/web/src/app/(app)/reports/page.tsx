/**
 * Reports dashboard — T4, PD7A, ROE, Payroll Journal cards with lock states.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPd7aReport } from "@/lib/actions/reports";
import { can, type Plan } from "@/lib/plan";
import Link from "next/link";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

export default async function ReportsDashboardPage() {
  const { companyId } = await requireCompany();
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { plan: true } });
  const plan: Plan = (company?.plan as Plan) ?? "growth";
  const year = new Date().getFullYear();
  let pd7aTotal = 0;
  try { const report = await getPd7aReport(year, "monthly"); pd7aTotal = report.totals.totalRemittance; } catch {}

  const allCards = [
    { href: "/reports/t4", icon: "📄", title: "T4 slips", desc: "Statement of remuneration paid for each employee.", metric: `${year} · available`, metricVal: "Ready", feature: null },
    { href: "/reports", icon: "🧾", title: "PD7A remittance", desc: "Source deductions owed to the CRA this period.", metric: pd7aTotal > 0 ? `YTD ${year}` : "No data", metricVal: pd7aTotal > 0 ? fmtCAD(pd7aTotal) : "—", feature: null },
    { href: "/reports/summary", icon: "📄", title: "Payroll summary", desc: "Aggregated wages, deductions, and employer costs.", metric: "All runs", metricVal: "View", feature: "reportsCore" },
    { href: "/reports/gl", icon: "📒", title: "GL journal", desc: "Debit/credit entries ready for accounting software.", metric: "Per pay run", metricVal: "View", feature: "payrollJournal" },
    { href: "/reports/roe", icon: "📋", title: "Record of Employment (ROE)", desc: "Generate ROEs for terminations and leaves.", metric: "Service Canada", metricVal: "View", feature: "roe" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Year-end filings, remittances, and records.</p>
      </div>

      <div className="grid grid-cols-2 gap-[18px]">
        {allCards.map(card => {
          const isLocked = card.feature && !can(plan, card.feature!);
          if (isLocked) {
            return (
              <div key={card.title} className="relative bg-[#FAFAF9] border border-[#E7E5E4] rounded-[14px] p-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <span className="absolute top-[22px] right-[22px] inline-flex items-center gap-1.5 text-[11px] font-bold bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] rounded-full px-2.5 py-1">🔒 Accountant</span>
                <div className="w-[46px] h-[46px] rounded-xl bg-[#FEF2F2] flex items-center justify-center text-[22px] mb-4" style={{filter:"grayscale(1)",opacity:.55}}>{card.icon}</div>
                <h3 className="text-base font-bold text-[#A8A29E]">{card.title}</h3>
                <p className="text-[13px] text-[#A8A29E] mt-1.5 leading-relaxed">{card.desc}</p>
                <Link href="/company?tab=billing" className="inline-flex items-center gap-1.5 mt-4 text-[13px] font-semibold bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] rounded-[9px] px-3.5 py-2 no-underline">Upgrade to unlock →</Link>
              </div>
            );
          }
          return (
            <Link key={card.title} href={card.href} className="relative bg-white border border-[#E7E5E4] rounded-[14px] p-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-[#B3261E] no-underline text-inherit block transition-colors">
              <span className="absolute top-6 right-6 text-[#A8A29E] text-base">→</span>
              <div className="w-[46px] h-[46px] rounded-xl bg-[#FEF2F2] flex items-center justify-center text-[22px] mb-4">{card.icon}</div>
              <h3 className="text-base font-bold">{card.title}</h3>
              <p className="text-[13px] text-[#78716C] mt-1.5 leading-relaxed">{card.desc}</p>
              {card.metric && (
                <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-[#F0EFED]">
                  <span className="text-xs text-[#A8A29E]">{card.metric}</span>
                  <span className="text-[15px] font-bold font-mono tabular-nums">{card.metricVal}</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
