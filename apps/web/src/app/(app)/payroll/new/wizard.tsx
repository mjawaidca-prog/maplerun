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
  payRate?: number | null;
};

type Props = {
  plan?: string;
  payGroups: PayGroupOption[];
  employees: EmployeeOption[];
  previewAction: (formData: FormData) => Promise<PayRunPreview>;
  finalizeAction: (formData: FormData) => Promise<void>;
  finalizeBlockReason?: string | null;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Default insurable hours by pay frequency (standard 37.5 hr week) */
function defaultHours(frequency: string): string {
  switch (frequency) {
    case "WEEKLY": return "37.5";
    case "BIWEEKLY": return "75";
    case "SEMIMONTHLY": return "86";
    case "MONTHLY": return "173";
    default: return "75";
  }
}

function fmtCAD(n: number): string {
  return `$${n.toFixed(2)}`;
}

type Step = "input" | "preview" | "finalizing";

// ─── sessionStorage key ───────────────────────────────────────────────────
const STORAGE_KEY = "maplerun-wizard";

function saveWizardState(state: { payGroupId?: string; payDate?: string; actualPayDate?: string; grossAmounts?: Record<string,string>; hours?: Record<string,string> }) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}
function loadWizardState() {
  try { const v = sessionStorage.getItem(STORAGE_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
function clearWizardState() { try { sessionStorage.removeItem(STORAGE_KEY); } catch {} }

// ─── Component ─────────────────────────────────────────────────────────────────

export function PayRunWizard({ plan = "growth", payGroups, employees, previewAction, finalizeAction, finalizeBlockReason = null }: Props) {
  const router = useRouter();
  const showExtendedPayTypes = plan === "growth" || plan === "accountant";
  const showFullPayGrid = plan === "accountant";
  const [step, setStep] = useState<Step>("input");
  const [isPending, startTransition] = useTransition();

  // Step 1 state — restore from sessionStorage only if found
  const saved = typeof window !== "undefined" ? loadWizardState() : null;
  const [payGroupId, setPayGroupId] = useState(saved?.payGroupId ?? "");
  const [payDate, setPayDate] = useState(saved?.payDate ?? new Date().toISOString().slice(0, 10));
  const [actualPayDate, setActualPayDate] = useState(saved?.actualPayDate ?? "");
  const [grossAmounts, setGrossAmounts] = useState<Record<string, string>>(
    saved?.grossAmounts ?? Object.fromEntries(employees.map((e) => [e.id, e.payRate ? String(e.payRate) : ""]))
  );
  // Try importing hours from timesheet upload (sessionStorage)
  const importedHours = (() => {
    try {
      const raw = sessionStorage.getItem("maplerun-timesheet-hours");
      return raw ? JSON.parse(raw) as Record<string, string> : null;
    } catch { return null; }
  })();

  const [hours, setHours] = useState<Record<string, string>>(
    (() => {
      // Imported hours from timesheet take priority over saved wizard state
      if (importedHours) {
        const mapped: Record<string, string> = {};
        for (const emp of employees) {
          const fullName = emp.name.toLowerCase().trim();
          const match = Object.entries(importedHours).find(
            ([name]) => name.toLowerCase().trim() === fullName
          );
          const sel = payGroups.find(p => p.id === payGroupId);
          mapped[emp.id] = match?.[1] ?? defaultHours(sel?.frequency ?? "BIWEEKLY");
        }
        try { sessionStorage.removeItem("maplerun-timesheet-hours"); } catch {}
        return mapped;
      }
      // Fall back to saved wizard state, then default 75
      const sel = payGroups.find(p => p.id === saved?.payGroupId);
      const freq = sel?.frequency ?? "BIWEEKLY";
      return saved?.hours ?? Object.fromEntries(employees.map((e) => [e.id, defaultHours(freq)]));
    })()
  );
  // Wave 3 B5 — the expander's bonus / stat / overtime inputs were
  // decorative (uncontrolled) until now; they are wired through to
  // preview + finalize. Bonus and vacation are added to gross by the
  // server; overtime/stat amounts are "of-which" components of the
  // gross entered above (with their hours, for the stub's hrs × rate).
  const [bonusAmounts, setBonusAmounts] = useState<Record<string, string>>({});
  const [statAmounts, setStatAmounts] = useState<Record<string, string>>({});
  const [statHours, setStatHours] = useState<Record<string, string>>({});
  const [overtimeAmounts, setOvertimeAmounts] = useState<Record<string, string>>({});
  const [overtimeHours, setOvertimeHours] = useState<Record<string, string>>({});
  // Wave 3 B6 — breadth inputs: non-cash taxable benefits, non-taxable
  // reimbursements, and named custom deductions per employee.
  const [taxableBenefits, setTaxableBenefits] = useState<Record<string, string>>({});
  const [reimbursements, setReimbursements] = useState<Record<string, string>>({});
  type CustomDeductionRow = { name: string; amount: string; reducesTaxable: boolean; reducesPensionable: boolean; reducesInsurable: boolean };
  const [customDeductions, setCustomDeductions] = useState<Record<string, CustomDeductionRow[]>>({});
  const [vacationEnabled, setVacationEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(employees.map((e) => [e.id, false]))
  );
  const [vacationRate, setVacationRate] = useState<Record<string, string>>(
    Object.fromEntries(employees.map((e) => [e.id, "4"]))
  );
  const [error, setError] = useState<string | null>(null);

  // Step 2 state
  const [preview, setPreview] = useState<PayRunPreview | null>(null);

  function fmtVacation(empId: string): string {
    const gross = parseFloat(grossAmounts[empId] ?? "0");
    const rate = parseFloat(vacationRate[empId] ?? "4");
    if (isNaN(gross) || gross <= 0) return "$0.00";
    return `$${(gross * rate / 100).toFixed(2)}`;
  }

  // Save state on demand (call before navigating away)
  function persistState() {
    saveWizardState({ payGroupId, payDate, grossAmounts, actualPayDate, hours });
  }

  // ── Step 1 → Step 2 ──────────────────────────────────────────────────────

  async function handlePreview() {
    setError(null);

    if (!payGroupId) {
      setError("Please select a pay group.");
      return;
    }

    if (employees.length === 0) {
      setError("No active employees found. Add at least one employee before running payroll.");
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
    // Block $0 gross — all employees with amounts must have positive gross
    const zeroEmployees = Object.entries(amounts).filter(([, v]) => v <= 0).map(([id]) => employees.find(e => e.id === id)?.name ?? id);
    if (zeroEmployees.length > 0 && Object.values(amounts).every(v => v <= 0)) {
      setError("At least one employee must have gross pay above $0.00. Zero-dollar pay runs are not supported.");
      return;
    }
    if (zeroEmployees.length > 0) {
      setError(`${zeroEmployees[0]} has $0.00 gross pay. Remove them or enter a positive amount.`);
      return;
    }

    const formData = new FormData();
    formData.set("payGroupId", payGroupId);
    formData.set("payDate", payDate);
    formData.set("grossAmounts", JSON.stringify(amounts));
    // Pass hours and vacation data
    const hoursData: Record<string, number> = {};
    const vacationData: Record<string, { enabled: boolean; rate: number; amount: number }> = {};
    for (const emp of employees) {
      hoursData[emp.id] = parseFloat(hours[emp.id] ?? "0") || 0;
      if (vacationEnabled[emp.id]) {
        const val = parseFloat(grossAmounts[emp.id] ?? "0") || 0;
        const rate = parseFloat(vacationRate[emp.id] ?? "4") || 4;
        vacationData[emp.id] = { enabled: true, rate: rate / 100, amount: val * rate / 100 };
      }
    }
    formData.set("hours", JSON.stringify(hoursData));
    formData.set("vacation", JSON.stringify(vacationData));
    appendExtendedInputs(formData);

    persistState();
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

  // Build the run INPUTS form data — mirrors handlePreview's construction
  // exactly. Wave 1 PR C: finalize sends these inputs and the server
  // recomputes every figure from them; the preview JSON is never posted.
  function buildInputsFormData(): FormData | null {
    const amounts: Record<string, number> = {};
    for (const emp of employees) {
      const val = parseFloat(grossAmounts[emp.id] ?? "");
      if (!isNaN(val) && val > 0) {
        amounts[emp.id] = val;
      }
    }
    if (Object.keys(amounts).length === 0) return null;

    const formData = new FormData();
    formData.set("payGroupId", payGroupId);
    formData.set("payDate", payDate);
    formData.set("grossAmounts", JSON.stringify(amounts));
    const hoursData: Record<string, number> = {};
    const vacationData: Record<string, { enabled: boolean; rate: number; amount: number }> = {};
    for (const emp of employees) {
      hoursData[emp.id] = parseFloat(hours[emp.id] ?? "0") || 0;
      if (vacationEnabled[emp.id]) {
        const val = parseFloat(grossAmounts[emp.id] ?? "0") || 0;
        const rate = parseFloat(vacationRate[emp.id] ?? "4") || 4;
        vacationData[emp.id] = { enabled: true, rate: rate / 100, amount: val * rate / 100 };
      }
    }
    formData.set("hours", JSON.stringify(hoursData));
    formData.set("vacation", JSON.stringify(vacationData));
    appendExtendedInputs(formData);
    return formData;
  }

  // Wave 3 B5 — bonus / overtime / stat inputs shared by preview and
  // finalize so both server paths see identical run inputs.
  function appendExtendedInputs(formData: FormData) {
    const bonusData: Record<string, number> = {};
    const overtimeData: Record<string, { hours: number; amount: number }> = {};
    const statData: Record<string, { hours: number; amount: number }> = {};
    for (const emp of employees) {
      const bonus = parseFloat(bonusAmounts[emp.id] ?? "") || 0;
      if (bonus > 0) bonusData[emp.id] = bonus;
      const otAmount = parseFloat(overtimeAmounts[emp.id] ?? "") || 0;
      const otHours = parseFloat(overtimeHours[emp.id] ?? "") || 0;
      if (otAmount > 0 || otHours > 0) overtimeData[emp.id] = { hours: otHours, amount: otAmount };
      const stAmount = parseFloat(statAmounts[emp.id] ?? "") || 0;
      const stHours = parseFloat(statHours[emp.id] ?? "") || 0;
      if (stAmount > 0 || stHours > 0) statData[emp.id] = { hours: stHours, amount: stAmount };
    }
    if (Object.keys(bonusData).length > 0) formData.set("bonus", JSON.stringify(bonusData));
    if (Object.keys(overtimeData).length > 0) formData.set("overtime", JSON.stringify(overtimeData));
    if (Object.keys(statData).length > 0) formData.set("stat", JSON.stringify(statData));

    // Wave 3 B6 — taxable benefits / reimbursements / custom deductions.
    const benefitsData: Record<string, number> = {};
    const reimbursementData: Record<string, number> = {};
    const customData: Record<string, { name: string; amount: number; reducesTaxable: boolean; reducesPensionable: boolean; reducesInsurable: boolean }[]> = {};
    for (const emp of employees) {
      const benefits = parseFloat(taxableBenefits[emp.id] ?? "") || 0;
      if (benefits > 0) benefitsData[emp.id] = benefits;
      const reimb = parseFloat(reimbursements[emp.id] ?? "") || 0;
      if (reimb > 0) reimbursementData[emp.id] = reimb;
      const rows = (customDeductions[emp.id] ?? [])
        .map((r) => ({ name: r.name.trim(), amount: parseFloat(r.amount) || 0, reducesTaxable: r.reducesTaxable, reducesPensionable: r.reducesPensionable, reducesInsurable: r.reducesInsurable }))
        .filter((r) => r.name && r.amount > 0);
      if (rows.length > 0) customData[emp.id] = rows;
    }
    if (Object.keys(benefitsData).length > 0) formData.set("taxableBenefits", JSON.stringify(benefitsData));
    if (Object.keys(reimbursementData).length > 0) formData.set("reimbursements", JSON.stringify(reimbursementData));
    if (Object.keys(customData).length > 0) formData.set("customDeductions", JSON.stringify(customData));
  }

  async function handleFinalize() {
    if (!preview) return;

    if (finalizeBlockReason) {
      setError(finalizeBlockReason);
      return;
    }

    const formData = buildInputsFormData();
    if (!formData) {
      setError("Enter gross pay for at least one employee.");
      return;
    }
    formData.set("actualPayDate", actualPayDate || payDate);

    startTransition(async () => {
      try {
        clearWizardState();
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
      {/* Stepper */}
      <div className="flex items-center max-w-[440px] mx-auto mb-8">
        <StepDot num={1} label="Input" state={step === "input" ? "active" : "done"} />
        <StepLine done={step !== "input"} />
        <StepDot num={2} label="Preview" state={step === "preview" ? "active" : step === "finalizing" ? "done" : "pending"} />
        <StepLine done={step === "finalizing"} />
        <StepDot num={3} label="Finalize" state={step === "finalizing" ? "active" : "pending"} />
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
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Pay group</Label>
                  <Select value={payGroupId} onValueChange={(v) => setPayGroupId(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select pay group…">
                        {payGroups.find(pg => pg.id === payGroupId)?.name ?? "Select pay group…"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {payGroups.length === 0 ? (
                        <div className="px-2 py-4 text-sm text-muted-foreground text-center">No pay groups. Create one first.</div>
                      ) : (
                        payGroups.map((pg) => (
                          <SelectItem key={pg.id} value={pg.id}>
                            {pg.name} ({pg.frequency.toLowerCase()}, {pg.defaultProvince})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payDate">Period end date</Label>
                  <Input id="payDate" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                  <p className="text-[11px] text-[#A8A29E]">Last day of the pay period</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="actualPayDate">Pay date</Label>
                  <Input id="actualPayDate" type="date" value={actualPayDate} onChange={(e) => setActualPayDate(e.target.value)} />
                  <p className="text-[11px] text-[#A8A29E]">When employees receive pay</p>
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
                    <div key={emp.id}>
                      <div className="flex items-center gap-4">
                        <Label className="w-40 text-sm truncate" htmlFor={`gross-${emp.id}`}>
                          {emp.name}
                        </Label>
                        <div className="relative w-20">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">hrs</span>
                          <Input
                            id={`hours-${emp.id}`}
                            type="number" min="0" step="0.5" placeholder={defaultHours(payGroups.find(p => p.id === payGroupId)?.frequency ?? "BIWEEKLY")}
                            className="pl-8 tabular-nums text-xs h-8"
                            value={hours[emp.id] ?? defaultHours(payGroups.find(p => p.id === payGroupId)?.frequency ?? "BIWEEKLY")}
                            onChange={(e) => { const next = { ...hours, [emp.id]: e.target.value }; setHours(next); }}
                          />
                        </div>
                        <div className="relative flex-1 max-w-xs">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input
                            id={`gross-${emp.id}`}
                            type="number" min="0" step="0.01" placeholder="0.00"
                            className="pl-7 tabular-nums"
                            value={grossAmounts[emp.id] ?? ""}
                            onChange={(e) => { const next = { ...grossAmounts, [emp.id]: e.target.value }; setGrossAmounts(next); }}
                          />
                        </div>
                      </div>
                      {/* Vacation pay toggle */}
                      <div className="flex items-center gap-3 mt-2 ml-[13.5rem]">
                        <label className="flex items-center gap-2 text-xs text-[#78716C] cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={vacationEnabled[emp.id] ?? false}
                            onChange={(e) => setVacationEnabled((prev) => ({ ...prev, [emp.id]: e.target.checked }))}
                            className="rounded"
                          />
                          Vacation pay
                        </label>
                        {vacationEnabled[emp.id] && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0" max="100" step="0.1"
                              value={vacationRate[emp.id] ?? "4"}
                              onChange={(e) => setVacationRate((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                              className="w-14 border border-[#D6D3D1] rounded-md px-2 py-1 text-xs text-right"
                            />
                            <span className="text-xs text-[#A8A29E]">% of gross</span>
                            <span className="text-[11px] text-[#16A34A] font-semibold">
                              +{fmtVacation(emp.id)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Growth expander */}
                      {showExtendedPayTypes && (
                        <details className="group ml-[13.5rem] mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-[#1C1917] transition-colors">
                            ▸ Add bonus · stat · benefits · deductions
                          </summary>
                          <div className={`grid ${showFullPayGrid ? "grid-cols-3" : "grid-cols-2"} gap-3 mt-3 pl-1`}>
                            <div>
                              <Label className="text-[11px] text-[#A8A29E]">Bonus</Label>
                              <div className="relative mt-1">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                <Input type="number" min="0" step="0.01" placeholder="0.00" className="pl-6 text-xs h-8"
                                  value={bonusAmounts[emp.id] ?? ""}
                                  onChange={(e) => setBonusAmounts((prev) => ({ ...prev, [emp.id]: e.target.value }))} />
                              </div>
                            </div>
                            <div>
                              <Label className="text-[11px] text-[#A8A29E]">Stat holiday pay (part of gross)</Label>
                              <div className="relative mt-1">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                <Input type="number" min="0" step="0.01" placeholder="0.00" className="pl-6 text-xs h-8"
                                  value={statAmounts[emp.id] ?? ""}
                                  onChange={(e) => setStatAmounts((prev) => ({ ...prev, [emp.id]: e.target.value }))} />
                              </div>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <input type="number" min="0" step="0.5" placeholder="hrs"
                                  value={statHours[emp.id] ?? ""}
                                  onChange={(e) => setStatHours((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                                  className="w-16 border border-[#D6D3D1] rounded-md px-2 py-1 text-xs text-right" />
                                <span className="text-[11px] text-[#A8A29E]">stat hours</span>
                              </div>
                            </div>
                            <div>
                              <Label className="text-[11px] text-[#A8A29E]">Vacation payout</Label>
                              <div className="relative mt-1">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                <Input type="number" min="0" step="0.01" placeholder="0.00" className="pl-6 text-xs h-8" />
                              </div>
                            </div>
                            {showFullPayGrid && (
                              <>
                                <div>
                                  <Label className="text-[11px] text-[#A8A29E]">Overtime (part of gross)</Label>
                                  <div className="relative mt-1">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                    <Input type="number" min="0" step="0.01" placeholder="0.00" className="pl-6 text-xs h-8"
                                      value={overtimeAmounts[emp.id] ?? ""}
                                      onChange={(e) => setOvertimeAmounts((prev) => ({ ...prev, [emp.id]: e.target.value }))} />
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <input type="number" min="0" step="0.5" placeholder="hrs"
                                      value={overtimeHours[emp.id] ?? ""}
                                      onChange={(e) => setOvertimeHours((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                                      className="w-16 border border-[#D6D3D1] rounded-md px-2 py-1 text-xs text-right" />
                                    <span className="text-[11px] text-[#A8A29E]">overtime hours</span>
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-[11px] text-[#A8A29E]">Commission</Label>
                                  <div className="relative mt-1">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                    <Input type="number" min="0" step="0.01" placeholder="0.00" className="pl-6 text-xs h-8" />
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-[11px] text-[#A8A29E]">Retro / back pay</Label>
                                  <div className="relative mt-1">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                    <Input type="number" min="0" step="0.01" placeholder="0.00" className="pl-6 text-xs h-8" />
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Wave 3 B6 — benefits / reimbursement / custom deductions */}
                          <div className="grid grid-cols-2 gap-3 mt-3 pl-1">
                            <div>
                              <Label className="text-[11px] text-[#A8A29E]">Taxable benefits (non-cash)</Label>
                              <div className="relative mt-1">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                <Input type="number" min="0" step="0.01" placeholder="0.00" className="pl-6 text-xs h-8"
                                  value={taxableBenefits[emp.id] ?? ""}
                                  onChange={(e) => setTaxableBenefits((prev) => ({ ...prev, [emp.id]: e.target.value }))} />
                              </div>
                              <p className="text-[10px] text-[#A8A29E] mt-1">Added to CPP/EI/tax bases, not to pay.</p>
                            </div>
                            <div>
                              <Label className="text-[11px] text-[#A8A29E]">Reimbursement (non-taxable)</Label>
                              <div className="relative mt-1">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                <Input type="number" min="0" step="0.01" placeholder="0.00" className="pl-6 text-xs h-8"
                                  value={reimbursements[emp.id] ?? ""}
                                  onChange={(e) => setReimbursements((prev) => ({ ...prev, [emp.id]: e.target.value }))} />
                              </div>
                              <p className="text-[10px] text-[#A8A29E] mt-1">Added to net pay; never taxed.</p>
                            </div>
                          </div>
                          <div className="mt-3 pl-1 space-y-2">
                            <Label className="text-[11px] text-[#A8A29E]">Custom deductions</Label>
                            {(customDeductions[emp.id] ?? []).map((row, idx) => (
                              <div key={idx} className="flex flex-wrap items-center gap-2">
                                <input type="text" placeholder="Name (e.g. RRSP)" value={row.name}
                                  onChange={(e) => setCustomDeductions((prev) => ({ ...prev, [emp.id]: (prev[emp.id] ?? []).map((r, i) => i === idx ? { ...r, name: e.target.value } : r) }))}
                                  className="w-32 border border-[#D6D3D1] rounded-md px-2 py-1 text-xs" />
                                <input type="number" min="0" step="0.01" placeholder="0.00" value={row.amount}
                                  onChange={(e) => setCustomDeductions((prev) => ({ ...prev, [emp.id]: (prev[emp.id] ?? []).map((r, i) => i === idx ? { ...r, amount: e.target.value } : r) }))}
                                  className="w-20 border border-[#D6D3D1] rounded-md px-2 py-1 text-xs text-right" />
                                {([["reducesTaxable", "Tax"], ["reducesPensionable", "CPP"], ["reducesInsurable", "EI"]] as const).map(([key, label]) => (
                                  <label key={key} className="flex items-center gap-1 text-[11px] text-[#78716C]">
                                    <input type="checkbox" checked={row[key]}
                                      onChange={(e) => setCustomDeductions((prev) => ({ ...prev, [emp.id]: (prev[emp.id] ?? []).map((r, i) => i === idx ? { ...r, [key]: e.target.checked } : r) }))} />
                                    ↓{label}
                                  </label>
                                ))}
                                <button type="button" className="text-[11px] text-[#B3261E]"
                                  onClick={() => setCustomDeductions((prev) => ({ ...prev, [emp.id]: (prev[emp.id] ?? []).filter((_, i) => i !== idx) }))}>
                                  Remove
                                </button>
                              </div>
                            ))}
                            <button type="button" className="text-[11px] text-primary underline"
                              onClick={() => setCustomDeductions((prev) => ({ ...prev, [emp.id]: [...(prev[emp.id] ?? []), { name: "", amount: "", reducesTaxable: true, reducesPensionable: false, reducesInsurable: false }] }))}>
                              + Add deduction (RRSP, union dues, benefits…)
                            </button>
                            <p className="text-[10px] text-[#A8A29E]">↓Tax lowers taxable income (RRSP/RPP/union dues); ↓CPP / ↓EI also lower those bases. The amount is always withheld from net pay and printed on the stub.</p>
                          </div>
                        </details>
                      )}
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
          {/* Finalize warning */}
          <div className="flex gap-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-[10px] px-4 py-3 text-[13px] text-[#92400E]">
            <span className="text-base">⚠️</span>
            <span><b>Important:</b> Finalizing makes this pay run <b>permanent and read-only</b>. You won't be able to edit it after this step. Verify all amounts below before continuing.</span>
          </div>
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
                    <p className="font-semibold text-sm">{item.employeeName} <span className="font-normal text-muted-foreground">· {item.province}</span></p>
                    <p className="text-sm tabular-nums font-bold">
                      Net {fmtCAD(item.netPay)}
                    </p>
                  </div>
                  {(item.bonus > 0 || item.taxableBenefits > 0 || item.reimbursement > 0 || item.customDeductions.length > 0) && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {item.bonus > 0 && <p>Bonus {fmtCAD(item.bonus)} — taxed by the T4127 lump-sum method (included in gross above)</p>}
                      {item.taxableBenefits > 0 && <p>Taxable benefits {fmtCAD(item.taxableBenefits)} — in CPP/EI/tax bases, not in gross</p>}
                      {item.customDeductions.map((d) => (
                        <p key={d.name}>{d.name}: −{fmtCAD(d.amount)} withheld</p>
                      ))}
                      {item.reimbursement > 0 && <p>Reimbursement +{fmtCAD(item.reimbursement)} added to net (non-taxable)</p>}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
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
                      <span className="text-muted-foreground">CPP2</span>
                      <p className="tabular-nums">{fmtCAD(item.result.cpp2)}</p>
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

function StepDot({ num, label, state }: { num: number; label: string; state: "active" | "done" | "pending" }) {
  return (
    <div className="flex items-center gap-2.5 flex-1">
      <span className={`inline-flex items-center justify-center w-[30px] h-[30px] rounded-full text-[13px] font-bold flex-shrink-0 ${
        state === "active" ? "bg-[#B3261E] text-white" :
        state === "done" ? "bg-[#16A34A] text-white" :
        "bg-[#E7E5E4] text-[#A8A29E]"
      }`}>
        {state === "done" ? "✓" : num}
      </span>
      <span className={`text-[13px] font-semibold ${state === "pending" ? "text-[#A8A29E]" : "text-[#1C1917]"}`}>{label}</span>
    </div>
  );
}

function StepLine({ done }: { done: boolean }) {
  return <div className={`flex-1 h-0.5 mx-3 ${done ? "bg-[#16A34A]" : "bg-[#E7E5E4]"}`} />;
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
