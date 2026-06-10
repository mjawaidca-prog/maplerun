/**
 * PD7A Remittance Report — CRA-compliant summary of source deductions.
 */

import { getPd7aReport, type Pd7aReport } from "@/lib/actions/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function fmtCAD(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default async function ReportsPage() {
  const year = new Date().getFullYear();
  let report: Pd7aReport | null = null;
  let error: string | null = null;

  try {
    report = await getPd7aReport(year, "monthly");
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to generate report.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">PD7A Remittance Report</h1>
        <p className="text-muted-foreground mt-1">
          Summary of source deductions for {year}. Use this to complete your CRA PD7A
          remittance voucher.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {report && report.periods.length === 0 && (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-lg font-semibold">No finalized pay runs in {year}</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The PD7A report aggregates finalized pay runs. Run your first payroll
              to see remittance data here.
            </p>
          </CardContent>
        </Card>
      )}

      {report && report.periods.length > 0 && (
        <>
          {/* Period-by-period breakdown */}
          <div className="space-y-3">
            {report.periods.map((p) => (
              <Card key={p.period} className="border-border/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{p.period}</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {p.payRuns} run{p.payRuns !== 1 ? "s" : ""} &middot; {p.employees} employee{p.employees !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <Stat label="CPP (employee)" value={fmtCAD(p.employeeCpp)} />
                    <Stat label="CPP (employer)" value={fmtCAD(p.employerCpp)} />
                    <Stat label="CPP2 (employee)" value={fmtCAD(p.employeeCpp2)} />
                    <Stat label="CPP2 (employer)" value={fmtCAD(p.employerCpp2)} />
                    <Stat label="EI (employee)" value={fmtCAD(p.employeeEi)} />
                    <Stat label="EI (employer)" value={fmtCAD(p.employerEi)} />
                  </div>
                  <Separator className="my-3" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">PD7A Remittance Due</span>
                    <span className="text-lg font-bold tabular-nums text-maple">
                      {fmtCAD(p.totalRemittance)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Annual totals */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">{year} Totals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <Stat label="CPP (employee)" value={fmtCAD(report.totals.employeeCpp)} />
                <Stat label="CPP (employer)" value={fmtCAD(report.totals.employerCpp)} />
                <Stat label="CPP2 (employee)" value={fmtCAD(report.totals.employeeCpp2)} />
                <Stat label="CPP2 (employer)" value={fmtCAD(report.totals.employerCpp2)} />
                <Stat label="EI (employee)" value={fmtCAD(report.totals.employeeEi)} />
                <Stat label="EI (employer)" value={fmtCAD(report.totals.employerEi)} />
              </div>
              <Separator className="my-4" />
              <div className="flex justify-between items-center">
                <span className="text-base font-bold">Total Annual Remittance</span>
                <span className="text-2xl font-bold tabular-nums text-maple">
                  {fmtCAD(report.totals.totalRemittance)}
                </span>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            Compare with your CRA PD7A remittance form. These figures are from
            finalized MapleRun pay runs and should match your CRA remittance
            obligations for {year}.
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
