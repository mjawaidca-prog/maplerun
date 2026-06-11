/**
 * PDOC golden-file regression tests.
 *
 * Compares MapleRun tax-engine output against goldens.json.
 * Goldens were generated from the verified 2026 engine (all tables verified
 * against T4127 121st ed.).  Spot-check a random sample against CRA PDOC at
 * https://apps.cra-arc.gc.ca/ebci/rhpd/beta/entry/en to confirm accuracy.
 *
 * Tolerance: ±$0.50 per CRA rounding conventions.
 */

import { describe, expect, it } from 'vitest';
import goldensFile from './goldens.json' with { type: 'json' };
import { calculatePay, calculateBonus, ZERO_YTD } from '../src/index';
import type { PayInput, ProvinceCode } from '../src/index';

const TOLERANCE = 0.51; // $0.50 per requirement + 0.01 float epsilon

interface GoldenEntry {
  profile: string;
  inputs: {
    province: ProvinceCode;
    frequency: string;
    grossPeriodIncome: number;
    payDate: string;
    federalClaim?: number;
    provincialClaim?: number;
  };
  results: {
    cpp: number;
    cpp2: number;
    ei: number;
    federalTax: number;
    provincialTax: number;
    totalDeductions: number;
    netPay: number;
    annualTaxableIncome: number;
    employerEi: number;
    employerCpp: number;
  };
}

const goldens = goldensFile.goldens as Record<string, GoldenEntry[]>;

describe('PDOC golden-file regression (6 profiles × 12 provinces = 72 regular + 12 bonus)', () => {
  const regularProfiles = Object.entries(goldens).filter(([name]) => !name.startsWith('Bonus'));

  for (const [profileName, entries] of regularProfiles) {
    describe(profileName, () => {
      for (const entry of entries) {
        const { province, frequency, grossPeriodIncome, payDate, federalClaim, provincialClaim } = entry.inputs;
        const label = `${province} ${frequency} $${grossPeriodIncome}` +
          (federalClaim ? ` FD$${federalClaim}` : '') +
          (provincialClaim ? ` PD$${provincialClaim}` : '');

        it(label, () => {
          const input: PayInput = {
            province,
            frequency: frequency as PayInput['frequency'],
            grossPeriodIncome,
            payDate,
            federalClaim: federalClaim ?? undefined,
            provincialClaim: provincialClaim ?? undefined,
            ytd: ZERO_YTD,
          };

          const r = calculatePay(input);
          const e = entry.results;

          expect(r.cpp, `cpp`).toBeCloseTo(e.cpp, 1);
          expect(r.cpp2, `cpp2`).toBeCloseTo(e.cpp2, 1);
          expect(r.ei, `ei`).toBeCloseTo(e.ei, 1);
          expect(r.federalTax, `federalTax`).toBeCloseTo(e.federalTax, 1);
          expect(r.provincialTax, `provincialTax`).toBeCloseTo(e.provincialTax, 1);
          expect(r.totalDeductions, `totalDeductions`).toBeCloseTo(e.totalDeductions, 1);
          expect(r.netPay, `netPay`).toBeCloseTo(e.netPay, 1);
          expect(r.annualTaxableIncome, `annualTaxableIncome`).toBeCloseTo(e.annualTaxableIncome, 0);
          expect(r.employer.ei, `employerEi`).toBeCloseTo(e.employerEi, 1);
          expect(r.employer.cpp, `employerCpp`).toBeCloseTo(e.employerCpp, 1);

          // Cross-check: gross = net + deductions (within rounding)
          const diff = Math.abs(r.gross - (r.netPay + r.totalDeductions));
          expect(diff, `gross = net + deductions ±$0.02`).toBeLessThanOrEqual(0.02);
        });
      }
    });
  }

  describe('Bonus $5,000 across all provinces', () => {
    const bonusSet = goldens['Bonus $5,000 across all provinces'];
    if (!bonusSet) throw new Error('Bonus goldens not found');

    for (const entry of bonusSet) {
      const { province, frequency, grossPeriodIncome, payDate } = entry.inputs;
      const label = `${province} bonus $5,000 on ${frequency} $${grossPeriodIncome} regular`;

      it(label, () => {
        const input = {
          province,
          frequency: frequency as PayInput['frequency'],
          grossPeriodIncome,
          payDate,
          bonusAmount: 5_000,
          ytd: ZERO_YTD,
        };

        const r = calculateBonus(input);
        const e = entry.results;

        expect(r.bonusCpp, `bonusCpp`).toBeCloseTo(e.cpp, 1);
        expect(r.bonusCpp2, `bonusCpp2`).toBeCloseTo(e.cpp2, 1);
        expect(r.bonusEi, `bonusEi`).toBeCloseTo(e.ei, 1);
        expect(r.bonusFederalTax, `bonusFederalTax`).toBeCloseTo(e.federalTax, 1);
        expect(r.bonusProvincialTax, `bonusProvincialTax`).toBeCloseTo(e.provincialTax, 1);
        expect(r.totalDeductions, `totalDeductions`).toBeCloseTo(e.totalDeductions, 1);
        expect(r.netBonus, `netBonus`).toBeCloseTo(e.netPay, 1);
      });
    }
  });
});

describe('PDOC tolerance guard', () => {
  it('all goldens deviate less than $0.50 from engine (regeneration check)', () => {
    let maxDeviation = 0;
    let worstCase = '';

    const regularProfiles = Object.entries(goldens).filter(([name]) => !name.startsWith('Bonus'));
    for (const [profileName, entries] of regularProfiles) {
      for (const entry of entries) {
        const input: PayInput = {
          province: entry.inputs.province,
          frequency: entry.inputs.frequency as PayInput['frequency'],
          grossPeriodIncome: entry.inputs.grossPeriodIncome,
          payDate: entry.inputs.payDate,
          federalClaim: entry.inputs.federalClaim ?? undefined,
          provincialClaim: entry.inputs.provincialClaim ?? undefined,
          ytd: ZERO_YTD,
        };
        const r = calculatePay(input);
        const fields = [
          { name: 'cpp', actual: r.cpp, expected: entry.results.cpp },
          { name: 'ei', actual: r.ei, expected: entry.results.ei },
          { name: 'federalTax', actual: r.federalTax, expected: entry.results.federalTax },
          { name: 'provincialTax', actual: r.provincialTax, expected: entry.results.provincialTax },
          { name: 'netPay', actual: r.netPay, expected: entry.results.netPay },
        ];
        for (const f of fields) {
          const dev = Math.abs(f.actual - f.expected);
          if (dev > maxDeviation) {
            maxDeviation = dev;
            worstCase = `${profileName} / ${entry.inputs.province} ${f.name}: got ${f.actual}, expected ${f.expected}`;
          }
        }
      }
    }

    expect(maxDeviation, `max deviation ≤ $0.50. Worst: ${worstCase}`).toBeLessThanOrEqual(TOLERANCE);
  });
});
