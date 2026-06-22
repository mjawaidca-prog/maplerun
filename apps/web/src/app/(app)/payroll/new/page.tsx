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

export default async function NewPayRunPage() {
  const { companyId } = await requireCompany();

  const [payGroups, employees, company] = await Promise.all([
    prisma.payGroup.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { companyId, active: true }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true, payType: true, payRate: true } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { plan: true } }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New pay run</h1>
        <p className="text-muted-foreground mt-1">
          Calculate CRA-compliant deductions for all active employees.
        </p>
      </div>

      <PayRunWizard
        plan={(company?.plan as Plan) ?? "growth"}
        payGroups={payGroups.map((pg) => ({ id: pg.id, name: pg.name, frequency: pg.frequency, defaultProvince: pg.defaultProvince }))}
        employees={employees.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, payRate: e.payRate }))}
        previewAction={previewPayRun}
        finalizeAction={finalizePayRun}
      />
    </div>
  );
}
