/**
 * Wave 3 B6 — engine additions:
 *  - PayInput.taxableBenefits: CPP/EI/tax computed on (gross + benefits),
 *    cash gross and net-pay definition unchanged; PayResult surfaces it.
 *  - PayInput.periodDeductions as NamedDeduction[]: per-flag base
 *    reductions; the legacy bare number keeps its factor-F meaning.
 *  - PayInput.extraTaxPerPeriod (TD1 line 2): added to federal tax.
 * All defaults are 0/absent, so every pre-B6 call — including the PDOC
 * pins — computes exactly what it computed before.
 */
import { describe, it, expect } from 'vitest';
import {
  calculatePay,
  calculateBonus,
  resolveDeductions,
  TaxEngineError,
  type PayInput,
} from '../src/index';

const base: PayInput = {
  payDate: '2026-03-13',
  province: 'ON',
  frequency: 'biweekly',
  grossPeriodIncome: 3000,
};

describe('taxableBenefits (B6)', () => {
  it('computes CPP/EI/tax on gross + benefits while cash gross is unchanged', () => {
    const plain = calculatePay(base);
    const withBenefits = calculatePay({ ...base, taxableBenefits: 200 });

    expect(withBenefits.gross).toBe(3000);
    expect(withBenefits.taxableBenefits).toBe(200);
    expect(plain.taxableBenefits).toBe(0);
    // CPP: 5.95% on the extra $200 of pensionable earnings (below caps).
    expect(withBenefits.cpp - plain.cpp).toBeCloseTo(0.0595 * 200, 2);
    // EI: 1.63% on the extra $200 of insurable earnings.
    expect(withBenefits.ei - plain.ei).toBeCloseTo(0.0163 * 200, 2);
    // Tax rises because annualized taxable income includes the benefit.
    expect(withBenefits.federalTax).toBeGreaterThan(plain.federalTax);
    expect(withBenefits.provincialTax).toBeGreaterThan(plain.provincialTax);
    // Net pay is still cash gross minus deductions — the non-cash
    // benefit is never paid out.
    expect(withBenefits.netPay).toBeCloseTo(3000 - withBenefits.totalDeductions, 2);
    // YTD pensionable/insurable track the bases (they feed T4 boxes 26/24).
    expect(withBenefits.newYtd.pensionableEarnings - plain.newYtd.pensionableEarnings).toBeCloseTo(200, 2);
    expect(withBenefits.newYtd.insurableEarnings - plain.newYtd.insurableEarnings).toBeCloseTo(200, 2);
  });

  it('respects the CPP cap when benefits push earnings past the YMPE', () => {
    const ytd = { pensionableEarnings: 74_000, cpp: 4000, cpp2: 0, insurableEarnings: 60_000, ei: 900 };
    const r = calculatePay({ ...base, grossPeriodIncome: 5000, taxableBenefits: 5000, ytd });
    // Only $600 of room to the $74,600 YMPE → CPP on at most that slice
    // (plus nothing beyond); far below the uncapped 5.95% × 10,000.
    expect(r.cpp).toBeLessThan(0.0595 * 10_000);
    expect(r.newYtd.pensionableEarnings).toBeGreaterThan(74_000);
  });

  it('rejects negative benefits', () => {
    expect(() => calculatePay({ ...base, taxableBenefits: -1 })).toThrow(TaxEngineError);
  });
});

describe('named periodDeductions (B6)', () => {
  it('reducesTaxable lowers tax only — CPP/EI untouched', () => {
    const plain = calculatePay(base);
    const withDed = calculatePay({
      ...base,
      periodDeductions: [{ name: 'RRSP', amount: 300, reducesPensionable: false, reducesInsurable: false, reducesTaxable: true }],
    });
    expect(withDed.cpp).toBe(plain.cpp);
    expect(withDed.ei).toBe(plain.ei);
    expect(withDed.federalTax).toBeLessThan(plain.federalTax);
    // The deduction amount itself is NOT in totalDeductions — the
    // caller withholds it from net pay.
    expect(withDed.totalDeductions).toBeLessThan(plain.totalDeductions);
    expect(withDed.totalDeductions).toBeCloseTo(
      withDed.cpp + withDed.cpp2 + withDed.ei + withDed.federalTax + withDed.provincialTax,
      2,
    );
  });

  it('reducesPensionable lowers CPP only; reducesInsurable lowers EI only', () => {
    const plain = calculatePay(base);
    const pensionable = calculatePay({
      ...base,
      periodDeductions: [{ name: 'X', amount: 500, reducesPensionable: true, reducesInsurable: false, reducesTaxable: false }],
    });
    expect(pensionable.cpp).toBeLessThan(plain.cpp);
    expect(pensionable.ei).toBe(plain.ei);
    // Federal tax is NOT identical: lower CPP shrinks the F5 deduction
    // and K2 credit bases, which moves tax slightly (correct T4127
    // mechanics) — but only by that knock-on, never by the full $500.
    expect(Math.abs(pensionable.federalTax - plain.federalTax)).toBeLessThan(10);

    const insurable = calculatePay({
      ...base,
      periodDeductions: [{ name: 'X', amount: 500, reducesPensionable: false, reducesInsurable: true, reducesTaxable: false }],
    });
    expect(insurable.ei).toBeLessThan(plain.ei);
    expect(insurable.cpp).toBe(plain.cpp);
  });

  it('legacy bare number is identical to a reducesTaxable-only named list', () => {
    const legacy = calculatePay({ ...base, periodDeductions: 300 });
    const named = calculatePay({
      ...base,
      periodDeductions: [{ name: 'F', amount: 300, reducesPensionable: false, reducesInsurable: false, reducesTaxable: true }],
    });
    expect(named).toEqual(legacy);
  });

  it('resolveDeductions sums per flag and rejects negatives', () => {
    expect(
      resolveDeductions([
        { name: 'A', amount: 100, reducesPensionable: true, reducesInsurable: false, reducesTaxable: true },
        { name: 'B', amount: 50, reducesPensionable: false, reducesInsurable: true, reducesTaxable: false },
      ]),
    ).toEqual({ total: 150, taxable: 100, pensionable: 100, insurable: 50 });
    expect(resolveDeductions(200)).toEqual({ total: 200, taxable: 200, pensionable: 0, insurable: 0 });
    expect(resolveDeductions(undefined)).toEqual({ total: 0, taxable: 0, pensionable: 0, insurable: 0 });
    expect(() =>
      resolveDeductions([{ name: 'Bad', amount: -5, reducesPensionable: false, reducesInsurable: false, reducesTaxable: true }]),
    ).toThrow(TaxEngineError);
  });
});

describe('extraTaxPerPeriod (B6 — TD1 line 2)', () => {
  it('adds exactly the extra tax to federal tax, total deductions and net pay', () => {
    const plain = calculatePay(base);
    const withExtra = calculatePay({ ...base, extraTaxPerPeriod: 50 });
    expect(withExtra.federalTax - plain.federalTax).toBeCloseTo(50, 2);
    expect(withExtra.totalDeductions - plain.totalDeductions).toBeCloseTo(50, 2);
    expect(plain.netPay - withExtra.netPay).toBeCloseTo(50, 2);
    expect(withExtra.cpp).toBe(plain.cpp);
    expect(withExtra.ei).toBe(plain.ei);
    expect(() => calculatePay({ ...base, extraTaxPerPeriod: -1 })).toThrow(TaxEngineError);
  });
});

describe('calculateBonus with B6 inputs (B6)', () => {
  it('accepts benefits + named deductions on the regular baseline without throwing', () => {
    const r = calculateBonus({
      ...base,
      bonusAmount: 5000,
      taxableBenefits: 200,
      periodDeductions: [{ name: 'RRSP', amount: 100, reducesPensionable: false, reducesInsurable: false, reducesTaxable: true }],
    });
    expect(r.bonus).toBe(5000);
    expect(r.totalDeductions).toBeGreaterThan(0);
    expect(r.netBonus).toBeCloseTo(5000 - r.totalDeductions, 2);
  });
});
