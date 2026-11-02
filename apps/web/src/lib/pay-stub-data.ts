/**
 * Pay-stub data shaping (Wave 3 B5).
 *
 * One pure shaping function feeds BOTH stub surfaces — the web stub
 * page and the PDF (lib/pdf/pay-stub.tsx) — so the earnings breakdown,
 * YTD rows and vacation-balance line can never drift between them.
 * No I/O: callers fetch the rows and pass plain values in.
 */

import { employerQpipAmount } from "@/lib/payroll-display";

export interface StubItemShape {
  gross: number;
  regularPay: number;
  overtimePay: number;
  statPay: number;
  vacationPay: number;
  bonus: number;
  hours: number;
  overtimeHours: number;
  statHours: number;
  vacationBalanceAfterCents: number | null;
  /** Wave 3 B6 — named custom deductions persisted on the item. */
  customDeductions?: unknown;
  /** Wave 3 B6 — non-taxable reimbursement added to net pay. */
  reimbursement?: number;
  /** Wave 3 B6 — taxable benefits included in deduction bases, not in gross. */
  taxableBenefits?: number;
  /** Wave 4 (W4-D3) — statutory amounts on the item, for the split
   * deduction/employer line builders below. When `isQuebec` is set the
   * builders label cpp/cpp2 as QPP/QPP2 and surface QPIP separately
   * instead of folding it into EI. */
  cpp?: number;
  cpp2?: number;
  ei?: number;
  /** Employee QPIP (Quebec items); employer QPIP is derived. */
  qpip?: number;
  federalTax?: number;
  provincialTax?: number;
  employerCpp?: number;
  employerCpp2?: number;
  /** Engine employer EI — for Quebec items this FOLDS employer QPIP in;
   * the builders split it back out (lib/payroll-display.ts). */
  employerEi?: number;
  /** Resolved province of employment for this item (QC → Quebec labels). */
  isQuebec?: boolean;
}

export interface StubEarningsLine {
  label: string;
  /** e.g. "75 hrs × $40.00" — present only when hours and a rate are known. */
  detail: string | null;
  amount: number;
}

export interface NamedDeductionLine {
  name: string;
  amount: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Parse the persisted customDeductions JSON into display lines. */
export function parseCustomDeductions(raw: unknown): NamedDeductionLine[] {
  if (!Array.isArray(raw)) return [];
  const out: NamedDeductionLine[] = [];
  for (const entry of raw) {
    if (entry && typeof entry === "object") {
      const rec = entry as Record<string, unknown>;
      const name = typeof rec.name === "string" ? rec.name : "";
      const amount = typeof rec.amount === "number" ? rec.amount : 0;
      if (name && amount !== 0) out.push({ name, amount });
    }
  }
  return out;
}

/**
 * Itemized earnings lines for a stub. Only non-zero components render.
 * Regular is the residual component of gross, so when a split was never
 * recorded (pre-B5 runs: every split field 0) the single "Regular pay"
 * line falls back to the full gross — old stubs keep reading correctly.
 * Hours × rate detail appears only where the hours are stored.
 */
export function buildEarningsLines(item: StubItemShape): StubEarningsLine[] {
  const lines: StubEarningsLine[] = [];
  const hasSplit =
    item.regularPay !== 0 || item.overtimePay !== 0 || item.statPay !== 0;

  const regularPay = hasSplit ? item.regularPay : item.gross - item.vacationPay - item.bonus;
  const regularHours = Math.max(0, item.hours - item.overtimeHours - item.statHours);
  if (regularPay !== 0) {
    lines.push({
      label: "Regular pay",
      detail:
        regularHours > 0
          ? `${regularHours} hrs × $${round2(regularPay / regularHours).toFixed(2)}`
          : null,
      amount: round2(regularPay),
    });
  }
  if (item.overtimePay !== 0) {
    lines.push({
      label: "Overtime pay",
      detail:
        item.overtimeHours > 0
          ? `${item.overtimeHours} hrs × $${round2(item.overtimePay / item.overtimeHours).toFixed(2)}`
          : null,
      amount: round2(item.overtimePay),
    });
  }
  if (item.statPay !== 0) {
    lines.push({
      label: "Stat holiday pay",
      detail:
        item.statHours > 0
          ? `${item.statHours} hrs × $${round2(item.statPay / item.statHours).toFixed(2)}`
          : null,
      amount: round2(item.statPay),
    });
  }
  if (item.vacationPay !== 0) {
    lines.push({ label: "Vacation pay", detail: null, amount: round2(item.vacationPay) });
  }
  if (item.bonus !== 0) {
    lines.push({ label: "Bonus", detail: null, amount: round2(item.bonus) });
  }
  if ((item.taxableBenefits ?? 0) !== 0) {
    lines.push({
      label: "Taxable benefits (non-cash)",
      detail: "Included in CPP/EI/tax bases, not in gross pay",
      amount: round2(item.taxableBenefits ?? 0),
    });
  }
  // Gross is always positive on a persisted item and the cash components
  // sum to it, so at least one line renders; this guards only the
  // degenerate all-zero shape.
  if (lines.length === 0) {
    lines.push({ label: "Regular pay", detail: null, amount: round2(item.gross) });
  }
  return lines;
}

/** Vacation balance line for the stub, or null when no snapshot exists. */
export function vacationBalanceLine(item: StubItemShape): string | null {
  if (item.vacationBalanceAfterCents == null) return null;
  return `$${(item.vacationBalanceAfterCents / 100).toFixed(2)}`;
}

export interface StubDeductionLine {
  label: string;
  amount: number;
}

/**
 * Statutory deduction lines for a stub (Wave 4, W4-D3). Quebec items
 * show QPP / QPP2 / EI / QPIP as SEPARATE lines — Sophie's payslip
 * previously labelled her QPP "CPP" and folded her $20.64 QPIP into
 * the EI line. Federal/provincial tax lines follow; the caller passes
 * the province label to use ("Quebec Tax" for QC items).
 */
export function buildDeductionLines(item: StubItemShape, provincialTaxLabel: string): StubDeductionLine[] {
  const pension = item.isQuebec ? "QPP" : "CPP";
  const lines: StubDeductionLine[] = [
    { label: pension, amount: round2(item.cpp ?? 0) },
    { label: `${pension}2`, amount: round2(item.cpp2 ?? 0) },
    { label: "EI", amount: round2(item.ei ?? 0) },
  ];
  if (item.isQuebec) lines.push({ label: "QPIP", amount: round2(item.qpip ?? 0) });
  lines.push(
    { label: "Federal Tax", amount: round2(item.federalTax ?? 0) },
    { label: provincialTaxLabel, amount: round2(item.provincialTax ?? 0) },
  );
  return lines;
}

/**
 * Employer-contribution lines for a stub (Wave 4, W4-D3). The stored
 * employer EI for a Quebec item folds employer QPIP in (Sophie's "EI
 * (1.4×)" line read $116.26 when her true employer EI was $87.36 and
 * employer QPIP $28.90) — the split is derived in payroll-display.ts.
 */
export function buildEmployerLines(item: StubItemShape): StubDeductionLine[] {
  const pension = item.isQuebec ? "QPP" : "CPP";
  const employerEi = item.employerEi ?? 0;
  const qpipEr = item.isQuebec
    ? employerQpipAmount({ ei: item.ei ?? 0, qpip: item.qpip, employerEi })
    : 0;
  const lines: StubDeductionLine[] = [
    { label: `${pension} Match`, amount: round2(item.employerCpp ?? 0) },
    { label: `${pension}2 Match`, amount: round2(item.employerCpp2 ?? 0) },
    { label: "EI (1.4×)", amount: round2(employerEi - qpipEr) },
  ];
  if (item.isQuebec) lines.push({ label: "QPIP (employer)", amount: qpipEr });
  return lines;
}
