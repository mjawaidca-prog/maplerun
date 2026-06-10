/**
 * ROE data for a specific employee — view and export.
 */

import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROE_REASON_CODES } from "@/lib/roe-constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

export default async function RoeEmployeePage({ params }: Props) {
  const { id } = await params;
  const { companyId } = await requireCompany();

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      ytdLedgers: { where: { year: 2026 }, take: 1 },
      payRunItems: {
        include: { payRun: { select: { payDate: true } } },
        orderBy: { payRun: { payDate: "asc" } },
      },
    },
  });

  if (!employee || employee.companyId !== companyId) notFound();

  const finalizedItems = employee.payRunItems.filter(
    (i) => i.payRun && i.ei > 0
  );
  const totalInsurableEarnings = finalizedItems.reduce((s, i) => s + i.gross, 0);
  const lastPayDate =
    finalizedItems.length > 0
      ? finalizedItems[finalizedItems.length - 1]!.payRun.payDate
      : "N/A";

  const ytd = employee.ytdLedgers[0];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link
          href="/reports/roe"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            ROE: {employee.firstName} {employee.lastName}
          </h1>
          <p className="text-muted-foreground mt-1">
            Record of Employment data for CRA submission.
          </p>
        </div>
      </div>

      {/* Employee info */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Employee information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Name" value={`${employee.firstName} ${employee.lastName}`} />
          <Info label="SIN" value="•••••••••" />
          <Info label="Status" value={employee.active ? "Active" : "Inactive"} />
          <Info label="Last pay date" value={lastPayDate} />
        </CardContent>
      </Card>

      {/* ROE blocks */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">ROE Data (Block 15)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">15A — Total insurable hours</p>
              <p className="text-2xl font-bold tabular-nums">
                {/* Hours must be entered manually for now */}
                <span className="text-muted-foreground text-base">Enter manually</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">15B — Total insurable earnings</p>
              <p className="text-2xl font-bold tabular-nums">{fmtCAD(totalInsurableEarnings)}</p>
            </div>
          </div>

          <Separator />

          {/* Pay period breakdown (15C) */}
          <div>
            <p className="text-sm font-semibold mb-2">
              15C — Insurable earnings by pay period ({finalizedItems.length} periods)
            </p>
            <div className="space-y-1 max-h-64 overflow-auto">
              {finalizedItems.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm py-1 px-2 rounded even:bg-accent/20"
                >
                  <span>{item.payRun.payDate}</span>
                  <span className="tabular-nums">{fmtCAD(item.gross)}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* YTD */}
          <div>
            <p className="text-sm font-semibold mb-2">YTD at last pay period</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Info label="Pensionable earnings" value={fmtCAD(ytd?.pensionableEarnings ?? 0)} />
              <Info label="CPP contributed" value={fmtCAD(ytd?.cpp ?? 0)} />
              <Info label="Insurable earnings" value={fmtCAD(ytd?.insurableEarnings ?? 0)} />
              <Info label="EI contributed" value={fmtCAD(ytd?.ei ?? 0)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reason code */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Reason for issuance (Block 16)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {Object.entries(ROE_REASON_CODES).map(([code, label]) => (
              <div key={code} className="flex items-start gap-2 py-1">
                <span className="font-bold text-primary w-6">{code}</span>
                <span className="text-muted-foreground text-xs">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Use this data to complete ROE Web on{" "}
        <a
          href="https://www.canada.ca/en/employment-social-development/programs/ei/ei-list/ei-roe/access-roe-web.html"
          className="underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          CRA ROE Web
        </a>
        . Insurable hours must be entered manually — MapleRun does not yet track hours.
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
