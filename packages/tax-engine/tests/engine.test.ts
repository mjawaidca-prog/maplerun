import { describe, expect, it } from 'vitest';
import {
  TABLES_2026,
  TaxEngineError,
  ZERO_YTD,
  bracketFor,
  calcCpp,
  calcEi,
  calculateBonus,
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

const near = (actual: number, expected: number, tol = 0.02) =>
  expect(Math.abs(actual - expected), `expected ≈${expected}, got ${actual}`).toBeLessThanOrEqual(tol);

describe('table registry', () => {
  it('resolves 2026 dates and rejects uncovered dates', () => {
    expect(getTables('2026-01-01').federal.year).toBe(2026);
    expect(getTables('2026-12-31').federal.year).toBe(2026);
    expect(() => getTables('2025-12-31')).toThrow(TaxEngineError);
    expect(() => getTables('2027-01-01')).toThrow(TaxEngineError);
    expect(() => getTables('June 2026')).toThrow(TaxEngineError);
  });

  it('2026 tables are fully verified (all provinces including QC)', () => {
    expect(FED.meta.verified).toBe(true);
    expect(CPP.meta.verified).toBe(true);
    expect(EI.meta.verified).toBe(true);
    for (const [code, table] of Object.entries(TABLES_2026.provinces)) {
      expect(table.meta.verified, `${code} should be verified`).toBe(true);
    }
  });
});

describe('CPP (2026: YMPE 74,600 / YAMPE 85,000)', () => {
  it('computes per-period contribution with exemption ($5,000 monthly)', () => {
    const r = calcCpp(5_000, 12, ZERO_YTD, CPP, false);
    near(r.cpp, 280.15); // 0.0595 × (5,000 − 291.67)
    expect(r.cpp2).toBe(0);
  });

  it('derives CRA maxima exactly from table constants', () => {
    near(maxCppContribution(CPP), 4_230.45, 0.001);
    near(maxCpp2Contribution(CPP), 416.0, 0.001);
  });

  it('caps at remaining annual room', () => {
    const r = calcCpp(5_000, 12, { ...ZERO_YTD, cpp: 4_220 }, CPP, false);
    near(r.cpp, 10.45);
  });

  it('charges CPP2 on the slice of cumulative earnings crossing YMPE', () => {
    const r = calcCpp(3_000, 12, { ...ZERO_YTD, pensionableEarnings: 74_000, cpp: 4_100 }, CPP, false);
    near(r.cpp2, 96.0); // (77,000 − 74,600) × 4%
    near(r.cpp, 130.45); // remaining first-tier room: 4,230.45 − 4,100
  });

  it('respects exemption flag', () => {
    expect(calcCpp(5_000, 12, ZERO_YTD, CPP, true).cpp).toBe(0);
  });
});

describe('EI (2026: MIE 68,900)', () => {
  it('computes standard and Quebec premiums', () => {
    near(calcEi(2_000, 'ON', ZERO_YTD, EI, false).ei, 32.6);
    near(calcEi(2_000, 'QC', ZERO_YTD, EI, false).ei, 26.0);
  });

  it('caps on insurable earnings ceiling', () => {
    const r = calcEi(2_000, 'ON', { ...ZERO_YTD, insurableEarnings: 68_000, ei: 1_108.4 }, EI, false);
    near(r.ei, 14.67); // 1.63% × remaining 900 of insurable room
  });
});

describe('income tax building blocks', () => {
  it('bracketFor reproduces CRA-published K constants from thresholds', () => {
    expect(bracketFor(FED.brackets, 40_000)).toEqual({ rate: 0.14, k: 0 });
    const second = bracketFor(FED.brackets, 64_385.1);
    expect(second.rate).toBe(0.205);
    near(second.k, 3_804, 0.5); // CRA publishes 3,804
    near(bracketFor(FED.brackets, 200_000).k, 15_685, 0.5);
    near(bracketFor(FED.brackets, 1_000_000).k, 26_024, 0.5);
    near(bracketFor(ON.brackets, 300_000).k, 8_076, 0.5);
  });

  it('dynamicBpa implements the BPAF formula', () => {
    expect(dynamicBpa(FED.bpa, 100_000)).toBe(16_452);
    expect(dynamicBpa(FED.bpa, 300_000)).toBe(14_829);
    near(dynamicBpa(FED.bpa, 219_961), 15_640.5, 0.05); // midpoint of phase-out
  });

  it('Ontario health premium bands (V2)', () => {
    const bands = ON.healthPremiumBands!;
    expect(healthPremium(bands, 18_000)).toBe(0);
    expect(healthPremium(bands, 20_000)).toBe(0);
    near(healthPremium(bands, 22_000), 120);
    near(healthPremium(bands, 30_000), 300);
    near(healthPremium(bands, 64_385.1), 600);
    near(healthPremium(bands, 300_000), 900);
  });
});

describe('calculatePay — ON biweekly $2,500 golden case (hand-computed per T4127 121st ed.)', () => {
  const r = calculatePay(base);

  it('statutory deductions', () => {
    near(r.cpp, 140.74);
    expect(r.cpp2).toBe(0);
    near(r.ei, 40.75);
    near(r.annualTaxableIncome, 64_385.1, 0.1); // A = 26 × (2,500 − F5 23.65)
    near(r.federalTax, 242.58);
    near(r.provincialTax, 131.48); // incl. $600 health premium, no surtax, no reduction
  });

  it('net pay invariant and employer costs', () => {
    near(r.netPay, 1_944.45);
    near(r.netPay + r.totalDeductions, r.gross, 0.011);
    near(r.employer.ei, 57.05); // 1.4 × 40.75
    near(r.employer.cpp, r.cpp, 0.001);
  });

  it('rolls the YTD ledger forward and emits no warnings on verified tables', () => {
    near(r.newYtd.pensionableEarnings, 2_500, 0.001);
    near(r.newYtd.cpp, r.cpp, 0.001);
    expect(r.warnings).toEqual([]);
  });
});

describe('province-specific factors (verified formulas)', () => {
  it('Yukon K4P (territorial CEA credit): biweekly $2,500 → ≈110.05', () => {
    const r = calculatePay({ ...base, province: 'YT' });
    near(r.provincialTax, 110.05, 0.05);
  });

  it('Alberta K5P tops up credits beyond the 8% bracket (monthly $10,000, TD1AB claim $70,000)', () => {
    const r = calculatePay({
      ...base,
      province: 'AB',
      frequency: 'monthly',
      grossPeriodIncome: 10_000,
      provincialClaim: 70_000,
    });
    near(r.provincialTax, 368.27, 0.05);
  });

  it('BC low-income reduction (factor S): biweekly $1,200 → ≈16.02', () => {
    const r = calculatePay({ ...base, province: 'BC', grossPeriodIncome: 1_200 });
    near(r.provincialTax, 16.02, 0.05);
  });

  it('Ontario tax reduction (factor S) + health premium at low income: biweekly $900 → ≈18.67', () => {
    const r = calculatePay({ ...base, grossPeriodIncome: 900 });
    near(r.provincialTax, 18.67, 0.05);
  });

  it('Manitoba BPA phases out above $200k income', () => {
    const low = calculatePay({ ...base, province: 'MB' });
    expect(low.provincialTax).toBeGreaterThan(0);
    const high = calculatePay({ ...base, province: 'MB', frequency: 'monthly', grossPeriodIncome: 26_000 });
    // At ~A $308k the BPAMB ≈ 7,260 instead of 15,780 — tax well above the naive max-BPA figure.
    expect(high.provincialTax).toBeGreaterThan(3_900);
  });
});

describe('calculateBonus — T4127 bonus method', () => {
  it('ON biweekly $2,500 regular + $5,000 bonus (hand-computed)', () => {
    const r = calculateBonus({ ...base, bonusAmount: 5_000 });
    near(r.bonusCpp, 297.5); // 5.95% with no period exemption
    expect(r.bonusCpp2).toBe(0);
    near(r.bonusEi, 81.5);
    near(r.bonusFederalTax, 1_014.75); // 20.5% × (5,000 − F5 50.00)
    near(r.bonusProvincialTax, 452.93); // 9.15% × 4,950, no surtax/premium change
    near(r.netBonus, 5_000 - r.totalDeductions, 0.011);
  });

  it('standalone bonus with no regular pay this period', () => {
    const r = calculateBonus({ ...base, grossPeriodIncome: 0, bonusAmount: 1_000 });
    near(r.bonusCpp, 59.5);
    near(r.bonusEi, 16.3);
    expect(r.bonusFederalTax).toBe(0); // annualized income far below BPA
    expect(r.bonusProvincialTax).toBe(0);
    near(r.netBonus, 924.2);
  });

  it('bonus CPP respects the annual cap', () => {
    const r = calculateBonus({
      ...base,
      bonusAmount: 10_000,
      ytd: { ...ZERO_YTD, pensionableEarnings: 70_000, cpp: 4_200 },
    });
    // Regular pay consumes part of the remaining room first.
    expect(r.bonusCpp + 4_200).toBeLessThanOrEqual(4_230.46);
    expect(r.bonusCpp2).toBeGreaterThan(0); // 70,000 + 2,500 + 10,000 crosses YMPE 74,600
  });

  it('rejects non-positive bonus', () => {
    expect(() => calculateBonus({ ...base, bonusAmount: 0 })).toThrow(TaxEngineError);
  });
});

describe('calculatePay — edges', () => {
  it('zero gross → zero everything', () => {
    const r = calculatePay({ ...base, grossPeriodIncome: 0 });
    expect(r.netPay).toBe(0);
    expect(r.totalDeductions).toBe(0);
  });

  it('high earner ON (monthly $20,000): surtax + BPAF phase-out engage', () => {
    const r = calculatePay({ ...base, frequency: 'monthly', grossPeriodIncome: 20_000 });
    expect(r.annualTaxableIncome).toBeGreaterThan(230_000);
    near(r.federalTax, 4_185.99, 0.5);
    near(r.provincialTax, 2_654.48, 0.5); // incl. surtax 8,647/yr + premium 900
  });

  it('all non-QC jurisdictions produce sane results at $65k', () => {
    const provinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'SK', 'YT'] as const;
    for (const p of provinces) {
      const r = calculatePay({ ...base, province: p });
      expect(r.netPay, `${p} net`).toBeGreaterThan(1_600);
      expect(r.netPay, `${p} net`).toBeLessThan(2_300);
      expect(r.provincialTax, `${p} prov tax`).toBeGreaterThan(0);
      expect(r.warnings, `${p} warnings`).toEqual([]);
    }
  });

  it('Quebec employs QPP, QPIP, provincial tax, and federal abatement', () => {
    const r = calculatePay({ ...base, province: 'QC' });
    expect(r.cpp).toBeGreaterThan(0); // QPP deducted
    expect(r.cpp).not.toBe(140.74); // different from CPP for ON
    expect(r.ei).toBe(32.5); // QC-reduced EI (1.30%)
    expect(r.federalTax).toBeGreaterThan(0); // still has federal tax (abated)
    expect(r.provincialTax).toBeGreaterThan(0); // QC provincial tax
    expect(r.netPay).toBeGreaterThan(0);
    expect(r.warnings).toEqual([]);
  });

  it('Quebec federal tax is lower than Ontario due to 16.5% abatement', () => {
    const qc = calculatePay({ ...base, province: 'QC' });
    const on = calculatePay({ ...base, province: 'ON' });
    // At same gross, QC federal tax ≈ 83.5% of ON federal tax
    expect(qc.federalTax).toBeLessThan(on.federalTax);
  });

  it('Quebec gross-to-net invariant holds', () => {
    const r = calculatePay({ ...base, province: 'QC' });
    expect(Math.abs(r.gross - (r.netPay + r.totalDeductions))).toBeLessThanOrEqual(0.02);
  });

  it('rejects negative gross', () => {
    expect(() => calculatePay({ ...base, grossPeriodIncome: -1 })).toThrow(TaxEngineError);
  });
});

describe('T4127 July 2026 edition (123rd ed.)', () => {
  const baseJul = { ...base, payDate: '2026-07-15' };

  it('resolves July 2026 tables', () => {
    const tables = getTables('2026-07-01');
    expect(tables.provinces.BC.lowestRate).toBe(0.0614); // prorated BC rate
    expect(tables.provinces.NL.bpa).toBe(15_000); // prorated NL BPA
    expect(tables.provinces.PE.brackets.length).toBe(6); // new 6th bracket
    expect(tables.provinces.PE.brackets[5].rate).toBe(0.21); // prorated top rate
    expect(tables.federal).toBe(getTables('2026-01-01').federal); // federal unchanged
    expect(tables.cpp).toBe(getTables('2026-01-01').cpp); // CPP unchanged
    expect(tables.ei).toBe(getTables('2026-01-01').ei); // EI unchanged
  });

  it('BC tax is higher with prorated July rate', () => {
    const jan = calculatePay({ ...base, payDate: '2026-06-15', province: 'BC' });
    const jul = calculatePay({ ...baseJul, province: 'BC' });
    expect(jul.provincialTax).toBeGreaterThan(jan.provincialTax);
  });

  it('NL tax is lower with prorated higher BPA', () => {
    const jan = calculatePay({ ...base, province: 'NL' });
    const jul = calculatePay({ ...baseJul, province: 'NL' });
    expect(jul.provincialTax).toBeLessThan(jan.provincialTax);
  });

  it('PE top bracket applies at high income', () => {
    const r = calculatePay({ ...baseJul, province: 'PE', frequency: 'monthly', grossPeriodIncome: 25_000 });
    // Annual taxable > $200,000 — PE top bracket (21% prorated) engaged
    expect(r.provincialTax).toBeGreaterThan(0);
    expect(r.annualTaxableIncome).toBeGreaterThan(200_000);
  });

  it('unchanged provinces produce identical results Jan vs Jul', () => {
    const jul = calculatePay({ ...baseJul, province: 'ON' });
    const jan = calculatePay({ ...base, province: 'ON' });
    expect(jul.provincialTax).toBe(jan.provincialTax);
    expect(jul.federalTax).toBe(jan.federalTax);
  });

  it('July tables are verified', () => {
    const tables = getTables('2026-07-01');
    for (const [code, table] of Object.entries(tables.provinces)) {
      if (code === 'QC') continue;
      expect(table.meta.verified, `${code} July should be verified`).toBe(true);
    }
  });
});
