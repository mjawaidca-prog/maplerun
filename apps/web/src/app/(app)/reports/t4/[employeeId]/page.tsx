/**
 * Individual T4 slip — printable CRA-style layout.
 */

import { getT4Report } from "@/lib/actions/t4";
import { requireCompany } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { notFound } from "next/navigation";

function fmtCAD(n: number): string {
  return `$${n.toFixed(2)}`;
}

type Props = { params: Promise<{ employeeId: string }> };

export default async function T4SlipPage({ params }: Props) {
  const { employeeId } = await params;
  const { companyId } = await requireCompany();

  const report = await getT4Report(2026);
  const slip = report.slips.find((s) => s.employeeId === employeeId);
  if (!slip) notFound();

  return (
    <div className="space-y-6 max-w-2xl print:max-w-full">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/reports/t4" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to T4 list
        </Link>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      <Card className="border-border/60 print:border-0 print:shadow-none">
        <CardContent className="p-8 print:p-4 space-y-6">
          {/* Header */}
          <div className="text-center border-b-2 border-black pb-4 print:border-black">
            <h1 className="text-xl font-bold">Statement of Remuneration Paid</h1>
            <h2 className="text-lg font-bold mt-1">T4 — {report.year}</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Employer: {report.companyName}
            </p>
          </div>

          {/* Employee info row */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Employee: </span>
              <span className="font-semibold">{slip.employeeName}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">Province: </span>
              <span className="font-semibold">{slip.province}</span>
            </div>
          </div>

          {/* Boxes grid */}
          <div className="grid grid-cols-2 gap-4">
            <T4Box number="14" label="Employment income" value={fmtCAD(slip.box14)} highlight />
            <T4Box number="22" label="Income tax deducted" value={fmtCAD(slip.box22)} highlight />
            <T4Box number="16" label="Employee CPP contributions" value={fmtCAD(slip.box16)} />
            <T4Box number="16A" label="Employee CPP2 contributions" value={fmtCAD(slip.box16A)} />
            <T4Box number="18" label="Employee EI premiums" value={fmtCAD(slip.box18)} />
            <T4Box number="24" label="EI insurable earnings" value={fmtCAD(slip.box24)} />
            <T4Box number="26" label="CPP/QPP pensionable earnings" value={fmtCAD(slip.box26)} />
            <T4Box number="28" label="Exempt (CPP/EI)" value="—" />
          </div>

          {/* Footer */}
          <div className="border-t pt-4 text-xs text-muted-foreground space-y-1">
            <p>
              This T4 slip was generated from {slip.payPeriods} pay period{slip.payPeriods !== 1 ? "s" : ""} in {report.year}.
            </p>
            <p>
              File with CRA by the last day of February {report.year + 1}. Distribute copies to employees by the same date.
            </p>
            <p>
              Verify all amounts against your official CRA payroll account. MapleRun is a calculation tool — you are responsible for accurate CRA filing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function T4Box({ number, label, value, highlight }: { number: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${highlight ? "border-primary/30 bg-primary/5" : "border-border/40"}`}>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="inline-flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary text-xs font-bold">
          {number}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-lg font-bold tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
