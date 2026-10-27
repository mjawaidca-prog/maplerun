/**
 * Journal payload builder for the Nexvar Pay → LedgerPro sync (M3).
 *
 * Pure functions — no I/O, no Prisma — so the mapping can be unit-tested
 * against fixture PayRuns. Follows the scoping doc §2 tables:
 *
 * Mode 1 (template accounts only):
 *   Dr 6920  totalGross + totalEmployerCost
 *   Cr 2400  remittance (ee+er CPP/CPP2/EI + fed + prov tax)
 *   Cr 2400  totalNetPay
 *
 * Mode 2 (granular, mirrors MapleRun's display-only GL Journal page):
 *   Dr wages expense            totalGross
 *   Dr employer CPP expense     totalEmployerCpp
 *   Dr employer CPP2 expense    totalEmployerCpp2
 *   Dr employer EI expense      totalEmployerEi
 *   Cr CPP payable              totalCpp + totalEmployerCpp
 *   Cr CPP2 payable             totalCpp2 + totalEmployerCpp2
 *   Cr EI payable               totalEi + totalEmployerEi
 *   Cr income tax payable       totalFederalTax + totalProvincialTax
 *   Cr wages payable            totalNetPay
 *
 * ⚠️ totalEmployerCost is employer contributions ONLY — total employer
 * cash cost is totalGross + totalEmployerCost.
 *
 * Quebec note: QPP reuses the cpp/cpp2 fields and QPIP is folded into the
 * EI fields by the tax engine, so QC runs use the same lines; the balance
 * identity (gross + employer cost = net + remittance) still holds because
 * the folded amounts stay inside the same totals.
 */

import type { CreateJournalPayload, JournalLine } from "./ledgerpro";

// ─── Mapping ──────────────────────────────────────────────────────────────────

export type MappingMode = "MODE1" | "MODE2";

export interface LedgerProMapping {
  // Mode 1
  mode1Expense: string;
  mode1RemittancePayable: string;
  mode1NetPayPayable: string;
  // Mode 2
  wagesExpense: string;
  employerCppExpense: string;
  employerCpp2Expense: string;
  employerEiExpense: string;
  cppPayable: string;
  cpp2Payable: string;
  eiPayable: string;
  incomeTaxPayable: string;
  wagesPayable: string;
}

export const DEFAULT_MAPPING: LedgerProMapping = {
  mode1Expense: "6920",
  mode1RemittancePayable: "2400",
  mode1NetPayPayable: "2400",
  wagesExpense: "6920",
  // LedgerPro's template adds a single 6940 Employer Payroll Taxes Expense
  // (6940, not 6930 — 6930 is already Repairs & Maintenance in LedgerPro);
  // each line may be pointed at a distinct code if the company has one.
  employerCppExpense: "6940",
  employerCpp2Expense: "6940",
  employerEiExpense: "6940",
  cppPayable: "2410",
  // The LedgerPro template (L1) adds one CPP payable (2410); CPP2 folds
  // into it by default and can be split out if the company has a code.
  cpp2Payable: "2410",
  eiPayable: "2420",
  incomeTaxPayable: "2430",
  wagesPayable: "2440",
};

/** Fill any missing/invalid codes in a stored mapping JSON with defaults. */
export function normalizeMapping(raw: unknown): LedgerProMapping {
  const out = { ...DEFAULT_MAPPING };
  if (raw && typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    for (const key of Object.keys(out) as (keyof LedgerProMapping)[]) {
      const v = rec[key];
      if (typeof v === "string" && v.trim().length > 0) out[key] = v.trim();
    }
  }
  return out;
}

/** Account codes a mode actually uses — the pre-flight set. */
export function mappedCodes(mode: MappingMode, mapping: LedgerProMapping): string[] {
  const codes =
    mode === "MODE1"
      ? [mapping.mode1Expense, mapping.mode1RemittancePayable, mapping.mode1NetPayPayable]
      : [
          mapping.wagesExpense,
          mapping.employerCppExpense,
          mapping.employerCpp2Expense,
          mapping.employerEiExpense,
          mapping.cppPayable,
          mapping.cpp2Payable,
          mapping.eiPayable,
          mapping.incomeTaxPayable,
          mapping.wagesPayable,
        ];
  return [...new Set(codes)];
}

// ─── Totals ───────────────────────────────────────────────────────────────────

/** The PayRun fields the journal is built from (structural — matches the Prisma row). */
export interface PayRunTotals {
  id: string;
  payDate: string;
  actualPayDate?: string | null;
  itemCount: number;
  totalGross: number;
  totalCpp: number;
  totalCpp2: number;
  totalEi: number;
  totalFederalTax: number;
  totalProvincialTax: number;
  totalNetPay: number;
  totalEmployerCpp: number;
  totalEmployerCpp2: number;
  totalEmployerEi: number;
  totalEmployerCost: number;
}

// ─── Building ─────────────────────────────────────────────────────────────────

/** Round to cents using integer-cent arithmetic downstream. */
export function roundCent(n: number): number {
  return Math.round(n * 100) / 100;
}

function toCents(n: number): number {
  return Math.round(n * 100);
}

export class UnbalancedJournalError extends Error {
  constructor(
    readonly debitCents: number,
    readonly creditCents: number,
  ) {
    super(
      `Internal rounding mismatch — journal does not balance (debits $${(debitCents / 100).toFixed(2)} ≠ credits $${(creditCents / 100).toFixed(2)}). Do not retry, flag it.`,
    );
    this.name = "UnbalancedJournalError";
  }
}

function line(code: string, debit: number, credit: number, description: string): JournalLine | null {
  const d = roundCent(debit);
  const c = roundCent(credit);
  if (d === 0 && c === 0) return null; // omit zero lines
  return { glAccountCode: code, description, debit: d, credit: c };
}

export function buildJournalLines(
  run: PayRunTotals,
  mode: MappingMode,
  mapping: LedgerProMapping,
): JournalLine[] {
  const raw: (JournalLine | null)[] =
    mode === "MODE1"
      ? [
          line(mapping.mode1Expense, run.totalGross + run.totalEmployerCost, 0, "Payroll expense (gross + employer contributions)"),
          line(
            mapping.mode1RemittancePayable,
            0,
            run.totalCpp + run.totalCpp2 + run.totalEi +
              run.totalEmployerCpp + run.totalEmployerCpp2 + run.totalEmployerEi +
              run.totalFederalTax + run.totalProvincialTax,
            "Source deductions payable (CPP/EI/tax remittance)",
          ),
          line(mapping.mode1NetPayPayable, 0, run.totalNetPay, "Net pay payable"),
        ]
      : [
          line(mapping.wagesExpense, run.totalGross, 0, "Wages & salaries"),
          line(mapping.employerCppExpense, run.totalEmployerCpp, 0, "Employer CPP"),
          line(mapping.employerCpp2Expense, run.totalEmployerCpp2, 0, "Employer CPP2"),
          line(mapping.employerEiExpense, run.totalEmployerEi, 0, "Employer EI"),
          line(mapping.cppPayable, 0, run.totalCpp + run.totalEmployerCpp, "CPP payable"),
          line(mapping.cpp2Payable, 0, run.totalCpp2 + run.totalEmployerCpp2, "CPP2 payable"),
          line(mapping.eiPayable, 0, run.totalEi + run.totalEmployerEi, "EI payable"),
          line(mapping.incomeTaxPayable, 0, run.totalFederalTax + run.totalProvincialTax, "Income tax payable"),
          line(mapping.wagesPayable, 0, run.totalNetPay, "Net pay payable"),
        ];
  // Lines are returned exactly per the §2 tables — separate lines may
  // legitimately share a code (Mode 1 posts two credits to 2400; the
  // Mode 2 defaults point all employer-expense lines at the single
  // template account 6940 until a company configures distinct codes).
  return raw.filter((l): l is JournalLine => l !== null);
}

/**
 * Build the full LedgerPro create-journal payload for a FINALIZED run.
 * Asserts the journal balances from the ROUNDED lines (integer cents)
 * before anything is POSTed; throws UnbalancedJournalError otherwise.
 */
export function buildJournalPayload(
  run: PayRunTotals,
  payGroupName: string,
  mode: MappingMode,
  mapping: LedgerProMapping,
): CreateJournalPayload {
  const lines = buildJournalLines(run, mode, mapping);

  const debitCents = lines.reduce((s, l) => s + toCents(l.debit), 0);
  const creditCents = lines.reduce((s, l) => s + toCents(l.credit), 0);
  if (debitCents !== creditCents) {
    throw new UnbalancedJournalError(debitCents, creditCents);
  }

  const shortId = run.id.slice(0, 8);
  const description =
    `Payroll — Nexvar Pay · ${payGroupName} · period end ${run.payDate} · ${run.itemCount} employees · run ${shortId}`.slice(0, 500);

  return {
    entryDate: run.actualPayDate ?? run.payDate,
    description,
    lines,
  };
}

export function idempotencyKeyForRun(payRunId: string): string {
  return `nexvarpay-payrun-${payRunId}`;
}

export function voidIdempotencyKeyForRun(payRunId: string): string {
  return `nexvarpay-payrun-${payRunId}-void`;
}
