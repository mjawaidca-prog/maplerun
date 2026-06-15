/**
 * Audit Log — Accountant plan feature.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can, type Plan } from "@/lib/plan";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import Link from "next/link";

export default async function AuditLogPage() {
  const { companyId } = await requireCompany();
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { plan: true } });
  const plan: Plan = (company?.plan as Plan) ?? "growth";

  if (!can(plan, "auditLog")) {
    return (
      <div className="space-y-6 max-w-lg mx-auto pt-12">
        <div className="text-[13px] text-[#A8A29E]"><Link href="/company" className="text-[#A8A29E] no-underline">Company</Link> › Audit Log</div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Audit Log</h1>
        <UpgradePrompt feature="Audit Log" requiredPlan="accountant" currentPlan={plan} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-[13px] text-[#A8A29E]"><Link href="/company" className="text-[#A8A29E] no-underline">Company</Link> › Audit Log</div>
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">All changes to company records, pay runs, and settings.</p>
      </div>
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="text-[13px] text-muted-foreground">Audit trail will be populated as you use MapleRun. All pay run finalizations, employee changes, and plan modifications are logged here.</p>
      </div>
    </div>
  );
}
