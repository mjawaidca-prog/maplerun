/**
 * Pay run detail — shows summary and all employee line items.
 */

import { getPayRun } from "@/lib/actions/payroll";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

function fmtCAD(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default async function PayRunDetailPage({ params }: Props) {
  const { id } = await params;

  let payRun;
  try {
    payRun = await getPayRun(id);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/payroll"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Pay Run &mdash; {payRun.payDate}
            </h1>
            <Badge
              variant={payRun.status === "FINALIZED" ? "default" : "secondary"}
            >
              {payRun.status.toLowerCase()}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {payRun.payGroup.name} &middot; {payRun.itemCount} employees
            {payRun.finalizedAt
              ? ` &middot; Finalized ${new Date(payRun.finalizedAt).toLocaleDateString("en-CA")}`
              : ""}
          </p>
        </div>
      </div>

      {/* Totals card */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <Stat label="Gross pay" value={fmtCAD(payRun.totalGross)} />
            <Stat label="CPP" value={fmtCAD(payRun.totalCpp)} />
            <Stat label="CPP2" value={fmtCAD(payRun.totalCpp2)} />
            <Stat label="EI" value={fmtCAD(payRun.totalEi)} />
            <Stat label="Federal tax" value={fmtCAD(payRun.totalFederalTax)} />
            <Stat label="Provincial tax" value={fmtCAD(payRun.totalProvincialTax)} />
            <Separator className="col-span-full" />
            <Stat label="Total deductions" value={fmtCAD(payRun.totalDeductions)} bold />
            <Stat label="Net pay" value={fmtCAD(payRun.totalNetPay)} bold />
            <Stat label="Employer cost" value={fmtCAD(payRun.totalEmployerCost)} bold />
          </div>
        </CardContent>
      </Card>

      {/* Employee line items */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Employee details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {payRun.items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-3 sm:grid-cols-5 gap-2 py-2 px-3 rounded-md hover:bg-accent/30 transition-colors text-sm"
              >
                <div className="col-span-2 sm:col-span-1 font-medium truncate">
                  {item.employee.firstName} {item.employee.lastName}
                </div>
                <div className="tabular-nums text-right">{fmtCAD(item.gross)}</div>
                <div className="tabular-nums text-right text-muted-foreground">
                  {fmtCAD(item.totalDeductions)}
                </div>
                <div className="tabular-nums text-right font-semibold">
                  {fmtCAD(item.netPay)}
                </div>
                <div className="hidden sm:block tabular-nums text-right text-muted-foreground">
                  {fmtCAD(item.employerTotal)}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 py-2 px-3 text-xs text-muted-foreground mt-2">
            <div className="col-span-2 sm:col-span-1">Employee</div>
            <div className="text-right">Gross</div>
            <div className="text-right">Deductions</div>
            <div className="text-right">Net</div>
            <div className="hidden sm:block text-right">Employer</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`tabular-nums ${bold ? "font-bold text-lg" : "font-semibold"}`}>
        {value}
      </p>
    </div>
  );
}
