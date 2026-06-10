/**
 * Pay run list — view past pay runs and start a new one.
 */

import { getPayRuns } from "@/lib/actions/payroll";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle, ChevronRight } from "lucide-react";

function fmtCAD(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default async function PayrollPage() {
  const payRuns = await getPayRuns();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground mt-1">
            {payRuns.length} pay run{payRuns.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/payroll/new">
          <Button size="sm" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            New pay run
          </Button>
        </Link>
      </div>

      {payRuns.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-lg font-semibold">No pay runs yet</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Run your first payroll. The system will calculate CRA-compliant
              deductions for all active employees.
            </p>
            <Link href="/payroll/new">
              <Button className="gap-2">
                <PlusCircle className="h-4 w-4" />
                Run your first payroll
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {payRuns.map((pr) => (
            <Link
              key={pr.id}
              href={`/payroll/${pr.id}`}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-border/60 hover:border-primary/20 hover:bg-accent/30 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {pr.payGroup.name} &mdash; {pr.payDate}
                  </p>
                  <Badge
                    variant={pr.status === "FINALIZED" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {pr.status.toLowerCase()}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pr.itemCount} employee{pr.itemCount !== 1 ? "s" : ""} &middot;{" "}
                  Gross {fmtCAD(pr.totalGross)} &middot;{" "}
                  Net {fmtCAD(pr.totalNetPay)} &middot;{" "}
                  Employer cost {fmtCAD(pr.totalEmployerCost)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
