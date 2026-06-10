import type { ProvinceCode, ProvincialTable } from '../../types';

/**
 * Provincial/territorial tables for 2026.
 * Seeded from 2025 published values × estimated 2026 provincial indexation factors.
 * EVERY table is verified:false — Phase 1 verifies each against T4127 ch. 8 / provincial sources.
 * Quebec income tax is Revenu Québec TP-1015.3 (not T4127) — Phase 2; engine refuses QC tax.
 */

const UNVERIFIED = (detail: string) => ({
  verified: false,
  source: `Model knowledge: ${detail}. VERIFY against T4127 121st ed. ch. 8.`,
  lastReviewed: '2026-06-10',
});

export const PROVINCES_2026: Record<ProvinceCode, ProvincialTable> = {
  AB: {
    province: 'AB', year: 2026, lowestRate: 0.08,
    brackets: [
      { upTo: 61_200, rate: 0.08 },
      { upTo: 154_259, rate: 0.10 },
      { upTo: 185_111, rate: 0.12 },
      { upTo: 246_813, rate: 0.13 },
      { upTo: 370_220, rate: 0.14 },
      { upTo: null, rate: 0.15 },
    ],
    bpa: 22_323,
    meta: UNVERIFIED('2025 values (8% bracket introduced 2025 at $60,000) × ~2% AB indexation'),
  },
  BC: {
    province: 'BC', year: 2026, lowestRate: 0.0506,
    brackets: [
      { upTo: 50_314, rate: 0.0506 },
      { upTo: 100_630, rate: 0.077 },
      { upTo: 115_534, rate: 0.105 },
      { upTo: 140_293, rate: 0.1229 },
      { upTo: 190_218, rate: 0.147 },
      { upTo: 265_285, rate: 0.168 },
      { upTo: null, rate: 0.205 },
    ],
    bpa: 13_204,
    notes: ['BC low-income tax reduction (S factor) not yet modelled — low earners slightly over-withheld.'],
    meta: UNVERIFIED('2025 values × ~2.1% BC indexation'),
  },
  MB: {
    province: 'MB', year: 2026, lowestRate: 0.108,
    brackets: [
      { upTo: 48_515, rate: 0.108 },
      { upTo: 103_224, rate: 0.1275 },
      { upTo: null, rate: 0.174 },
    ],
    bpa: 16_288,
    notes: ['MB BPA phase-out for income > $200k (introduced 2025) not yet modelled.'],
    meta: UNVERIFIED('2025 values × ~2% MB indexation; BPA freeze/phase-out rules in flux'),
  },
  NB: {
    province: 'NB', year: 2026, lowestRate: 0.094,
    brackets: [
      { upTo: 52_332, rate: 0.094 },
      { upTo: 104_666, rate: 0.14 },
      { upTo: 193_861, rate: 0.16 },
      { upTo: null, rate: 0.195 },
    ],
    bpa: 13_664,
    meta: UNVERIFIED('2025 values × ~2% NB indexation'),
  },
  NL: {
    province: 'NL', year: 2026, lowestRate: 0.087,
    brackets: [
      { upTo: 45_297, rate: 0.087 },
      { upTo: 90_592, rate: 0.145 },
      { upTo: 161_737, rate: 0.158 },
      { upTo: 226_433, rate: 0.178 },
      { upTo: 289_269, rate: 0.198 },
      { upTo: 578_540, rate: 0.208 },
      { upTo: 1_157_079, rate: 0.213 },
      { upTo: null, rate: 0.218 },
    ],
    bpa: 11_344,
    meta: UNVERIFIED('2025 values × ~2.5% NL indexation'),
  },
  NS: {
    province: 'NS', year: 2026, lowestRate: 0.0879,
    brackets: [
      { upTo: 31_117, rate: 0.0879 },
      { upTo: 62_235, rate: 0.1495 },
      { upTo: 97_801, rate: 0.1667 },
      { upTo: 157_743, rate: 0.175 },
      { upTo: null, rate: 0.21 },
    ],
    bpa: 11_979,
    notes: ['NS low-income BPA supplement (up to $3,000, phased out to $75k income) not yet modelled.'],
    meta: UNVERIFIED('NS began indexing in 2025 (BPA raised to 11,744); 2026 × ~2%'),
  },
  NT: {
    province: 'NT', year: 2026, lowestRate: 0.059,
    brackets: [
      { upTo: 53_003, rate: 0.059 },
      { upTo: 106_009, rate: 0.086 },
      { upTo: 172_346, rate: 0.122 },
      { upTo: null, rate: 0.1405 },
    ],
    bpa: 18_199,
    meta: UNVERIFIED('2025 values × ~2% NT indexation'),
  },
  NU: {
    province: 'NU', year: 2026, lowestRate: 0.04,
    brackets: [
      { upTo: 55_801, rate: 0.04 },
      { upTo: 111_601, rate: 0.07 },
      { upTo: 181_439, rate: 0.09 },
      { upTo: null, rate: 0.115 },
    ],
    bpa: 19_659,
    meta: UNVERIFIED('2025 values × ~2% NU indexation'),
  },
  ON: {
    province: 'ON', year: 2026, lowestRate: 0.0505,
    brackets: [
      { upTo: 53_944, rate: 0.0505 },
      { upTo: 107_891, rate: 0.0915 },
      { upTo: 150_000, rate: 0.1116 },
      { upTo: 220_000, rate: 0.1216 },
      { upTo: null, rate: 0.1316 },
    ],
    bpa: 13_002,
    surtax: [
      { over: 5_824, rate: 0.20 },
      { over: 7_453, rate: 0.36 },
    ],
    // Statutory since 2004, not indexed: premium = min(cap, base + rate × (A − over)).
    healthPremiumBands: [
      { over: 0, base: 0, rate: 0, cap: 0 },
      { over: 20_000, base: 0, rate: 0.06, cap: 300 },
      { over: 36_000, base: 300, rate: 0.06, cap: 450 },
      { over: 48_000, base: 450, rate: 0.25, cap: 600 },
      { over: 72_000, base: 600, rate: 0.25, cap: 750 },
      { over: 200_000, base: 750, rate: 0.25, cap: 900 },
    ],
    meta: UNVERIFIED('2025 values × ~2% ON indexation; $150k/$220k brackets and health premium are statutory (not indexed)'),
  },
  PE: {
    province: 'PE', year: 2026, lowestRate: 0.095,
    brackets: [
      { upTo: 33_995, rate: 0.095 },
      { upTo: 65_949, rate: 0.1347 },
      { upTo: 105_000, rate: 0.166 },
      { upTo: 140_000, rate: 0.1762 },
      { upTo: null, rate: 0.19 },
    ],
    bpa: 15_000,
    meta: UNVERIFIED('PE 2025 reform values; 2026 rates/BPA path uncertain — LOW confidence'),
  },
  QC: {
    province: 'QC', year: 2026, lowestRate: 0.14,
    brackets: [],
    bpa: 18_952,
    notImplemented: true,
    notes: ['Quebec income tax (TP-1015.3), QPP and QPIP are Phase 2.'],
    meta: UNVERIFIED('placeholder only'),
  },
  SK: {
    province: 'SK', year: 2026, lowestRate: 0.105,
    brackets: [
      { upTo: 54_532, rate: 0.105 },
      { upTo: 155_805, rate: 0.125 },
      { upTo: null, rate: 0.145 },
    ],
    bpa: 19_872,
    meta: UNVERIFIED('2025 values × ~2% SK indexation + $500/yr BPA increases (2025–2028) — LOW confidence on BPA'),
  },
  YT: {
    province: 'YT', year: 2026, lowestRate: 0.064,
    brackets: [
      { upTo: 58_523, rate: 0.064 },
      { upTo: 117_045, rate: 0.09 },
      { upTo: 181_440, rate: 0.109 },
      { upTo: 500_000, rate: 0.128 },
      { upTo: null, rate: 0.15 },
    ],
    // Yukon mirrors the federal income-tested BPA.
    bpa: { max: 16_452, min: 14_829, phaseOutStart: 181_440, phaseOutEnd: 258_482 },
    meta: UNVERIFIED('YT mirrors federal thresholds/BPA; $500k top bracket is YT-specific'),
  },
};
