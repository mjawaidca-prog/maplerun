import { describe, expect, it } from 'vitest';
import { estimateWcbPremium } from '../src/calc/wcb-estimate';
import {
  ONTARIO_EHT_EXEMPTION_LIMIT,
  ONTARIO_EHT_EXEMPTION_PAYROLL_CEILING,
  calcOntarioEht,
  ontarioEhtRate,
} from '../src/calc/ontario-eht';
import { TaxEngineError } from '../src/types';

describe('estimateWcbPremium', () => {
  it('basic: 100,000 @ 2.50 per $100 → 2,500', () => {
    const result = estimateWcbPremium({ assessableEarnings: 100_000, ratePer100: 2.5 });
    expect(result.assessableEarnings).toBe(100_000);
    expect(result.cappedEarnings).toBe(100_000);
    expect(result.premium).toBe(2_500);
  });

  it('cap applied: 200,000 earnings, cap 150,000 @ 2.00 → 3,000 + cap warning', () => {
    const result = estimateWcbPremium({
      assessableEarnings: 200_000,
      ratePer100: 2.0,
      maxAssessableEarnings: 150_000,
    });
    expect(result.cappedEarnings).toBe(150_000);
    expect(result.premium).toBe(3_000);
    expect(result.warnings.some((w) => /cap/i.test(w))).toBe(true);
  });

  it('estimate warning is always present', () => {
    const result = estimateWcbPremium({ assessableEarnings: 50_000, ratePer100: 1.5 });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => /estimate/i.test(w))).toBe(true);

    const capped = estimateWcbPremium({
      assessableEarnings: 200_000,
      ratePer100: 2.0,
      maxAssessableEarnings: 150_000,
    });
    expect(capped.warnings.some((w) => /estimate/i.test(w))).toBe(true);
  });

  it('negative rate throws TaxEngineError', () => {
    expect(() =>
      estimateWcbPremium({ assessableEarnings: 100_000, ratePer100: -1 }),
    ).toThrow(TaxEngineError);
  });

  it('negative earnings throws TaxEngineError', () => {
    expect(() =>
      estimateWcbPremium({ assessableEarnings: -1, ratePer100: 2.5 }),
    ).toThrow(TaxEngineError);
  });
});

describe('ontarioEhtRate boundaries', () => {
  it('200,000 → 0.0098', () => {
    expect(ontarioEhtRate(200_000)).toBe(0.0098);
  });

  it('200,001 → 0.01101', () => {
    expect(ontarioEhtRate(200_001)).toBe(0.01101);
  });

  it('400,000 → 0.01829', () => {
    expect(ontarioEhtRate(400_000)).toBe(0.01829);
  });

  it('400,001 → 0.0195', () => {
    expect(ontarioEhtRate(400_001)).toBe(0.0195);
  });
});

describe('calcOntarioEht', () => {
  it('exposes the exemption constants', () => {
    expect(ONTARIO_EHT_EXEMPTION_LIMIT).toBe(1_000_000);
    expect(ONTARIO_EHT_EXEMPTION_PAYROLL_CEILING).toBe(5_000_000);
  });

  it('payroll 150,000 with default exemption → taxable 0, eht 0', () => {
    const result = calcOntarioEht({ totalOntarioRemuneration: 150_000 });
    expect(result.exemptionApplied).toBe(1_000_000);
    expect(result.taxableRemuneration).toBe(0);
    expect(result.eht).toBe(0);
  });

  it('payroll 1,200,000 → rate 0.0195, taxable 200,000, eht 3,900', () => {
    const result = calcOntarioEht({ totalOntarioRemuneration: 1_200_000 });
    expect(result.rate).toBe(0.0195);
    expect(result.taxableRemuneration).toBe(200_000);
    expect(result.eht).toBe(3_900);
  });

  it('payroll 300,000 with eligibleForExemption false → rate 0.01465, taxable 300,000, eht 4,395', () => {
    const result = calcOntarioEht({
      totalOntarioRemuneration: 300_000,
      eligibleForExemption: false,
    });
    expect(result.rate).toBe(0.01465);
    expect(result.exemptionApplied).toBe(0);
    expect(result.taxableRemuneration).toBe(300_000);
    expect(result.eht).toBe(4_395);
  });

  it('payroll 6,000,000 → exemptionApplied 0 + warning, eht 117,000', () => {
    const result = calcOntarioEht({ totalOntarioRemuneration: 6_000_000 });
    expect(result.exemptionApplied).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.taxableRemuneration).toBe(6_000_000);
    expect(result.eht).toBe(117_000);
  });

  it('custom exemption share: payroll 900,000, exemption 400,000 → taxable 500,000, eht 9,750', () => {
    const result = calcOntarioEht({
      totalOntarioRemuneration: 900_000,
      exemption: 400_000,
    });
    expect(result.exemptionApplied).toBe(400_000);
    expect(result.taxableRemuneration).toBe(500_000);
    expect(result.rate).toBe(0.0195);
    expect(result.eht).toBe(9_750);
  });

  it('negative remuneration throws TaxEngineError', () => {
    expect(() => calcOntarioEht({ totalOntarioRemuneration: -1 })).toThrow(TaxEngineError);
    expect(() => ontarioEhtRate(-1)).toThrow(TaxEngineError);
  });
});
