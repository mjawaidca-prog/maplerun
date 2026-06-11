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
import { ArrowLeft, Download, Printer } from "lucide-react";
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
        <div className="flex items-center gap-2">
          <Link
            href={`/payroll/${payRunId}/stub/${itemId}/pdf`}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Download className="h-4 w-4" />
            PDF
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
      </div>

      {/* Pay stub */}
      <div className="rounded-xl border border-border/60 bg-card p-8 print:p-4 print:border-0 print:shadow-none space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-maple/20 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl" role="img" aria-label="Maple leaf">🍁</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{company?.name ?? "MapleRun"}</h1>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">Pay Stub</p>
              </div>
            </div>
          </div>
          <div className="text-right text-sm space-y-0.5">
            <p className="font-semibold text-base">
              {item.employee.firstName} {item.employee.lastName}
            </p>
            <p className="text-muted-foreground">
              Pay period ending <span className="font-medium text-foreground">{payRun.payDate}</span>
            </p>
            <p className="text-muted-foreground text-xs">
              {payRun.payGroup.name} &middot; {payRun.payGroup.frequency.toLowerCase()}
            </p>
          </div>
        </div>

        {/* Earnings & Deductions side by side */}
        <div className="grid grid-cols-2 gap-10">
          {/* Earnings */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b pb-2">
              Earnings
            </h3>
            <div className="flex justify-between items-center py-3 px-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900/50">
              <span className="font-semibold">Gross pay</span>
              <span className="text-xl font-bold tabular-nums">{fmtCAD(item.gross)}</span>
            </div>
            <div className="flex justify-between px-4 text-sm">
              <span className="text-muted-foreground">Pay rate</span>
              <span className="tabular-nums">{payRun.payGroup.frequency.toLowerCase()}</span>
            </div>
          </div>

          {/* Deductions */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b pb-2">
              Deductions
            </h3>
            <div className="space-y-1.5 px-1">
              <Row label="CPP / QPP" value={fmtCAD(item.cpp)} />
              {item.cpp2 > 0 && <Row label="CPP2 enhancement" value={fmtCAD(item.cpp2)} />}
              <Row label="EI premiums" value={fmtCAD(item.ei)} />
              <Row label="Federal tax" value={fmtCAD(item.federalTax)} />
              <Row label="Provincial tax" value={fmtCAD(item.provincialTax)} />
            </div>
            <Separator />
            <div className="flex justify-between items-center px-1">
              <span className="font-semibold text-sm">Total deductions</span>
              <span className="font-bold tabular-nums">{fmtCAD(item.totalDeductions)}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Net pay — the hero element */}
        <div className="flex justify-between items-center py-5 px-6 bg-gradient-to-r from-maple/5 to-maple/10 rounded-xl border border-maple/20">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Net Pay</p>
            <p className="text-xs text-muted-foreground mt-0.5">Take-home amount after all deductions</p>
          </div>
          <span className="text-4xl font-bold tabular-nums text-maple">
            {fmtCAD(item.netPay)}
          </span>
        </div>

        <Separator />

        {/* Employer costs + YTD */}
        <div className="grid grid-cols-2 gap-8">
          {/* Employer side */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Employer Costs
            </h3>
            <div className="space-y-1.5 text-sm">
              <Row label="CPP (employer match)" value={fmtCAD(item.employerCpp)} />
              {item.employerCpp2 > 0 && <Row label="CPP2 (employer)" value={fmtCAD(item.employerCpp2)} />}
              <Row label="EI (1.4× employee)" value={fmtCAD(item.employerEi)} />
              <Separator className="my-1" />
              <Row label="Total employer cost" value={fmtCAD(item.employerTotal)} bold />
            </div>
          </div>

          {/* YTD */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Year-to-Date &middot; 2026
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Mini label="Pensionable" value={fmtCAD(item.ytdPensionable)} />
              <Mini label="Insurable" value={fmtCAD(item.ytdInsurable)} />
              <Mini label="CPP" value={fmtCAD(item.ytdCpp)} />
              <Mini label="EI" value={fmtCAD(item.ytdEi)} />
              {item.ytdCpp2 > 0 && <Mini label="CPP2" value={fmtCAD(item.ytdCpp2)} />}
            </div>
          </div>
        </div>

        {/* Warnings */}
        {item.warnings && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 print:hidden">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wider mb-1">Notices</p>
            <p className="text-xs text-amber-700 dark:text-amber-300">{item.warnings}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-xs text-muted-foreground text-center space-y-1 pt-4 border-t">
          <p>Generated by MapleRun &mdash; Canadian payroll software.</p>
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

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums text-sm">{value}</p>
    </div>
  );
}
