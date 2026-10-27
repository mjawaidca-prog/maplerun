/**
 * Pay run wizard — multi-step client component.
 *
 * Step 1: Select pay group, pay date, enter gross amounts per employee
 * Step 2: Preview calculated deductions (server action)
 * Step 3: Finalize (server action) — creates immutable records
 */

import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { type Plan } from "@/lib/plan";
import { previewPayRun, finalizePayRun, type PayRunPreview } from "@/lib/actions/payroll";
import { PayRunWizard } from "./wizard";
import { trialGate, trialBlockMessage } from "@/lib/trial";
import Link from "next/link";

export default async function NewPayRunPage() {
  const { companyId } = await requireCompany();

  const [payGroups, employees, company] = await Promise.all([
    prisma.payGroup.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { companyId, active: true }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true, payType: true, payRate: true } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { plan: true, freePayRunsUsed: true, maxFreePayRuns: true, trialEndsAt: true } }),
  ]);

  if (payGroups.length === 0) {
    return (
      <div className="space-y-6 max-w-lg mx-auto pt-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#FEF2F2] flex items-center justify-center text-[30px] mx-auto">⚙️</div>
        <h1 className="text-2xl font-bold tracking-tight">No pay groups yet</h1>
        <p className="text-muted-foreground leading-relaxed">
          A pay group defines how often employees are paid and their default tax province. Create one before running payroll.
        </p>
        <Link
          href="/company?tab=paygroups"
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-sm font-semibold px-5 py-2.5 no-underline transition-colors"
        >
          ＋ Create your first pay group
        </Link>
      </div>
    );
  }

  const gate = trialGate({
    trialEndsAt: company?.trialEndsAt ?? null,
    freePayRunsUsed: company?.freePayRunsUsed ?? 0,
    maxFreePayRuns: company?.maxFreePayRuns ?? 2,
  });
  const blockMessage = trialBlockMessage(gate);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New pay run</h1>
        <p className="text-muted-foreground mt-1">
          Calculate CRA-compliant deductions for all active employees.
        </p>
        {gate.state === "active" && (
          <p className="mt-2 text-sm text-muted-foreground">
            Free trial: {gate.used} of {gate.max} pay runs used · trial ends{" "}
            {gate.trialEndsAt.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}.
          </p>
        )}
      </div>

      {blockMessage && (
        <div className="rounded-[10px] border border-amber-300 bg-amber-50 px-5 py-4">
          <p className="font-semibold text-amber-900">
            {gate.state === "ended" ? "Your free trial has ended" : "Free trial pay runs used up"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-800">{blockMessage} You can still preview calculations below — finalizing is paused until you upgrade.</p>
          <Link
            href="/company?tab=billing"
            className="mt-3 inline-flex items-center gap-2 rounded-[10px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-sm font-semibold px-4 py-2 no-underline transition-colors"
          >
            Upgrade your plan
          </Link>
        </div>
      )}

      <PayRunWizard
        plan={(company?.plan as Plan) ?? "growth"}
        payGroups={payGroups.map((pg) => ({ id: pg.id, name: pg.name, frequency: pg.frequency, defaultProvince: pg.defaultProvince }))}
        employees={employees.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, payRate: e.payRate }))}
        previewAction={previewPayRun}
        finalizeAction={finalizePayRun}
        finalizeBlockReason={blockMessage}
      />
    </div>
  );
}
