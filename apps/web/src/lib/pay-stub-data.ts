/**
 * Pay-stub data shaping (Wave 3 B5).
 *
 * One pure shaping function feeds BOTH stub surfaces — the web stub
 * page and the PDF (lib/pdf/pay-stub.tsx) — so the earnings breakdown,
 * YTD rows and vacation-balance line can never drift between them.
 * No I/O: callers fetch the rows and pass plain values in.
 */

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
