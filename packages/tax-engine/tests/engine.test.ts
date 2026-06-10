import { describe, expect, it } from 'vitest';
import {
  TABLES_2026,
  TaxEngineError,
  ZERO_YTD,
  bracketFor,
  calcCpp,
  calcEi,
  calculatePay,
  dynamicBpa,
  getTables,
  healthPremium,
  maxCpp2Contribution,
  maxCppContribution,
} from '../src/index';
import type { PayInput } from '../src/index';

const CPP = TABLES_2026.cpp;
const EI = TABLES_2026.ei;
const FED = TABLES_2026.federal;
const ON = TABLES_2026.provinces.ON;

const base: PayInput = {
  payDate: '2026-06-15',
  province: 'ON',
  frequency: 'biweekly',
  grossPeriodIncome: 2_500,
};

describe('table registry', () => {
  it('resolves 2026 dates and rejects uncovered dates', () => {
    expect(getTables('2026-01-01').federal.year).toBe(2026);
    expect(getTables('2026-12-31').federal.year).toBe(2026);
    expect(() => getTables('2025-12-31')).toThrow(TaxEngineError);
    expect(() => getTables('2027-01-01')).toThrow(TaxEngineError);
    expect(() => getTables('June 2026')).toThrow(TaxEngineError);
  });
});

describe('CPP', () => {
  it('computes per-period contribution with exemption ($5,000 monthly)', () => {
    const r = calcCpp(5_000, 12, ZERO_YTD, CPP, false);
    // 0.0595 × (5,000 − 291.67) = 280.15
    expect(r.cpp).toBeCloseTo(280.15, 2);
    expect(r.cpp2).toBe(0);
  });

  it('derives 2026 maxima from table constants', () => {
    expect(maxCppContribution(CPP)).toBeCloseTo(4_248.3, 2);
    expect(maxCpp2Contribution(CPP)).toBeCloseTo(420.0, 2);
  });

  it('caps at remaining annual room', () => {
    const r = calcCpp(5_000, 12, { ...ZERO_YTD, cpp: 4_240 }, CPP, false);
    expect(r.cpp).toBeCloseTo(8.3, 2);
  });

  it('charges CPP2 on the slice of cumulative earnings crossing YMPE', () => {
    const r = calcCpp(
      3_000,
      12,
      { ...ZERO_YTD, pensionableEarnings: 74_000, cpp: 4_100 },
      CPP,
      false,
    );
    // (74,000 + 3,000) crosses YMPE 74,900 by 2,100 → 4% = 84.00
    expect(r.cpp2).toBeCloseTo(84.0, 2);
    expect(r.cpp).toBeCloseTo(148.3, 2); // remaining first-tier room: 4,248.30 − 4,100
  });

  it('respects exemption flag', () => {
    expect(calcCpp(5_000, 12, ZERO_YTD, CPP, true).cpp).toBe(0);
  });
});

describe('EI', () => {
  it('computes standard and Quebec premiums', () => {
    expect(calcEi(2_000, 'ON', ZERO_YTD, EI, false).ei).toBeCloseTo(32.6, 2);
    expect(calcEi(2_000, 'QC', ZERO_YTD, EI, false).ei).toBeCloseTo(26.0, 2);
  });

  it('caps on insurable earnings ceiling', () => {
    const r = calcEi(2_000, 'ON', { ...ZERO_YTD, insurableEarnings: 68_000, ei: 1_108.4 }, EI, false);
    // only 500 of insurable room remains → 1.63% × 500 = 8.15
    expect(r.ei).toBeCloseTo(8.15, 2);
  });
});

describe('income tax building blocks', () => {
  it('bracketFor computes cumulative K from thresholds', () => {
    const low = bracketFor(FED.brackets, 40_000);
    expect(low.rate).toBe(0.14);
    expect(low.k).toBe(0);
    const second = bracketFor(FED.brackets, 64_385.1);
    expect(second.rate).toBe(0.205);
    expect(second.k).toBeCloseTo(3_803.995, 2);
    expect(bracketFor(FED.brackets, 58_523).rate).toBe(0.14); // boundary stays in lower bracket
    expect(bracketFor(FED.brackets, 1_000_000).rate).toBe(0.33);
  });

  it('dynamicBpa phases out linearly', () => {
    expect(dynamicBpa(FED.bpa, 100_000)).toBe(16_452);
    expect(dynamicBpa(FED.bpa, 300_000)).toBe(14_829);
    expect(dynamicBpa(FED.bpa, 219_961)).toBeCloseTo(15_640.5, 1); // midpoint
  });

  it('Ontario health premium bands', () => {
    const bands = ON.healthPremiumBands!;
    expect(healthPremium(bands, 18_000)).toBe(0);
    expect(healthPremium(bands, 20_000)).toBe(0);
    expect(healthPremium(bands, 22_000)).toBeCloseTo(120, 2);
    expect(healthPremium(bands, 30_000)).toBeCloseTo(300, 2);
    expect(healthPremium(bands, 64_385.1)).toBeCloseTo(600, 2);
    expect(healthPremium(bands, 300_000)).toBeCloseTo(900, 2);
  });
});

describe('calculatePay — ON biweekly $2,500 golden case (hand-computed per T4127)', () => {
  const r = calculatePay(base);

  it('statutory deductions', () => {
    expect(r.cpp).toBeCloseTo(140.74, 2);
    expect(r.cpp2).toBe(0);
    expect(r.ei).toBeCloseTo(40.75, 2);
    // Annualized A = 26 × (2,500 − F5 23.65) = 64,385.10
    expect(r.annualTaxableIncome).toBeCloseTo(64_385.1, 1);
    expect(Math.abs(r.federalTax - 242.58)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(r.provincialTax - 131.37)).toBeLessThanOrEqual(0.02);
  });

  it('net pay invariant and employer costs', () => {
    expect(r.netPay + r.totalDeductions).toBeCloseTo(r.gross, 2);
    expect(r.employer.ei).toBeCloseTo(57.05, 2); // 1.4 × 40.75
    expect(r.employer.cpp).toBeCloseTo(r.cpp, 2);
    expect(r.employer.total).toBeCloseTo(r.employer.cpp + r.employer.cpp2 + r.employer.ei, 2);
  });

  it('rolls the YTD ledger forward', () => {
    expect(r.newYtd.pensionableEarnings).toBeCloseTo(2_500, 2);
    expect(r.newYtd.cpp).toBeCloseTo(r.cpp, 2);
    expect(r.newYtd.insurableEarnings).toBeCloseTo(2_500, 2);
  });

  it('flags unverified tables', () => {
    expect(r.warnings.some((w) => w.includes('UNVERIFIED'))).toBe(true);
  });
});

describe('calculatePay — edges', () => {
  it('zero gross → zero everything', () => {
    const r = calculatePay({ ...base, grossPeriodIncome: 0 });
    expect(r.netPay).toBe(0);
    expect(r.totalDeductions).toBe(0);
  });

  it('high earner ON (monthly $20,000): surtax + BPA phase-out engage', () => {
    const r = calculatePay({ ...base, frequency: 'monthly', grossPeriodIncome: 20_000 });
    expect(r.annualTaxableIncome).toBeGreaterThan(230_000);
    expect(r.federalTax).toBeGreaterThan(4_000); // ≈4,186 hand-estimated
    expect(r.provincialTax).toBeGreaterThan(2_000); // ≈2,653 incl. surtax + premium
    expect(r.provincialTax).toBeLessThan(3_200);
  });

  it('all non-QC jurisdictions produce sane results at $65k', () => {
    const provinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'SK', 'YT'] as const;
    for (const p of provinces) {
      const r = calculatePay({ ...base, province: p });
      expect(r.netPay).toBeGreaterThan(1_600);
      expect(r.netPay).toBeLessThan(2_300);
      expect(r.provincialTax).toBeGreaterThan(0);
    }
  });

  it('Quebec income tax refuses until Phase 2', () => {
    expect(() => calculatePay({ ...base, province: 'QC' })).toThrow(/not implemented/i);
  });

  it('rejects negative gross', () => {
    expect(() => calculatePay({ ...base, grossPeriodIncome: -1 })).toThrow(TaxEngineError);
  });
});
