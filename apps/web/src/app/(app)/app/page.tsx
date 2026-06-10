/**
 * Dashboard — quick stats and shortcuts for the current company.
 */

import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Users, ClipboardList, ArrowRight, PlusCircle } from "lucide-react";

export default async function DashboardPage() {
  const user = await requireCompany();

  const [employeeCount, payGroupCount] = await Promise.all([
    prisma.employee.count({ where: { companyId: user.companyId, active: true } }),
    prisma.payGroup.count({ where: { companyId: user.companyId } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Employees
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{employeeCount}</p>
            <Link
              href="/employees"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-2"
            >
              Manage employees <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pay Groups
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{payGroupCount}</p>
            <Link
              href="/payroll"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-2"
            >
              Run payroll <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-3">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/employees/new"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/60 hover:border-primary/30 hover:bg-accent/50 transition-colors"
          >
            <PlusCircle className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Add an employee</p>
              <p className="text-xs text-muted-foreground">Set up TD1 and payroll details</p>
            </div>
          </Link>

          <Link
            href="/payroll/new"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/60 hover:border-primary/30 hover:bg-accent/50 transition-colors"
          >
            <ClipboardList className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Run payroll</p>
              <p className="text-xs text-muted-foreground">Calculate and finalize a pay run</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Getting started hint */}
      {employeeCount === 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-6 text-center space-y-3">
            <p className="text-lg font-semibold">👋 Welcome to MapleRun!</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Start by adding your first employee, then run your first payroll.
              It only takes a few minutes.
            </p>
            <Link
              href="/employees/new"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Add your first employee <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
