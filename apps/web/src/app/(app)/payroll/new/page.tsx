/**
 * Pay run wizard — multi-step client component.
 *
 * Step 1: Select pay group, pay date, enter gross amounts per employee
 * Step 2: Preview calculated deductions (server action)
 * Step 3: Finalize (server action) — creates immutable records
 */

import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { previewPayRun, finalizePayRun, type PayRunPreview } from "@/lib/actions/payroll";
import { PayRunWizard } from "./wizard";

export default async function NewPayRunPage() {
  const { companyId } = await requireCompany();

  // Load data needed for step 1
  const [payGroups, employees] = await Promise.all([
    prisma.payGroup.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { companyId, active: true },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
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
        payGroups={payGroups.map((pg) => ({
          id: pg.id,
          name: pg.name,
          frequency: pg.frequency,
          defaultProvince: pg.defaultProvince,
        }))}
        employees={employees.map((e) => ({
          id: e.id,
          name: `${e.firstName} ${e.lastName}`,
        }))}
        previewAction={previewPayRun}
        finalizeAction={finalizePayRun}
      />
    </div>
  );
}
