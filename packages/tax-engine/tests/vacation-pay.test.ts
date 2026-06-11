import { describe, expect, it } from 'vitest';
import {
  VACATION_PAY_STANDARDS,
  calcVacationPay,
  getVacationPayRate,
} from '../src/index';
import type { ProvinceCode } from '../src/index';

describe('vacation-pay standards data integrity', () => {
  const expectedJurisdictions: (ProvinceCode | 'FEDERAL')[] = [
    'FEDERAL', 'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
  ];

  it('covers all provinces + federal', () => {
    for (const j of expectedJurisdictions) {
      expect(VACATION_PAY_STANDARDS[j], `${j} should exist`).toBeDefined();
      expect(VACATION_PAY_STANDARDS[j].tiers.length, `${j} should have tiers`).toBeGreaterThan(0);
    }
  });

  it('all rates are between 0 and 0.10', () => {
    for (const [, std] of Object.entries(VACATION_PAY_STANDARDS)) {
      for (const tier of std.tiers) {
        expect(tier.rate, `${std.province} rate`).toBeGreaterThan(0);
        expect(tier.rate, `${std.province} rate`).toBeLessThan(0.10);
      }
    }
  });

  it('most provinces start at 4% tier 1 and 6% tier 2', () => {
    const standardTwoTier = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON'];
    for (const code of standardTwoTier) {
      const std = VACATION_PAY_STANDARDS[code];
      expect(std.tiers[0].rate, `${code} tier 1`).toBe(0.04);
      expect(std.tiers[1].rate, `${code} tier 2`).toBe(0.06);
    }
  });

  it('special jurisdictions have known deviations', () => {
    // Saskatchewan: fractional rates
    expect(VACATION_PAY_STANDARDS.SK.tiers[0].rate).toBeCloseTo(3 / 52, 4);
    expect(VACATION_PAY_STANDARDS.SK.tiers[1].rate).toBeCloseTo(4 / 52, 4);

    // Yukon: single tier, flat 4%
    expect(VACATION_PAY_STANDARDS.YT.tiers.length).toBe(1);
    expect(VACATION_PAY_STANDARDS.YT.tiers[0].rate).toBe(0.04);
    expect(VACATION_PAY_STANDARDS.YT.tiers[0].yearsMax).toBeNull();

    // Federal: three tiers
    expect(VACATION_PAY_STANDARDS.FEDERAL.tiers.length).toBe(3);
    expect(VACATION_PAY_STANDARDS.FEDERAL.tiers[2].rate).toBe(0.08);

    // Quebec: 3-year threshold (earliest in Canada)
    expect(VACATION_PAY_STANDARDS.QC.tiers[1].yearsMin).toBe(3);
  });
});

describe('getVacationPayRate', () => {
  it('returns 0 for less than 1 year of service', () => {
    expect(getVacationPayRate('ON', 0)).toBe(0);
    expect(getVacationPayRate('ON', 0.5)).toBe(0);
  });

  it('returns 4% for 1 year and 6% for 5+ years in Ontario', () => {
    expect(getVacationPayRate('ON', 1)).toBe(0.04);
    expect(getVacationPayRate('ON', 4)).toBe(0.04);
    expect(getVacationPayRate('ON', 5)).toBe(0.06);
    expect(getVacationPayRate('ON', 20)).toBe(0.06);
  });

  it('returns 6% at 3 years in Quebec', () => {
    expect(getVacationPayRate('QC', 1)).toBe(0.04);
    expect(getVacationPayRate('QC', 2)).toBe(0.04);
    expect(getVacationPayRate('QC', 3)).toBe(0.06);
    expect(getVacationPayRate('QC', 10)).toBe(0.06);
  });

  it('Newfoundland takes 15 years for the 6% bump', () => {
    expect(getVacationPayRate('NL', 14)).toBe(0.04);
    expect(getVacationPayRate('NL', 15)).toBe(0.06);
  });

  it('Saskatchewan uses fractional rates', () => {
    expect(getVacationPayRate('SK', 5)).toBeCloseTo(3 / 52, 4);
    expect(getVacationPayRate('SK', 10)).toBeCloseTo(4 / 52, 4);
  });

  it('Federal has three tiers', () => {
    expect(getVacationPayRate('FEDERAL', 3)).toBe(0.04);
    expect(getVacationPayRate('FEDERAL', 6)).toBe(0.06);
    expect(getVacationPayRate('FEDERAL', 12)).toBe(0.08);
  });

  it('Yukon stays at 4% forever', () => {
    expect(getVacationPayRate('YT', 1)).toBe(0.04);
    expect(getVacationPayRate('YT', 30)).toBe(0.04);
  });
});

describe('calcVacationPay', () => {
  it('calculates vacation pay on gross wages', () => {
    expect(calcVacationPay('ON', 3, 2_500)).toBe(100);
    expect(calcVacationPay('ON', 6, 2_500)).toBe(150);
    expect(calcVacationPay('ON', 0, 2_500)).toBe(0);
  });

  it('rounds to cents', () => {
    // 6% of 1,999.99 = 119.9994 → 119.99 (actually 120.00)
    const result = calcVacationPay('ON', 5, 1_999.99);
    expect(result).toBe(120.0);
  });

  it('Saskatchewan fractional: 3/52 × $5,200 = $300', () => {
    const result = calcVacationPay('SK', 5, 5_200);
    expect(result).toBe(300);
  });

  it('all provinces produce sane values at $2,000 gross', () => {
    const provinces: ProvinceCode[] = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
    for (const p of provinces) {
      const vp = calcVacationPay(p, 3, 2_000);
      expect(vp, `${p} vacation pay`).toBeGreaterThanOrEqual(80); // min 4%
      expect(vp, `${p} vacation pay`).toBeLessThanOrEqual(160); // max ~8%
    }
  });
});
