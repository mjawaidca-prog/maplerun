/**
 * T4 Report — annual summary of all employee T4 slips.
 */

import { getT4Report } from "@/lib/actions/t4";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Download } from "lucide-react";

function fmtCAD(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default async function T4ReportPage() {
  const year = 2026;
  let report: Awaited<ReturnType<typeof getT4Report>> | null = null;
  let error: string | null = null;

  try {
    report = await getT4Report(year);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to generate T4 report.";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/reports" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">T4 Slips — {year}</h1>
          <p className="text-muted-foreground mt-1">
            Employee T4 summaries. Use these to complete CRA T4 filings and distribute to employees.
          </p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {report && report.slips.length === 0 && (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-lg font-semibold">No T4 data for {year}</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              T4 slips are generated from finalized pay runs. Run payroll to see T4 data here.
            </p>
          </CardContent>
        </Card>
      )}

      {report && report.slips.length > 0 && (
        <>
          {/* Employee list */}
          <div className="space-y-2">
            {report.slips.map((slip) => (
              <Link key={slip.employeeId} href={`/reports/t4/${slip.employeeId}`}>
                <Card className="border-border/60 hover:border-primary/30 hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">{slip.employeeName}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Income: {fmtCAD(slip.box14)}</span>
                        <span>CPP: {fmtCAD(slip.box16)}</span>
                        <span>EI: {fmtCAD(slip.box18)}</span>
                        <span>Tax: {fmtCAD(slip.box22)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">
                        {slip.payPeriods} periods
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Totals */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">{report.companyName} — T4 Summary {year}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <Stat label="Employees" value={String(report.totals.employees)} />
                <Stat label="Employment income (Box 14)" value={fmtCAD(report.totals.box14)} />
                <Stat label="CPP (Box 16)" value={fmtCAD(report.totals.box16)} />
                <Stat label="CPP2 (Box 16A)" value={fmtCAD(report.totals.box16A)} />
                <Stat label="EI premiums (Box 18)" value={fmtCAD(report.totals.box18)} />
                <Stat label="Tax deducted (Box 22)" value={fmtCAD(report.totals.box22)} />
                <Stat label="EI insurable (Box 24)" value={fmtCAD(report.totals.box24)} />
                <Stat label="Pensionable (Box 26)" value={fmtCAD(report.totals.box26)} />
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            Use these figures to complete CRA T4 Summary (RC-5688) and distribute T4 slips.
            Verify against your CRA payroll account before filing.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
