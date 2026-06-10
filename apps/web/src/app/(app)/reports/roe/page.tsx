/**
 * ROE (Record of Employment) generator — CRA-compliant data export.
 */

import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROE_REASON_CODES } from "@/lib/roe-constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";

function fmtCAD(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default async function RoePage() {
  const { companyId } = await requireCompany();

  const employees = await prisma.employee.findMany({
    where: { companyId },
    orderBy: { lastName: "asc" },
    include: {
      _count: { select: { payRunItems: true } },
    },
  });

  const employeesWithHistory = employees.filter((e) => e._count.payRunItems > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/reports"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Record of Employment
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate CRA ROE Web data for employees with finalized pay history.
          </p>
        </div>
      </div>

      {employeesWithHistory.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-lg font-semibold">No eligible employees</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              ROE data can only be generated for employees with finalized pay runs.
              Run payroll first, then return here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {employeesWithHistory.map((emp) => (
            <Link
              key={emp.id}
              href={`/reports/roe/${emp.id}`}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-border/60 hover:border-primary/20 hover:bg-accent/30 transition-colors"
            >
              <div>
                <p className="text-sm font-medium">
                  {emp.firstName} {emp.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {emp._count.payRunItems} pay period{emp._count.payRunItems !== 1 ? "s" : ""}{" "}
                  &middot;{" "}
                  {emp.active ? (
                    <Badge variant="default" className="text-xs">Active</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Inactive</Badge>
                  )}
                </p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ROE reason code selector (shared)
export { ROE_REASON_CODES };
