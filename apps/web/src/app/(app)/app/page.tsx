/**
 * Dashboard — stats, quick actions, recent pay runs.
 */

import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PlusCircle, ClipboardList, BarChart3 } from "lucide-react";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

export default async function DashboardPage() {
  const user = await requireCompany();
  const firstName = (user.name ?? "").split(" ")[0];

  const [employeeCount, payGroupCount] = await Promise.all([
    prisma.employee.count({ where: { companyId: user.companyId, active: true } }),
    prisma.payGroup.count({ where: { companyId: user.companyId } }),
  ]);

  const recentRuns = await prisma.payRun.findMany({
    where: { companyId: user.companyId },
    include: { payGroup: { select: { name: true, frequency: true } } },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return (
    <div className="space-y-6">
      {/* Page head */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {firstName ? `Good morning, ${firstName} — ` : ""}here&apos;s where things stand.
          </p>
        </div>
        <Link href="/payroll/new" className="inline-flex items-center gap-2 rounded-[10px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-sm font-semibold px-5 py-2.5 no-underline transition-colors">
          ＋ Run payroll
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Active employees", value: String(employeeCount), foot: "All active" },
          { label: "Pay groups", value: String(payGroupCount), foot: "Configured" },
          { label: "Next pay run", value: "—", foot: "Schedule one now" },
          { label: "YTD payroll", value: fmtCAD(0), foot: "Gross, 2026" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-[#E7E5E4] rounded-[14px] p-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em]">{stat.label}</p>
            <p className="text-[30px] font-bold mt-2 font-mono tabular-nums tracking-[-0.02em]">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.foot}</p>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-5">
        {/* Quick actions */}
        <div>
          <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em] mb-3">Quick actions</p>
          <div className="space-y-3">
            {[
              { icon: PlusCircle, title: "Add an employee", desc: "Set up personal details, TD1, and pay group.", href: "/employees/new" },
              { icon: ClipboardList, title: "Run payroll", desc: "Calculate deductions and finalize a pay run.", href: "/payroll/new" },
              { icon: BarChart3, title: "View reports", desc: "T4 slips, PD7A remittance, ROE, journals.", href: "/reports" },
            ].map((qa) => (
              <Link key={qa.title} href={qa.href} className="flex gap-3.5 items-start p-[18px] border border-[#E7E5E4] rounded-xl bg-white hover:border-[#B3261E] shadow-[0_1px_3px_rgba(0,0,0,0.04)] no-underline text-inherit transition-colors">
                <div className="w-11 h-11 rounded-[11px] bg-[#FEF2F2] flex items-center justify-center text-xl flex-shrink-0">
                  <qa.icon className="h-5 w-5 text-[#B3261E]" />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-bold">{qa.title}</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">{qa.desc}</p>
                </div>
                <span className="text-[#A8A29E] text-lg mt-1">→</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent pay runs */}
        <div>
          <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em] mb-3">Recent pay runs</p>
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            {recentRuns.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No pay runs yet. Start your first one.</div>
            ) : (
              recentRuns.map((run) => (
                <Link key={run.id} href={`/payroll/${run.id}`} className="flex items-center justify-between px-[18px] py-3.5 border-b border-[#F0EFED] last:border-b-0 hover:bg-[#FAFAF9] no-underline text-inherit">
                  <div>
                    <p className="text-sm font-semibold">{run.payDate}</p>
                    <p className="text-xs text-[#A8A29E] mt-0.5">
                      {run.payGroup.name} · {run.payGroup.frequency.toLowerCase()} · {run.itemCount} employees
                    </p>
                  </div>
                  <div className="flex items-center gap-3.5">
                    <span className={`inline-flex items-center text-[11px] font-bold tracking-[0.03em] rounded-full px-2.5 py-1 ${run.status === "FINALIZED" ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEF3C7] text-[#92400E]"}`}>
                      {run.status}
                    </span>
                    <span className="text-sm font-semibold font-mono tabular-nums text-right">{fmtCAD(run.totalNetPay)}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
