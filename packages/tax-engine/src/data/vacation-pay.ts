/**
 * Vacation-pay minimums by province/territory (employment standards).
 *
 * These are the statutory MINIMUM vacation pay percentages that employers
 * must pay. Many employers offer more generous policies.  The engine applies
 * the minimum unless the employer overrides via a higher rate.
 *
 * Data sourced from provincial employment standards legislation, cross-checked
 * against myhr.works (2026 cheat sheet), SiLaw (Apr 2026), Timetrex (2026),
 * and Yukon.ca (Dec 2024).
 *
 * ⚠️ Quebec threshold: sources disagree (4%→6% at 3yr vs 6%→8% at 3yr).
 *    We use the more widely-cited 4%→6% and flag for verification against
 *    the Act Respecting Labour Standards (CNESST).
 * ⚠️ PEI threshold: reduced from 8yr to 5yr per 2026 legislative update
 *    (Timetrex) — verify against PEI Employment Standards Act.
 * ⚠️ Saskatchewan uses fractional formulas (3/52, 4/52) — exact percentages
 *    differ slightly from the rounded values shown.
 */

import type { ProvinceCode } from '../types';

export interface VacationPayTier {
  /** Minimum vacation pay rate as a decimal (e.g. 0.04 = 4%). */
  rate: number;
  /** Years of uninterrupted service to qualify for this tier. null = open-ended. */
  yearsMin: number;
  yearsMax: number | null;
}

export interface VacationPayStandard {
  province: ProvinceCode | 'FEDERAL';
  tiers: VacationPayTier[];
  /** Statutory weeks of vacation corresponding to each tier (informational). */
  weeksPerTier: number[];
  /** Source statute or regulation. */
  source: string;
  lastReviewed: string;
  verified: boolean;
}

/**
 * All Canadian vacation-pay standards.
 * Keyed by province code (or 'FEDERAL' for Canada Labour Code).
 */
export const VACATION_PAY_STANDARDS: Record<string, VacationPayStandard> = {
  FEDERAL: {
    province: 'FEDERAL',
    tiers: [
      { rate: 0.04, yearsMin: 1, yearsMax: 4 },
      { rate: 0.06, yearsMin: 5, yearsMax: 9 },
      { rate: 0.08, yearsMin: 10, yearsMax: null },
    ],
    weeksPerTier: [2, 3, 4],
    source: 'Canada Labour Code, Part III',
    lastReviewed: '2026-06-11',
    verified: true,
  },
  AB: {
    province: 'AB',
    tiers: [
      { rate: 0.04, yearsMin: 1, yearsMax: 4 },
      { rate: 0.06, yearsMin: 5, yearsMax: null },
    ],
    weeksPerTier: [2, 3],
    source: 'Alberta Employment Standards Code',
    lastReviewed: '2026-06-11',
    verified: true,
  },
  BC: {
    province: 'BC',
    tiers: [
      { rate: 0.04, yearsMin: 1, yearsMax: 4 },
      { rate: 0.06, yearsMin: 5, yearsMax: null },
    ],
    weeksPerTier: [2, 3],
    source: 'BC Employment Standards Act',
    lastReviewed: '2026-06-11',
    verified: true,
  },
  MB: {
    province: 'MB',
    tiers: [
      { rate: 0.04, yearsMin: 1, yearsMax: 4 },
      { rate: 0.06, yearsMin: 5, yearsMax: null },
    ],
    weeksPerTier: [2, 3],
    source: 'Manitoba Employment Standards Code',
    lastReviewed: '2026-06-11',
    verified: true,
  },
  NB: {
    province: 'NB',
    tiers: [
      { rate: 0.04, yearsMin: 1, yearsMax: 7 },
      { rate: 0.06, yearsMin: 8, yearsMax: null },
    ],
    weeksPerTier: [2, 3],
    source: 'New Brunswick Employment Standards Act',
    lastReviewed: '2026-06-11',
    verified: true,
  },
  NL: {
    province: 'NL',
    tiers: [
      { rate: 0.04, yearsMin: 1, yearsMax: 14 },
      { rate: 0.06, yearsMin: 15, yearsMax: null },
    ],
    weeksPerTier: [2, 3],
    source: 'Newfoundland & Labrador Labour Standards Act',
    lastReviewed: '2026-06-11',
    verified: true,
  },
  NS: {
    province: 'NS',
    tiers: [
      { rate: 0.04, yearsMin: 1, yearsMax: 7 },
      { rate: 0.06, yearsMin: 8, yearsMax: null },
    ],
    weeksPerTier: [2, 3],
    source: 'Nova Scotia Labour Standards Code',
    lastReviewed: '2026-06-11',
    verified: true,
  },
  NT: {
    province: 'NT',
    tiers: [
      { rate: 0.04, yearsMin: 1, yearsMax: 5 },
      { rate: 0.06, yearsMin: 6, yearsMax: null },
    ],
    weeksPerTier: [2, 3],
    source: 'Northwest Territories Employment Standards Act',
    lastReviewed: '2026-06-11',
    verified: true,
  },
  NU: {
    province: 'NU',
    tiers: [
      { rate: 0.04, yearsMin: 1, yearsMax: 5 },
      { rate: 0.06, yearsMin: 6, yearsMax: null },
    ],
    weeksPerTier: [2, 3],
    source: 'Nunavut Labour Standards Act',
    lastReviewed: '2026-06-11',
    verified: true,
  },
  ON: {
    province: 'ON',
    tiers: [
      { rate: 0.04, yearsMin: 1, yearsMax: 4 },
      { rate: 0.06, yearsMin: 5, yearsMax: null },
    ],
    weeksPerTier: [2, 3],
    source: 'Ontario Employment Standards Act, 2000',
    lastReviewed: '2026-06-11',
    verified: true,
  },
  PE: {
    province: 'PE',
    tiers: [
      { rate: 0.04, yearsMin: 1, yearsMax: 4 },
      { rate: 0.06, yearsMin: 5, yearsMax: null },
    ],
    weeksPerTier: [2, 3],
    source: 'PEI Employment Standards Act (2026 amendment reduced threshold from 8yr to 5yr)',
    lastReviewed: '2026-06-11',
    verified: false,
  },
  QC: {
    province: 'QC',
    tiers: [
      { rate: 0.04, yearsMin: 1, yearsMax: 2 },
      { rate: 0.06, yearsMin: 3, yearsMax: null },
    ],
    weeksPerTier: [2, 3],
    source: 'Act Respecting Labour Standards (CNESST) — ⚠️ verify: some 2026 sources cite 6%/8%',
    lastReviewed: '2026-06-11',
    verified: false,
  },
  SK: {
    province: 'SK',
    tiers: [
      { rate: 3 / 52, yearsMin: 1, yearsMax: 9 },
      { rate: 4 / 52, yearsMin: 10, yearsMax: null },
    ],
    weeksPerTier: [3, 4],
    source: 'Saskatchewan Employment Act (fractional: 3/52 and 4/52 of annual wages)',
    lastReviewed: '2026-06-11',
    verified: true,
  },
  YT: {
    province: 'YT',
    tiers: [
      { rate: 0.04, yearsMin: 1, yearsMax: null },
    ],
    weeksPerTier: [2],
    source: 'Yukon Employment Standards Act',
    lastReviewed: '2026-06-11',
    verified: true,
  },
};

/**
 * Get the minimum vacation pay rate for a given province and years of service.
 * Returns 0 if the employee has less than 1 year of service (no statutory minimum).
 */
export function getVacationPayRate(
  province: ProvinceCode | 'FEDERAL',
  yearsOfService: number,
): number {
  const standard = VACATION_PAY_STANDARDS[province];
  if (!standard) return 0;

  for (const tier of standard.tiers) {
    if (
      yearsOfService >= tier.yearsMin &&
      (tier.yearsMax === null || yearsOfService <= tier.yearsMax)
    ) {
      return tier.rate;
    }
  }

  // Less than 1 year: no statutory minimum vacation pay entitlement
  return 0;
}

/**
 * Calculate the minimum vacation pay amount for a given gross pay.
 */
export function calcVacationPay(
  province: ProvinceCode | 'FEDERAL',
  yearsOfService: number,
  grossPay: number,
): number {
  const rate = getVacationPayRate(province, yearsOfService);
  return Math.round(grossPay * rate * 100) / 100;
}
