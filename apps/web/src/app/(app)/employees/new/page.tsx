/**
 * New employee page — server component wrapper.
 */

import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmployeeForm } from "@/components/employee-form";

export default async function NewEmployeePage() {
  const { companyId } = await requireCompany();

  const payGroups = await prisma.payGroup.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
  });

  return <EmployeeForm payGroups={payGroups} />;
}
