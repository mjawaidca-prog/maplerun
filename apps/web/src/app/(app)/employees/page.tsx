/**
 * Employee list — view all active/inactive employees for the current company.
 */

import { getEmployees } from "@/lib/actions/employee";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle, Pencil } from "lucide-react";

export default async function EmployeesPage() {
  const employees = await getEmployees();

  const active = employees.filter((e) => e.active);
  const inactive = employees.filter((e) => !e.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground mt-1">
            {employees.length} total &middot; {active.length} active
          </p>
        </div>
        <Link href="/employees/new">
          <Button size="sm" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Add employee
          </Button>
        </Link>
      </div>

      {employees.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-lg font-semibold">No employees yet</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Add your first employee to start running payroll. You&apos;ll need
              their name, SIN, and TD1 information.
            </p>
            <Link href="/employees/new">
              <Button className="gap-2">
                <PlusCircle className="h-4 w-4" />
                Add your first employee
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {[...active, ...inactive].map((emp) => (
            <Link
              key={emp.id}
              href={`/app/employees/${emp.id}`}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-border/60 hover:border-primary/20 hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {emp.firstName[0]}
                  {emp.lastName[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {emp.firstName} {emp.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {emp.email ?? "No email"} &middot;{" "}
                    {emp.td1Profiles[0]?.federalClaim
                      ? `TD1 claim: $${emp.td1Profiles[0].federalClaim.toFixed(2)}`
                      : "TD1: default"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!emp.active && (
                  <Badge variant="secondary" className="text-xs">
                    Inactive
                  </Badge>
                )}
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
