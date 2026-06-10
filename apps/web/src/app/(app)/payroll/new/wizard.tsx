"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { PayRunPreview } from "@/lib/actions/payroll";

// ─── Props ─────────────────────────────────────────────────────────────────────

type PayGroupOption = {
  id: string;
  name: string;
  frequency: string;
  defaultProvince: string;
};

type EmployeeOption = {
  id: string;
  name: string;
};

type Props = {
  payGroups: PayGroupOption[];
  employees: EmployeeOption[];
  previewAction: (formData: FormData) => Promise<PayRunPreview>;
  finalizeAction: (formData: FormData) => Promise<void>;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtCAD(n: number): string {
  return `$${n.toFixed(2)}`;
}

type Step = "input" | "preview" | "finalizing";

// ─── Component ─────────────────────────────────────────────────────────────────

export function PayRunWizard({ payGroups, employees, previewAction, finalizeAction }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [isPending, startTransition] = useTransition();

  // Step 1 state
  const [payGroupId, setPayGroupId] = useState("");
  const [payDate, setPayDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [grossAmounts, setGrossAmounts] = useState<Record<string, string>>(
    Object.fromEntries(employees.map((e) => [e.id, ""]))
  );
  const [error, setError] = useState<string | null>(null);

  // Step 2 state
  const [preview, setPreview] = useState<PayRunPreview | null>(null);

  // ── Step 1 → Step 2 ──────────────────────────────────────────────────────

  async function handlePreview() {
    setError(null);

    if (!payGroupId) {
      setError("Please select a pay group.");
      return;
    }

    // Build gross amounts JSON
    const amounts: Record<string, number> = {};
    for (const emp of employees) {
      const val = parseFloat(grossAmounts[emp.id] ?? "");
      if (!isNaN(val) && val > 0) {
        amounts[emp.id] = val;
      }
    }

    if (Object.keys(amounts).length === 0) {
      setError("Enter gross pay for at least one employee.");
      return;
    }

    const formData = new FormData();
    formData.set("payGroupId", payGroupId);
    formData.set("payDate", payDate);
    formData.set("grossAmounts", JSON.stringify(amounts));

    startTransition(async () => {
      try {
        const result = await previewAction(formData);
        setPreview(result);
        setStep("preview");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Calculation failed.");
      }
    });
  }

  // ── Step 2 → Step 3 ──────────────────────────────────────────────────────

  async function handleFinalize() {
    if (!preview) return;

    const formData = new FormData();
    formData.set("payGroupId", payGroupId);
    formData.set("payDate", payDate);
    formData.set("preview", JSON.stringify(preview));

    startTransition(async () => {
      try {
        await finalizeAction(formData);
        // Redirect happens server-side; fallback:
        router.push("/payroll");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Finalization failed.");
        setStep("preview");
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-4 text-sm">
        <StepBadge number={1} label="Enter pay" active={step === "input"} done={step !== "input"} />
        <Separator className="flex-1 max-w-8" />
        <StepBadge number={2} label="Preview" active={step === "preview"} done={step === "finalizing"} />
        <Separator className="flex-1 max-w-8" />
        <StepBadge number={3} label="Finalize" active={step === "finalizing"} done={false} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Step 1: Input ──────────────────────────────────────────────── */}
      {step === "input" && (
        <div className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Pay run details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pay group</Label>
                  <Select value={payGroupId} onValueChange={(v) => setPayGroupId(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select pay group…" />
                    </SelectTrigger>
                    <SelectContent>
                      {payGroups.map((pg) => (
                        <SelectItem key={pg.id} value={pg.id}>
                          {pg.name} ({pg.frequency.toLowerCase()}, {pg.defaultProvince})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payDate">Pay period end date</Label>
                  <Input
                    id="payDate"
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Gross period income</CardTitle>
              <CardDescription>
                Enter the gross pay for each active employee this period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No active employees.{" "}
                  <a href="/employees/new" className="text-primary underline">
                    Add one first.
                  </a>
                </p>
              ) : (
                <div className="space-y-3">
                  {employees.map((emp) => (
                    <div key={emp.id} className="flex items-center gap-4">
                      <Label className="w-48 text-sm truncate" htmlFor={`gross-${emp.id}`}>
                        {emp.name}
                      </Label>
                      <div className="relative flex-1 max-w-xs">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          $
                        </span>
                        <Input
                          id={`gross-${emp.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="pl-7 tabular-nums"
                          value={grossAmounts[emp.id] ?? ""}
                          onChange={(e) =>
                            setGrossAmounts((prev) => ({
                              ...prev,
                              [emp.id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              onClick={handlePreview}
              disabled={isPending || employees.length === 0}
              size="lg"
            >
              {isPending ? "Calculating…" : "Calculate deductions"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview ─────────────────────────────────────────────── */}
      {step === "preview" && preview && (
        <div className="space-y-6">
          {/* Totals card */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">
                Pay run preview &mdash; {preview.payDate}
              </CardTitle>
              <CardDescription>
                {preview.payGroupName} &middot; {preview.frequency} &middot;{" "}
                {preview.province} &middot; {preview.items.length} employees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <Stat label="Gross pay" value={fmtCAD(preview.totals.gross)} />
                <Stat label="CPP" value={fmtCAD(preview.totals.cpp)} />
                <Stat label="CPP2" value={fmtCAD(preview.totals.cpp2)} />
                <Stat label="EI" value={fmtCAD(preview.totals.ei)} />
                <Stat label="Federal tax" value={fmtCAD(preview.totals.federalTax)} />
                <Stat label="Provincial tax" value={fmtCAD(preview.totals.provincialTax)} />
                <Separator className="col-span-full" />
                <Stat label="Total deductions" value={fmtCAD(preview.totals.deductions)} bold />
                <Stat label="Net pay" value={fmtCAD(preview.totals.netPay)} bold />
                <Stat label="Employer cost" value={fmtCAD(preview.totals.employerTotal)} bold />
              </div>
            </CardContent>
          </Card>

          {/* Employee breakdown */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Employee breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {preview.items.map((item) => (
                <div
                  key={item.employeeId}
                  className="rounded-lg border border-border/40 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{item.employeeName}</p>
                    <p className="text-sm tabular-nums font-bold">
                      Net {fmtCAD(item.result.netPay)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Gross</span>
                      <p className="tabular-nums">{fmtCAD(item.gross)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CPP</span>
                      <p className="tabular-nums">{fmtCAD(item.result.cpp)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">EI</span>
                      <p className="tabular-nums">{fmtCAD(item.result.ei)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tax</span>
                      <p className="tabular-nums">
                        {fmtCAD(item.result.federalTax + item.result.provincialTax)}
                      </p>
                    </div>
                  </div>

                  {/* Warnings */}
                  {item.result.warnings.length > 0 && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
                      <ul className="list-disc list-inside text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
                        {item.result.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              onClick={handleFinalize}
              disabled={isPending}
              size="lg"
            >
              {isPending ? "Finalizing…" : "Finalize pay run"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setStep("input");
                setError(null);
              }}
              disabled={isPending}
            >
              Back to edit
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Done (redirect handled server-side) ─────────────────── */}
      {step === "finalizing" && (
        <Card className="border-border/60">
          <CardContent className="py-8 text-center space-y-2">
            <p className="text-lg font-semibold">Finalizing pay run…</p>
            <p className="text-sm text-muted-foreground">
              Creating records and updating YTD ledgers.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StepBadge({
  number,
  label,
  active,
  done,
}: {
  number: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
          done
            ? "bg-primary text-primary-foreground"
            : active
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? "✓" : number}
      </span>
      <span
        className={`text-sm ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </span>
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
      <p
        className={`tabular-nums ${bold ? "font-bold text-lg" : "font-semibold"}`}
      >
        {value}
      </p>
    </div>
  );
}
