/**
 * Provincial/territorial tables for July–December 2026 — 123rd ed.
 *
 * Changes from Jan 2026 (122nd ed.):
 *   BC: Lowest rate 5.06% → 5.60% annual. Prorated to 6.14% for Jul–Dec.
 *       BC tax reduction (basic): $562 → $690 annual. Indexed to $575 for Jan–Jun,
 *       prorated to $805 for Jul–Dec.
 *   NL: BPA $11,188 → $13,094 annual (retroactive to Jan 1, 2026).
 *       Prorated to $15,000 for Jul–Dec to compensate for Jan–Jun at the lower amount.
 *   PE: New bracket: 20% on taxable income > $200,000 annual.
 *       Prorated to 21% for Jul–Dec.
 *   No changes: AB, MB, NB, NS, NT, NU, ON, SK, YT, Outside Canada.
 *
 * Source: CRA T4127 123rd ed. (Jul 2026). docs/sources/t4127-jul-2026.html
 */

import type { ProvinceCode, ProvincialTable, TableMeta } from '../../types';

const VERIFIED_JULY: TableMeta = {
  verified: true,
  source: 'CRA T4127 123rd ed. (Jul 2026) Tables 8.1/8.2 + ch. 5 provincial formulas.',
  lastReviewed: '2026-06-11',
};

// Unchanged tables — copy from Jan edition
import { PROVINCES_2026 as JAN } from './provinces';

export const PROVINCES_2026_JULY: Record<ProvinceCode, ProvincialTable> = {
  // Unchanged jurisdictions: AB, MB, NB, NS, NT, NU, ON, SK, YT
  AB: { ...JAN.AB, meta: VERIFIED_JULY },
  MB: { ...JAN.MB, meta: VERIFIED_JULY },
  NB: { ...JAN.NB, meta: VERIFIED_JULY },
  NS: { ...JAN.NS, meta: VERIFIED_JULY },
  NT: { ...JAN.NT, meta: VERIFIED_JULY },
  NU: { ...JAN.NU, meta: VERIFIED_JULY },
  ON: { ...JAN.ON, meta: VERIFIED_JULY },
  SK: { ...JAN.SK, meta: VERIFIED_JULY },
  YT: { ...JAN.YT, meta: VERIFIED_JULY },
  QC: { ...JAN.QC, meta: { ...JAN.QC.meta, lastReviewed: '2026-06-11' } },

  // ─── British Columbia ────────────────────────────────────────────────────
  BC: {
    province: 'BC',
    year: 2026,
    lowestRate: 0.0614, // prorated; annual effective rate is 5.60%
    brackets: [
      { upTo: 50_363, rate: 0.0614 },
      { upTo: 100_728, rate: 0.077 },
      { upTo: 115_648, rate: 0.105 },
      { upTo: 140_430, rate: 0.1229 },
      { upTo: 190_405, rate: 0.147 },
      { upTo: 265_545, rate: 0.168 },
      { upTo: null, rate: 0.205 },
    ],
    bpa: 13_216, // unchanged
    lowIncomeReduction: {
      max: 805, // prorated; annual effective amount is $690 (indexed)
      phaseOutStart: 25_570,
      phaseOutRate: 0.0356,
      phaseOutEnd: 41_722,
    },
    meta: VERIFIED_JULY,
  },

  // ─── Newfoundland and Labrador ───────────────────────────────────────────
  NL: {
    province: 'NL',
    year: 2026,
    lowestRate: 0.087,
    brackets: [
      { upTo: 44_678, rate: 0.087 },
      { upTo: 89_354, rate: 0.145 },
      { upTo: 159_528, rate: 0.158 },
      { upTo: 223_340, rate: 0.178 },
      { upTo: 285_319, rate: 0.198 },
      { upTo: 570_638, rate: 0.208 },
      { upTo: 1_141_275, rate: 0.213 },
      { upTo: null, rate: 0.218 },
    ],
    bpa: 15_000, // prorated; annual effective amount is $13,094
    meta: VERIFIED_JULY,
  },

  // ─── Prince Edward Island ────────────────────────────────────────────────
  PE: {
    province: 'PE',
    year: 2026,
    lowestRate: 0.095,
    brackets: [
      { upTo: 33_928, rate: 0.095 },
      { upTo: 65_820, rate: 0.1347 },
      { upTo: 106_890, rate: 0.166 },
      { upTo: 142_520, rate: 0.1762 },
      { upTo: 200_000, rate: 0.19 },
      { upTo: null, rate: 0.21 }, // prorated; annual effective rate is 20%
    ],
    bpa: 15_000,
    meta: VERIFIED_JULY,
  },
};
