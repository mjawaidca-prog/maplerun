"use client";

import { useState } from "react";
import { calculatePay, type ProvinceCode, type PayFrequency, type PayResult, PERIODS_PER_YEAR, ZERO_YTD } from "@maplerun/tax-engine";
import Link from "next/link";

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

const FREQUENCIES: { value: PayFrequency; label: string; short: string }[] = [
  { value: "weekly", label: "Weekly (52)", short: "Weekly" },
  { value: "biweekly", label: "Biweekly (26)", short: "Biweekly" },
  { value: "semimonthly", label: "Semi-monthly (24)", short: "Semi-monthly" },
  { value: "monthly", label: "Monthly (12)", short: "Monthly" },
];

function fmtCAD(cents: number): string {
  return `$${cents.toFixed(2)}`;
}

export default function PaychequeCalculator() {
  const [province, setProvince] = useState<ProvinceCode | "">("");
  const [frequency, setFrequency] = useState<PayFrequency | "">("");
  const [grossIncome, setGrossIncome] = useState<string>("");
  const [periodDeductions, setPeriodDeductions] = useState<string>("");
  const [federalClaim, setFederalClaim] = useState<string>("");
  const [provincialClaim, setProvincialClaim] = useState<string>("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [result, setResult] = useState<PayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);

  function handleCalculate() {
    setError(null);
    setResult(null);

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

      const P = PERIODS_PER_YEAR[frequency as PayFrequency];
      const annualCPP = payResult.cpp * P;
      const annualEI = payResult.ei * P;
      const cppMax = 4034.10;
      const eiMax = 1123.07;
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

  const provinceLabel = PROVINCES.find((p) => p.code === province)?.label ?? "";

  return (
    <div className="bg-white rounded-[14px] p-[34px] shadow-[0_28px_70px_rgba(0,0,0,0.35)]">
      <h2 className="text-[28px] sm:text-[32px] font-extrabold tracking-[-0.02em] m-0">Canadian payroll calculator</h2>
      <p className="text-[#5D6673] text-sm sm:text-base mt-1.5 mb-6">
        Uses 2026 CRA T4127 payroll deduction tables.
      </p>

      {/* Form */}
      <div className="grid grid-cols-2 gap-4">
        {/* Province */}
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-sm sm:text-[15px] text-[#0F1419]">Province of employment</label>
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value as ProvinceCode)}
            className="w-full h-11 sm:h-12 border border-[#CFD6DF] rounded-md px-3 sm:px-4 text-sm sm:text-base bg-white text-[#0F1419]"
          >
            <option value="">Select province…</option>
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Frequency */}
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-sm sm:text-[15px] text-[#0F1419]">Pay frequency</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as PayFrequency)}
            className="w-full h-11 sm:h-12 border border-[#CFD6DF] rounded-md px-3 sm:px-4 text-sm sm:text-base bg-white text-[#0F1419]"
          >
            <option value="">Select frequency…</option>
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Gross pay */}
        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="font-semibold text-sm sm:text-[15px] text-[#0F1419]">Gross pay before deductions</label>
          <div className="relative">
            <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-[#5D6673] font-medium text-sm sm:text-base">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="2,500.00"
              value={grossIncome}
              onChange={(e) => setGrossIncome(e.target.value)}
              className="w-full h-11 sm:h-12 border border-[#CFD6DF] rounded-md pl-7 sm:pl-8 pr-3 sm:pr-4 text-sm sm:text-base bg-white text-[#0F1419] font-mono tabular-nums"
            />
          </div>
        </div>

        {/* Advanced options toggle */}
        <button
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="col-span-2 border border-[#D7DDE4] rounded-lg p-3 sm:p-4 flex justify-between items-center bg-[#FAFBFC] cursor-pointer hover:bg-[#F4F6F8] transition-colors"
        >
          <div className="text-left">
            <strong className="block text-sm sm:text-base text-[#0F1419]">Advanced options</strong>
            <span className="text-xs sm:text-sm text-[#66707D]">TD1 amounts, pension/RRSP deductions, union dues</span>
          </div>
          <span className={`text-[#66707D] text-lg transition-transform ${advancedOpen ? "rotate-180" : ""}`}>⌄</span>
        </button>

        {/* Advanced fields */}
        {advancedOpen && (
          <div className="col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-[13px] text-[#0F1419]">Period deductions</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={periodDeductions}
                onChange={(e) => setPeriodDeductions(e.target.value)}
                className="w-full h-11 border border-[#CFD6DF] rounded-md px-3 text-sm bg-white text-[#0F1419] font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-[13px] text-[#0F1419]">Federal TD1 claim</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Auto"
                value={federalClaim}
                onChange={(e) => setFederalClaim(e.target.value)}
                className="w-full h-11 border border-[#CFD6DF] rounded-md px-3 text-sm bg-white text-[#0F1419] font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-[13px] text-[#0F1419]">Provincial TD1 claim</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Auto"
                value={provincialClaim}
                onChange={(e) => setProvincialClaim(e.target.value)}
                className="w-full h-11 border border-[#CFD6DF] rounded-md px-3 text-sm bg-white text-[#0F1419] font-mono"
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="col-span-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-[13px] text-red-700">
            {error}
          </div>
        )}

        {/* Calculate button */}
        <button
          onClick={handleCalculate}
          disabled={calculating}
          className="col-span-2 h-[50px] sm:h-[54px] border-0 rounded-[7px] bg-[#E30613] hover:bg-[#C90510] text-white text-[16px] sm:text-[18px] font-bold cursor-pointer mt-1 disabled:opacity-60 transition-colors"
        >
          {calculating ? "Calculating…" : "Calculate take-home pay"}
        </button>
      </div>

      {/* Results */}
      {result && (
        <>
          <div className="h-px bg-[#E5E9EF] my-5" />

          {/* Results: responsive — 3 cols on desktop, stacked on narrow */}
          <div className="grid sm:grid-cols-[1fr_1.1fr_1fr] gap-5 max-sm:gap-4">
            {/* Net Pay — full width on mobile, first col on desktop */}
            <div className="max-sm:col-span-full max-sm:text-center">
              <h3 className="text-base sm:text-lg font-bold m-0 mb-2">Estimated net pay</h3>
              <div className="text-[36px] sm:text-[44px] font-extrabold tracking-[-0.02em] mb-3 text-[#0F1419]">
                {fmtCAD(result.netPay)}
              </div>
              <p className="text-[#3E4752] text-[13px] leading-relaxed m-0">
                For a {FREQUENCIES.find((f) => f.value === frequency)?.short.toLowerCase() ?? ""}{" "}
                {fmtCAD(result.gross)} gross pay
                {provinceLabel ? ` in ${provinceLabel}` : ""}
              </p>
            </div>

            {/* Employee Deductions */}
            <div className="sm:border-l sm:border-[#DDE3EA] sm:pl-5 max-sm:border-t max-sm:border-[#EEF1F4] max-sm:pt-4">
              <h3 className="text-base sm:text-lg font-bold m-0 mb-2">Employee deductions</h3>
              <DeductionRow label="Employee CPP" amount={result.cpp} />
              <DeductionRow label="Employee EI" amount={result.ei} />
              {result.cpp2 > 0 && <DeductionRow label="CPP2 enhancement" amount={result.cpp2} />}
              <DeductionRow label="Federal tax" amount={result.federalTax} />
              <DeductionRow label={`${provinceLabel || "Provincial"} tax`} amount={result.provincialTax} />
              <DeductionRow label="Total employee deductions" amount={result.totalDeductions} total />
            </div>

            {/* Employer Cost */}
            <div className="sm:border-l sm:border-[#DDE3EA] sm:pl-5 max-sm:border-t max-sm:border-[#EEF1F4] max-sm:pt-4">
              <h3 className="text-base sm:text-lg font-bold m-0 mb-2">Employer cost</h3>
              <DeductionRow label="Employer CPP" amount={result.employer.cpp} />
              {result.employer.cpp2 > 0 && <DeductionRow label="Employer CPP2" amount={result.employer.cpp2} />}
              <DeductionRow label="Employer EI" amount={result.employer.ei} />
              <DeductionRow label="Total employer cost" amount={result.employer.total} total />
            </div>
          </div>

          {/* Remittance box */}
          <div className="mt-4 border border-[#D7DDE4] rounded-lg p-4 sm:p-[18px_20px] flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-6">
            <div>
              <strong className="text-base sm:text-lg text-[#0F1419]">Total remittance for the period</strong>
              <span className="block text-[#5D6673] text-[13px] mt-0.5">Employee deductions + employer cost</span>
            </div>
            <div className="text-[32px] sm:text-[38px] font-extrabold tracking-[-0.02em] text-[#0F1419] font-mono tabular-nums">
              {fmtCAD(result.totalDeductions + result.employer.total)}
            </div>
          </div>

          {/* CTA */}
          <Link
            href="/signup"
            className="w-full h-[50px] sm:h-[52px] border-0 rounded-[7px] bg-[#E30613] hover:bg-[#C90510] text-white text-[16px] sm:text-[18px] font-bold mt-3 flex items-center justify-center no-underline transition-colors"
          >
            Run this payroll in NEXVAR
          </Link>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mt-3">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1.5">Warnings</p>
              <ul className="list-disc list-inside space-y-1">
                {result.warnings.map((w, i) => (
                  <li key={i} className="text-[13px] text-amber-700">{w}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[#6B7480] text-[13px] mt-3 leading-relaxed">
            Estimate only. Final payroll may vary based on TD1 forms, benefits, pensions, and other settings.
          </p>
        </>
      )}
    </div>
  );
}

function DeductionRow({
  label,
  amount,
  total,
}: {
  label: string;
  amount: number;
  total?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-2 py-1.5 sm:py-2 text-[13px] sm:text-[15px] ${
        total
          ? "font-extrabold border-b-0 mt-1"
          : "border-b border-[#EEF1F4]"
      }`}
    >
      <span className="text-[#0F1419]">{label}</span>
      <strong className="font-mono tabular-nums text-[#0F1419]">{fmtCAD(amount)}</strong>
    </div>
  );
}
