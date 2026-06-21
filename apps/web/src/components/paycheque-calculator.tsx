"use client";

import { useState } from "react";
import { calculatePay, type ProvinceCode, type PayFrequency, type PayResult, PERIODS_PER_YEAR, ZERO_YTD } from "@maplerun/tax-engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const PROVINCES: { code: ProvinceCode; label: string }[] = [
  { code: "AB", label: "Alberta" },
  { code: "BC", label: "British Columbia" },
  { code: "MB", label: "Manitoba" },
  { code: "NB", label: "New Brunswick" },
  { code: "NL", label: "Newfoundland & Labrador" },
  { code: "NS", label: "Nova Scotia" },
  { code: "NT", label: "Northwest Territories" },
  { code: "NU", label: "Nunavut" },
  { code: "ON", label: "Ontario" },
  { code: "PE", label: "Prince Edward Island" },
  { code: "QC", label: "Quebec" },
  { code: "SK", label: "Saskatchewan" },
  { code: "YT", label: "Yukon" },
];

const FREQUENCIES: { value: PayFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly (52)" },
  { value: "biweekly", label: "Biweekly (26)" },
  { value: "semimonthly", label: "Semi-monthly (24)" },
  { value: "monthly", label: "Monthly (12)" },
];

function fmtCAD(cents: number): string {
  return `CA$${cents.toFixed(2)}`;
}

export default function PaychequeCalculator() {
  const [province, setProvince] = useState<ProvinceCode | "">("");
  const [frequency, setFrequency] = useState<PayFrequency | "">("");
  const [grossIncome, setGrossIncome] = useState<string>("");
  const [periodDeductions, setPeriodDeductions] = useState<string>("");
  const [federalClaim, setFederalClaim] = useState<string>("");
  const [provincialClaim, setProvincialClaim] = useState<string>("");
  const [result, setResult] = useState<PayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);

  function handleCalculate() {
    setError(null);
    setResult(null);

    // Validate fields
    const missing: string[] = [];
    if (!province) missing.push("province");
    if (!frequency) missing.push("pay frequency");
    if (!grossIncome) missing.push("gross income");
    if (missing.length > 0) {
      setError(`Please select: ${missing.join(", ")}.`);
      return;
    }

    const income = parseFloat(grossIncome);
    if (isNaN(income) || income <= 0) {
      setError("Gross income must be a positive number.");
      return;
    }

    setCalculating(true);

    try {
      const payResult = calculatePay({
        payDate: "2026-06-10",
        province: province as ProvinceCode,
        frequency: frequency as PayFrequency,
        grossPeriodIncome: income,
        periodDeductions: periodDeductions ? parseFloat(periodDeductions) : undefined,
        federalClaim: federalClaim ? parseFloat(federalClaim) : undefined,
        provincialClaim: provincialClaim ? parseFloat(provincialClaim) : undefined,
        ytd: ZERO_YTD,
      });

      // Check if annual caps would be hit (no YTD provided)
      const P = PERIODS_PER_YEAR[frequency as PayFrequency];
      const annualCPP = payResult.cpp * P;
      const annualEI = payResult.ei * P;
      const cppMax = 4034.10; // 2026 CPP1 max
      const eiMax = 1123.07; // 2026 EI max
      if (annualCPP > cppMax || annualEI > eiMax) {
        payResult.warnings.push(
          `CPP/EI annual caps not applied (no YTD). At this rate, annual CPP ≈ $${annualCPP.toFixed(0)} (max $${cppMax.toFixed(0)}) and EI ≈ $${annualEI.toFixed(0)} (max $${eiMax.toFixed(0)}). Mid-year caps would reduce actual deductions.`
        );
      }

      setResult(payResult);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "An unexpected error occurred.";
      setError(msg);
    } finally {
      setCalculating(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      {/* Input card */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Paycheque Calculator
          </CardTitle>
          <CardDescription>
            Estimate CRA-compliant payroll deductions. Uses 2026 T4127 tax tables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Province + Frequency row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="province">Province</Label>
              <Select value={province} onValueChange={(v) => setProvince(v as ProvinceCode)}>
                <SelectTrigger id="province">
                  <SelectValue placeholder="Select province…" />
                </SelectTrigger>
                <SelectContent>
                  {PROVINCES.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Pay frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as PayFrequency)}>
                <SelectTrigger id="frequency">
                  <SelectValue placeholder="Select frequency…" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Gross income */}
          <div className="space-y-2">
            <Label htmlFor="grossIncome">Gross period income</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                $
              </span>
              <Input
                id="grossIncome"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="pl-7 tabular-nums text-lg"
                value={grossIncome}
                onChange={(e) => setGrossIncome(e.target.value)}
              />
            </div>
          </div>

          {/* Optional fields */}
          <details className="group">
            <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Advanced options
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="periodDeductions">Period deductions (F)</Label>
                <Input
                  id="periodDeductions"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="tabular-nums"
                  value={periodDeductions}
                  onChange={(e) => setPeriodDeductions(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">RPP, RRSP, union dues per period</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="federalClaim">Federal TD1 claim (K1)</Label>
                <Input
                  id="federalClaim"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Auto"
                  className="tabular-nums"
                  value={federalClaim}
                  onChange={(e) => setFederalClaim(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provincialClaim">Provincial TD1 claim (K1P)</Label>
                <Input
                  id="provincialClaim"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Auto"
                  className="tabular-nums"
                  value={provincialClaim}
                  onChange={(e) => setProvincialClaim(e.target.value)}
                />
              </div>
            </div>
          </details>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            onClick={handleCalculate}
            disabled={calculating}
            className="w-full"
            size="lg"
          >
            {calculating ? "Calculating…" : "Calculate Deductions"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-semibold tracking-tight flex items-center gap-3">
              Results
              <Badge variant="secondary" className="text-xs font-normal">
                {PERIODS_PER_YEAR[frequency as PayFrequency]} periods/yr
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Big net pay */}
            <div className="text-center py-6 bg-accent/30 rounded-xl">
              <p className="text-sm text-muted-foreground mb-1">Net pay this period</p>
              <p className="text-5xl font-bold tabular-nums tracking-tight text-maple">
                {fmtCAD(result.netPay)}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Gross {fmtCAD(result.gross)} &middot;{" "}
                {result.annualTaxableIncome > 0
                  ? `Annual taxable ~ ${fmtCAD(result.annualTaxableIncome)}`
                  : ""}
              </p>
              {result.annualTaxableIncome > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Annual taxable = gross × periods minus CPP/EI deduction (CRA T4127 formula)
                </p>
              )}
            </div>

            {/* Employee deductions */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Employee Deductions
              </h4>
              <div className="space-y-2">
                <DeductionRow label="CPP / QPP" amount={result.cpp} />
                <DeductionRow label="CPP2 (enhancement)" amount={result.cpp2} />
                <DeductionRow label="EI premiums" amount={result.ei} />
                {province === "QC" && <DeductionRow label="QPIP (Quebec)" amount={result.totalDeductions - result.cpp - result.cpp2 - result.ei - result.federalTax - result.provincialTax} />}
                <Separator />
                <DeductionRow label="Federal income tax" amount={result.federalTax} />
                <DeductionRow label="Provincial income tax" amount={result.provincialTax} />
                <Separator />
                <DeductionRow
                  label="Total deductions"
                  amount={result.totalDeductions}
                  bold
                />
              </div>
            </div>

            {/* Employer costs */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Employer Costs (remittance)
              </h4>
              <div className="space-y-2">
                <DeductionRow label="CPP match" amount={result.employer.cpp} />
                <DeductionRow label="CPP2 match" amount={result.employer.cpp2} />
                <DeductionRow label="EI (1.4×)" amount={result.employer.ei} />
                <Separator />
                <DeductionRow label="Total employer cost" amount={result.employer.total} bold />
              </div>
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wider mb-2">
                  Warnings
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="text-sm text-amber-700 dark:text-amber-300">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Estimates only. Always verify with CRA PDOC for your specific situation.
              Tax tables: T4127 121st edition (January 2026).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DeductionRow({
  label,
  amount,
  bold,
}: {
  label: string;
  amount: number;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={bold ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>
        {label}
      </span>
      <span
        className={
          bold
            ? "text-sm font-bold tabular-nums"
            : "text-sm tabular-nums"
        }
      >
        {fmtCAD(amount)}
      </span>
    </div>
  );
}
