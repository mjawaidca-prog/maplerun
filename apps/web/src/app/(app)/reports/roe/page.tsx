/**
 * ROE list — Records of Employment, Accountant plan gated.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can, type Plan } from "@/lib/plan";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import Link from "next/link";

export default async function RoeListPage() {
  const { companyId } = await requireCompany();
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { plan: true } });
  const plan: Plan = (company?.plan as Plan) ?? "growth";

  if (!can(plan, "roe")) {
    return (
      <div className="space-y-6 max-w-lg mx-auto pt-12">
        <div className="text-[13px] text-[#A8A29E]"><Link href="/reports" className="text-[#A8A29E] no-underline">Reports</Link> › ROE</div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Record of Employment</h1>
        <UpgradePrompt feature="ROE generation" requiredPlan="accountant" currentPlan={plan} />
      </div>
    );
  }

  const employees = await prisma.employee.findMany({
    where: { companyId },
    orderBy: { lastName: "asc" },
    include: {
      _count: { select: { payRunItems: true } },
      payRunItems: {
        include: { payRun: { select: { payDate: true } } },
        orderBy: { payRun: { payDate: "desc" } },
        take: 1,
      },
    },
  });

  const withHistory = employees.filter((e) => e._count.payRunItems > 0).map((emp) => {
    const lastItem = emp.payRunItems[0];
    // Fast approximate: insurable earnings = gross when EI > 0
    const insurableEarnings = lastItem ? (lastItem.ei > 0 ? lastItem.gross : 0) : 0;
    return {
      ...emp,
      lastPayDate: lastItem?.payRun.payDate ?? null,
      insurableEarnings,
    };
  });

  return (
    <div className="space-y-6">
      <div className="text-[13px] text-[#A8A29E]">
        <Link href="/reports" className="text-[#A8A29E] no-underline">Reports</Link> › Records of Employment
      </div>
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Records of Employment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ROEs for terminations and leaves, formatted for Service Canada.{withHistory.length} employee{withHistory.length!==1?"s":""} with payroll history.
          </p>
        </div>
      </div>

      {withHistory.length === 0 ? (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-12 text-center space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-base font-bold">No ROE data available</p>
          <p className="text-[13px] text-muted-foreground">Employees need finalized pay runs before an ROE can be generated.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="grid grid-cols-[2fr_1.3fr_1.1fr_1fr_0.9fr_32px] gap-3 px-5 py-3 bg-[#FAFAF9] border-b border-[#E7E5E4]">
            {["Employee","Last pay date","Insurable earnings","Pay periods","Status",""].map(h=>(
              <div key={h} className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em]">{h}</div>
            ))}
          </div>
          {withHistory.map((emp) => (
            <Link key={emp.id} href={`/reports/roe/${emp.id}`} className="grid grid-cols-[2fr_1.3fr_1.1fr_1fr_0.9fr_32px] gap-3 px-5 py-3.5 border-b border-[#F0EFED] last:border-b-0 items-center hover:bg-[#FAFAF9] no-underline text-inherit">
              <div className="flex items-center gap-3">
                <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-[#B3261E] to-[#E56A5C] flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0">
                  {emp.firstName[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold">{emp.firstName} {emp.lastName}</p>
                  <p className="text-xs text-[#A8A29E]">SIN •••-•••-•••</p>
                </div>
              </div>
              <div className="text-[13px] text-[#57534E]">{emp.lastPayDate ?? "—"}</div>
              <div className="text-[13px] text-[#57534E] font-mono tabular-nums">{emp.insurableEarnings > 0 ? `$${emp.insurableEarnings.toFixed(2)}` : "—"}</div>
              <div className="text-[13px] text-[#57534E]">{emp._count.payRunItems}</div>
              <div><span className="inline-flex items-center text-[11px] font-bold tracking-[0.03em] rounded-full px-2.5 py-1 bg-[#DCFCE7] text-[#15803D]">ACTIVE</span></div>
              <div className="text-[#A8A29E] text-right">→</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
