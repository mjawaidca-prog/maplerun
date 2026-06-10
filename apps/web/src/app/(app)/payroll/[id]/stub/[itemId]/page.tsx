/**
 * Employee pay stub — detailed view of one employee's pay for a single pay run.
 * Designed for printing (company branding, deduction breakdown, YTD totals).
 */

import { getPayRun } from "@/lib/actions/payroll";
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string; itemId: string }>;
};

function fmtCAD(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default async function PayStubPage({ params }: Props) {
  const { id: payRunId, itemId } = await params;
  const { companyId } = await requireCompany();

  const payRun = await getPayRun(payRunId).catch(() => null);
  if (!payRun || payRun.companyId !== companyId) notFound();

  const item = payRun.items.find((i) => i.id === itemId);
  if (!item) notFound();

  // Load company info for the stub header
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  return (
    <div className="space-y-6 max-w-2xl print:max-w-full">
      {/* Actions */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/payroll/${payRunId}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to pay run
        </Link>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>

      {/* Pay stub */}
      <div className="rounded-xl border border-border/60 bg-card p-8 print:p-4 print:border-0 print:shadow-none space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl" role="img" aria-label="Maple leaf">
                🍁
              </span>
              <h1 className="text-xl font-bold tracking-tight">{company?.name ?? "MapleRun"}</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Pay Stub</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">
              {item.employee.firstName} {item.employee.lastName}
            </p>
            <p className="text-muted-foreground">Pay date: {payRun.payDate}</p>
            <p className="text-muted-foreground">
              {payRun.payGroup.name} &middot; {payRun.payGroup.frequency.toLowerCase()}
            </p>
          </div>
        </div>

        <Separator />

        {/* Earnings & Deductions */}
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Earnings
            </h3>
            <Row label="Gross pay" value={fmtCAD(item.gross)} bold />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Deductions
            </h3>
            <Row label="CPP / QPP" value={fmtCAD(item.cpp)} />
            <Row label="CPP2 enhancement" value={fmtCAD(item.cpp2)} />
            <Row label="EI premiums" value={fmtCAD(item.ei)} />
            <Row label="Federal income tax" value={fmtCAD(item.federalTax)} />
            <Row label="Provincial income tax" value={fmtCAD(item.provincialTax)} />
            <Separator className="my-1" />
            <Row label="Total deductions" value={fmtCAD(item.totalDeductions)} bold />
          </div>
        </div>

        <Separator />

        {/* Net pay */}
        <div className="flex justify-between items-center py-4 px-6 bg-primary/5 rounded-xl">
          <span className="text-lg font-bold">Net Pay</span>
          <span className="text-3xl font-bold tabular-nums text-maple">
            {fmtCAD(item.netPay)}
          </span>
        </div>

        <Separator />

        {/* YTD summary */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Year-to-Date (2026)
          </h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Ytd label="Pensionable earnings" value={fmtCAD(item.ytdPensionable)} />
            <Ytd label="CPP contributed" value={fmtCAD(item.ytdCpp)} />
            <Ytd label="CPP2 contributed" value={fmtCAD(item.ytdCpp2)} />
            <Ytd label="Insurable earnings" value={fmtCAD(item.ytdInsurable)} />
            <Ytd label="EI contributed" value={fmtCAD(item.ytdEi)} />
          </div>
        </div>

        {/* Warnings */}
        {item.warnings && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 print:hidden">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wider mb-1">
              Notices
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">{item.warnings}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-xs text-muted-foreground text-center space-y-1 pt-4 border-t print:hidden">
          <p>
            Generated by MapleRun &mdash; Canadian payroll software.
          </p>
          <p>This is not an official CRA document. Retain for your records.</p>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold" : ""}`}>{value}</span>
    </div>
  );
}

function Ytd({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums text-sm">{value}</p>
    </div>
  );
}
