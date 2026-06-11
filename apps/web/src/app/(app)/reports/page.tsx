/**
 * Reports dashboard — links to all available reports.
 */

import { getPd7aReport } from "@/lib/actions/reports";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { FileText, Receipt, FileSpreadsheet, Users, ArrowRight } from "lucide-react";

export default async function ReportsPage() {
  // Quick PD7A summary for current year
  const year = new Date().getFullYear();
  let pd7aTotal = 0;
  try {
    const report = await getPd7aReport(year, "monthly");
    pd7aTotal = report.totals.totalRemittance;
  } catch { /* No runs yet */ }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1">
          Payroll reports, remittance summaries, and year-end filings.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/reports/t4">
          <Card className="border-border/60 hover:border-primary/30 hover:shadow-sm transition-all h-full">
            <CardHeader>
              <FileSpreadsheet className="h-8 w-8 text-maple mb-1" />
              <CardTitle className="text-lg">T4 Slips</CardTitle>
              <CardDescription>
                Employee T4 summaries for year-end filing. Box 14, 16, 18, 22, 24, 26 — all populated from finalized pay runs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-primary font-medium inline-flex items-center gap-1">
                View T4 report <ArrowRight className="h-3 w-3" />
              </span>
            </CardContent>
          </Card>
        </Link>

        <Card className="border-border/60">
          <CardHeader>
            <Receipt className="h-8 w-8 text-maple mb-1" />
            <CardTitle className="text-lg">PD7A Remittance</CardTitle>
            <CardDescription>
              Monthly/quarterly source deduction summary — CPP, CPP2, EI (employee + employer) with remittance amounts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-maple">
              {pd7aTotal > 0 ? `$${pd7aTotal.toFixed(2)}` : "No data"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {year} remittance to date
            </p>
          </CardContent>
        </Card>

        <Link href="/reports/roe">
          <Card className="border-border/60 hover:border-primary/30 hover:shadow-sm transition-all h-full">
            <CardHeader>
              <Users className="h-8 w-8 text-maple mb-1" />
              <CardTitle className="text-lg">Records of Employment</CardTitle>
              <CardDescription>
                Generate ROEs when an employee leaves. Block 15A/15B/15C data from finalized pay history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-primary font-medium inline-flex items-center gap-1">
                View ROEs <ArrowRight className="h-3 w-3" />
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/payroll">
          <Card className="border-border/60 hover:border-primary/30 hover:shadow-sm transition-all h-full">
            <CardHeader>
              <FileText className="h-8 w-8 text-maple mb-1" />
              <CardTitle className="text-lg">Payroll Journal</CardTitle>
              <CardDescription>
                Complete history of all pay runs with per-employee breakdowns. Filter by date, view details, download PDF stubs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-primary font-medium inline-flex items-center gap-1">
                View history <ArrowRight className="h-3 w-3" />
              </span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
