/**
 * Dashboard — completely different layout per plan tier.
 * Solo: minimal essentials + upsell. Growth: remittance tracking + recent runs.
 * Accountant: compliance panel + action alerts + year-end readiness.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can, type Plan } from "@/lib/plan";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusCircle, ClipboardList, BarChart3, AlertTriangle } from "lucide-react";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ checkout?: string; plan?: string }> }) {
  const user = await requireCompany();
  const firstName = (user.name ?? "").split(" ")[0];
  const params = await searchParams;

  if (params.checkout === "success" && params.plan) {
    const validPlans: Plan[] = ["solo", "growth", "accountant"];
    if (validPlans.includes(params.plan as Plan)) {
      await prisma.company.update({ where: { id: user.companyId }, data: { plan: params.plan } });
      redirect("/app");
    }
  }

  const [employeeCount, payGroupCount, company, ytdRuns] = await Promise.all([
    prisma.employee.count({ where: { companyId: user.companyId, active: true } }),
    prisma.payGroup.count({ where: { companyId: user.companyId } }),
    prisma.company.findUnique({ where: { id: user.companyId }, select: { plan: true, freePayRunsUsed: true, maxFreePayRuns: true, name: true } }),
    prisma.payRun.findMany({ where: { companyId: user.companyId, status: "FINALIZED" }, select: { totalGross: true, totalEmployerCost: true, totalDeductions: true, totalNetPay: true } }),
  ]);
  const plan: Plan = (company?.plan as Plan) ?? "growth";
  const ytdGross = ytdRuns.reduce((s, r) => s + r.totalGross, 0);
  const ytdNet = ytdRuns.reduce((s, r) => s + r.totalNetPay, 0);
  const remainingFree = (company?.maxFreePayRuns ?? 2) - (company?.freePayRunsUsed ?? 0);

  const recentRuns = await prisma.payRun.findMany({
    where: { companyId: user.companyId },
    include: { payGroup: { select: { name: true, frequency: true } } },
    orderBy: { createdAt: "desc" }, take: 3,
  });

  return (
    <div className="space-y-6">
      {/* Page head */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {firstName ? `Good morning, ${firstName} — ` : ""}{company?.name ?? "MapleRun"}
          </p>
        </div>
        <Link href="/payroll/new" className="inline-flex items-center gap-2 rounded-[10px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-sm font-semibold px-5 py-2.5 no-underline transition-colors">
          ＋ Run payroll
        </Link>
      </div>

      {/* ═══ SOLO — minimal essentials ═══ */}
      {plan === "solo" && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <Stat label="Active employees" value={String(employeeCount)} foot="All active" />
            <Stat label="Pay groups" value={String(payGroupCount)} foot="Configured" />
            <Stat label="Free runs left" value={String(remainingFree)} foot={`${company?.freePayRunsUsed ?? 0}/${company?.maxFreePayRuns ?? 2} used`} />
            <Stat label="YTD payroll" value={fmtCAD(ytdGross)} foot="Gross, 2026" />
          </div>

          {/* Upsell card */}
          <div className="bg-white border-2 border-[#0891B2]/20 rounded-[14px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#ECFEFF] flex items-center justify-center text-2xl">📈</div>
              <div className="flex-1">
                <p className="text-base font-bold">Grow your business</p>
                <p className="text-[13px] text-muted-foreground mt-1">Add timesheets, remittance tracking, and detailed reports with the Growth plan.</p>
              </div>
              <Link href="/company?tab=billing" className="rounded-[9px] bg-[#0891B2] hover:bg-[#0E7490] text-white text-[13px] font-semibold px-[18px] py-2.5 no-underline transition-colors whitespace-nowrap">
                Upgrade →
              </Link>
            </div>
          </div>
        </>
      )}

      {/* ═══ GROWTH — standard operating dashboard ═══ */}
      {plan === "growth" && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <Stat label="Active employees" value={String(employeeCount)} foot="All active" />
            <Stat label="Pay groups" value={String(payGroupCount)} foot="Configured" />
            <Stat label="Next pay run" value="—" foot="Schedule now" />
            <Stat label="YTD payroll" value={fmtCAD(ytdGross)} foot="Gross, 2026" />
          </div>

          {/* Remittance + EFT row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em]">CRA remittance due</p>
              <p className="text-[30px] font-bold mt-2 font-mono tabular-nums tracking-[-0.02em] text-[#D97706]">
                {fmtCAD(ytdRuns.reduce((s,r)=>s+r.totalDeductions+r.totalEmployerCost,0))}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Next deadline · 15th</p>
            </div>
            <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em]">EFT / Direct Deposit</p>
              <p className="text-[30px] font-bold mt-2 font-mono tabular-nums tracking-[-0.02em] text-[#16A34A]">{recentRuns.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Runs processed</p>
            </div>
            <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em]">Employer cost YTD</p>
              <p className="text-[30px] font-bold mt-2 font-mono tabular-nums tracking-[-0.02em]">
                {fmtCAD(ytdRuns.reduce((s,r)=>s+r.totalEmployerCost,0))}
              </p>
              <p className="text-xs text-muted-foreground mt-1">CPP + EI match</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em] mb-3">Quick actions</p>
              <div className="space-y-3">
                {[
                  { icon: PlusCircle, title: "Add an employee", desc: "Set up TD1 and payroll details.", href: "/employees/new" },
                  { icon: ClipboardList, title: "Run payroll", desc: "Enter amounts → preview deductions → finalize.", href: "/payroll/new" },
                  { icon: BarChart3, title: "Post to payroll", desc: "Review and finalize draft pay runs.", href: "/payroll" },
                  { icon: BarChart3, title: "View reports", desc: "T4 slips, PD7A, ROE, payroll summary.", href: "/reports" },
                ].map((qa) => (
                  <Link key={qa.title} href={qa.href} className="flex gap-3.5 items-start p-[18px] border border-[#E7E5E4] rounded-xl bg-white hover:border-[#B3261E] shadow-[0_1px_3px_rgba(0,0,0,0.04)] no-underline text-inherit transition-colors">
                    <div className="w-11 h-11 rounded-[11px] bg-[#FEF2F2] flex items-center justify-center text-xl flex-shrink-0"><qa.icon className="h-5 w-5 text-[#B3261E]" /></div>
                    <div className="flex-1"><p className="text-[15px] font-bold">{qa.title}</p><p className="text-[13px] text-muted-foreground mt-0.5">{qa.desc}</p></div>
                    <span className="text-[#A8A29E] text-lg mt-1">→</span>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em] mb-3">Recent pay runs</p>
              <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                {recentRuns.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No pay runs yet.</div>
                ) : recentRuns.map((run) => (
                  <Link key={run.id} href={`/payroll/${run.id}`} className="flex items-center justify-between px-[18px] py-3.5 border-b border-[#F0EFED] last:border-b-0 hover:bg-[#FAFAF9] no-underline text-inherit">
                    <div><p className="text-sm font-semibold">{run.payDate}</p><p className="text-xs text-[#A8A29E] mt-0.5">{run.payGroup.name} · {run.itemCount} employees</p></div>
                    <div className="flex items-center gap-3.5">
                      <span className={`inline-flex items-center text-[11px] font-bold tracking-[0.03em] rounded-full px-2.5 py-1 ${run.status==="FINALIZED"?"bg-[#DCFCE7] text-[#15803D]":"bg-[#FEF3C7] text-[#92400E]"}`}>{run.status}</span>
                      <span className="text-sm font-semibold font-mono tabular-nums">{fmtCAD(run.totalNetPay)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ ACCOUNTANT — full compliance + year-end ═══ */}
      {plan === "accountant" && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <Stat label="Active employees" value={String(employeeCount)} foot="All active" />
            <Stat label="Next pay run" value="—" foot="Schedule now" />
            <Stat label="YTD payroll" value={fmtCAD(ytdGross)} foot="Gross, 2026" />
            <Stat label="YTD net deposited" value={fmtCAD(ytdNet)} foot="To employees" />
          </div>

          {/* Remittance + EFT + Employer row */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em]">CRA remittance due</p>
              <p className="text-[30px] font-bold mt-2 font-mono tabular-nums tracking-[-0.02em] text-[#D97706]">
                {fmtCAD(ytdRuns.reduce((s,r)=>s+r.totalDeductions+r.totalEmployerCost,0))}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Due by 15th of next month</p>
            </div>
            <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em]">EFT files</p>
              <p className="text-[30px] font-bold mt-2 font-mono tabular-nums tracking-[-0.02em] text-[#16A34A]">{recentRuns.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Ready for upload</p>
            </div>
            <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em]">Employer cost YTD</p>
              <p className="text-[30px] font-bold mt-2 font-mono tabular-nums tracking-[-0.02em]">{fmtCAD(ytdRuns.reduce((s,r)=>s+r.totalEmployerCost,0))}</p>
              <p className="text-xs text-muted-foreground mt-1">CPP + EI match</p>
            </div>
            <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em]">YTD net deposited</p>
              <p className="text-[30px] font-bold mt-2 font-mono tabular-nums tracking-[-0.02em]">{fmtCAD(ytdNet)}</p>
              <p className="text-xs text-muted-foreground mt-1">To employees</p>
            </div>
          </div>

          {/* Action-required alert — only if payroll data exists */}
          {ytdGross > 0 && (
          <div className="flex gap-3.5 bg-[#FFF7ED] border border-[#FED7AA] rounded-xl px-5 py-4">
            <AlertTriangle className="h-5 w-5 text-[#C2410C] mt-0.5 flex-shrink-0" />
            <div className="space-y-2 w-full">
              <p className="text-[13px] font-bold text-[#9A3412]">1 action required</p>
              <div className="grid grid-cols-3 gap-4 text-[13px] text-[#C2410C]">
                <span>T4 filing deadline · Feb 28, 2027</span>
                <span>PD7A remittance · Up to date</span>
                <span>Year-end wizard · <Link href="/reports/t4" className="font-semibold underline">Prepare T4s →</Link></span>
              </div>
            </div>
          </div>
          )}

          <div className="grid grid-cols-3 gap-5">
            <div>
              <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em] mb-3">Quick actions</p>
              <div className="space-y-3">
                {[
                  { icon: PlusCircle, title: "Add employee", desc: "TD1 + pay group setup.", href: "/employees/new" },
                  { icon: ClipboardList, title: "Run payroll", desc: "Enter amounts → preview → finalize.", href: "/payroll/new" },
                  { icon: BarChart3, title: "GL Journal", desc: "Debit/credit entries for accounting software.", href: "/reports/gl" },
                  { icon: BarChart3, title: "View reports", desc: "T4, PD7A, ROE, journals.", href: "/reports" },
                ].map((qa) => (
                  <Link key={qa.title} href={qa.href} className="flex gap-3.5 items-start p-[18px] border border-[#E7E5E4] rounded-xl bg-white hover:border-[#B3261E] shadow-[0_1px_3px_rgba(0,0,0,0.04)] no-underline text-inherit transition-colors">
                    <div className="w-11 h-11 rounded-[11px] bg-[#FEF2F2] flex items-center justify-center text-xl flex-shrink-0"><qa.icon className="h-5 w-5 text-[#B3261E]" /></div>
                    <div className="flex-1"><p className="text-[15px] font-bold">{qa.title}</p><p className="text-[13px] text-muted-foreground mt-0.5">{qa.desc}</p></div>
                    <span className="text-[#A8A29E] text-lg mt-1">→</span>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em] mb-3">Compliance</p>
              <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                {[["T4 slips","Ready"],["PD7A","Current"],["ROE","0 pending"],["Year-end","Available"]].map(([l,s])=>(
                  <div key={l} className="flex justify-between px-5 py-3 border-b border-[#F0EFED] last:border-b-0 text-[13px]"><span>{l}</span><span className="text-xs font-semibold text-[#15803D]">{s}</span></div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em] mb-3">Recent pay runs</p>
              <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                {recentRuns.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No pay runs yet.</div>
                ) : recentRuns.map((run) => (
                  <Link key={run.id} href={`/payroll/${run.id}`} className="flex justify-between px-5 py-3 border-b border-[#F0EFED] last:border-b-0 hover:bg-[#FAFAF9] no-underline text-inherit">
                    <div><p className="text-[13px] font-semibold">{run.payDate}</p><p className="text-[11px] text-[#A8A29E]">{run.payGroup.name}</p></div>
                    <span className="text-[13px] font-semibold font-mono tabular-nums">{fmtCAD(run.totalNetPay)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, foot }: { label: string; value: string; foot: string }) {
  return (
    <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em]">{label}</p>
      <p className="text-[30px] font-bold mt-2 font-mono tabular-nums tracking-[-0.02em]">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{foot}</p>
    </div>
  );
}
