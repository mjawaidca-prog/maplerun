import type { ProvinceCode, ProvincialTable, TableMeta } from '../../types';

/**
 * Provincial/territorial tables for 2026 — VERIFIED against T4127 121st ed.
 * (Jan 2026, includes the May 2026 PE update): Table 8.1 (V/thresholds/KP),
 * Table 8.2 (BPAs, surtax, S2), chapter 6 provincial formulas (BC S, ON S/V1/V2,
 * AB K5P, YT K4P), BPAMB/BPAYT formulas ch. 2. Source: docs/sources/cra-t4127.html.
 * Bracket `k` values are CRA's PUBLISHED KP constants from Table 8.1, used
 * verbatim by bracketFor since the Wave 4 Phase 0 fix (defect D6) — the
 * threshold derivation drifts up to ~$0.50/yr from the published values.
 *
 * Not modelled (rare; documented in docs/TAX-COMPLIANCE.md): LCP labour-sponsored
 * fund credits, ON factor Y (dependant add-on to the tax reduction), TD1X commission,
 * "outside Canada" 48% surtax.
 */

const VERIFIED: TableMeta = {
  verified: true,
  source: 'CRA T4127 121st ed. (Jan 2026) Tables 8.1/8.2 + ch. 6 formulas.',
  lastReviewed: '2026-06-10',
};

export const PROVINCES_2026: Record<ProvinceCode, ProvincialTable> = {
  AB: {
    province: 'AB', year: 2026, lowestRate: 0.08,
    brackets: [
      { upTo: 61_200, rate: 0.08, k: 0 },
      { upTo: 154_259, rate: 0.10, k: 1_224 },
      { upTo: 185_111, rate: 0.12, k: 4_309 },
      { upTo: 246_813, rate: 0.13, k: 6_160 },
      { upTo: 370_220, rate: 0.14, k: 8_628 },
      { upTo: null, rate: 0.15, k: 12_331 },
    ],
    bpa: 22_769,
    // K5P: credits valued at 8% but legislated at 10% — top up the excess over
    // the first bracket's tax (0.08 × 61,200 = 4,896) by 25%.
    creditTopUp: { rate: 0.25 },
    meta: VERIFIED,
  },
  BC: {
    province: 'BC', year: 2026, lowestRate: 0.0506,
    brackets: [
      { upTo: 50_363, rate: 0.0506, k: 0 },
      { upTo: 100_728, rate: 0.077, k: 1_330 },
      { upTo: 115_648, rate: 0.105, k: 4_150 },
      { upTo: 140_430, rate: 0.1229, k: 6_220 },
      { upTo: 190_405, rate: 0.147, k: 9_604 },
      { upTo: 265_545, rate: 0.168, k: 13_603 },
      { upTo: null, rate: 0.205, k: 23_428 },
    ],
    bpa: 13_216,
    lowIncomeReduction: { max: 575, phaseOutStart: 25_570, phaseOutRate: 0.0356, phaseOutEnd: 41_722 },
    meta: VERIFIED,
  },
  MB: {
    province: 'MB', year: 2026, lowestRate: 0.108,
    // Brackets and BPA not indexed (frozen by 2025 provincial decision).
    brackets: [
      { upTo: 47_000, rate: 0.108, k: 0 },
      { upTo: 100_000, rate: 0.1275, k: 917 },
      { upTo: null, rate: 0.174, k: 5_567 },
    ],
    // BPAMB formula: 15,780 phased linearly to 0 between NI 200,000 and 400,000.
    bpa: { max: 15_780, min: 0, phaseOutStart: 200_000, phaseOutEnd: 400_000 },
    meta: VERIFIED,
  },
  NB: {
    province: 'NB', year: 2026, lowestRate: 0.094,
    brackets: [
      { upTo: 52_333, rate: 0.094, k: 0 },
      { upTo: 104_666, rate: 0.14, k: 2_407 },
      { upTo: 193_861, rate: 0.16, k: 4_501 },
      { upTo: null, rate: 0.195, k: 11_286 },
    ],
    bpa: 13_664,
    meta: VERIFIED,
  },
  NL: {
    province: 'NL', year: 2026, lowestRate: 0.087,
    brackets: [
      { upTo: 44_678, rate: 0.087, k: 0 },
      { upTo: 89_354, rate: 0.145, k: 2_591 },
      { upTo: 159_528, rate: 0.158, k: 3_753 },
      { upTo: 223_340, rate: 0.178, k: 6_943 },
      { upTo: 285_319, rate: 0.198, k: 11_410 },
      { upTo: 570_638, rate: 0.208, k: 14_263 },
      { upTo: 1_141_275, rate: 0.213, k: 17_117 },
      { upTo: null, rate: 0.218, k: 22_823 },
    ],
    bpa: 11_188,
    meta: VERIFIED,
  },
  NS: {
    province: 'NS', year: 2026, lowestRate: 0.0879,
    brackets: [
      { upTo: 30_995, rate: 0.0879, k: 0 },
      { upTo: 61_991, rate: 0.1495, k: 1_909 },
      { upTo: 97_417, rate: 0.1667, k: 2_976 },
      { upTo: 157_124, rate: 0.175, k: 3_784 },
      { upTo: null, rate: 0.21, k: 9_283 },
    ],
    // 2026: BPANS set at the maximum for all employees (income-tested formula removed).
    bpa: 11_932,
    meta: VERIFIED,
  },
  NT: {
    province: 'NT', year: 2026, lowestRate: 0.059,
    brackets: [
      { upTo: 53_003, rate: 0.059, k: 0 },
      { upTo: 106_009, rate: 0.086, k: 1_431 },
      { upTo: 172_346, rate: 0.122, k: 5_247 },
      { upTo: null, rate: 0.1405, k: 8_436 },
    ],
    bpa: 18_198,
    meta: VERIFIED,
  },
  NU: {
    province: 'NU', year: 2026, lowestRate: 0.04,
    brackets: [
      { upTo: 55_801, rate: 0.04, k: 0 },
      { upTo: 111_602, rate: 0.07, k: 1_674 },
      { upTo: 181_439, rate: 0.09, k: 3_906 },
      { upTo: null, rate: 0.115, k: 8_442 },
    ],
    bpa: 19_659,
    meta: VERIFIED,
  },
  ON: {
    province: 'ON', year: 2026, lowestRate: 0.0505,
    brackets: [
      { upTo: 53_891, rate: 0.0505, k: 0 },
      { upTo: 107_785, rate: 0.0915, k: 2_210 },
      { upTo: 150_000, rate: 0.1116, k: 4_376 },
      { upTo: 220_000, rate: 0.1216, k: 5_876 },
      { upTo: null, rate: 0.1316, k: 8_076 },
    ],
    bpa: 12_989,
    surtax: [
      { over: 5_818, rate: 0.20 },
      { over: 7_446, rate: 0.36 },
    ],
    // ON tax reduction S = lesser of (T4+V1) and 2 × 300 − (T4+V1); Y dependant add-on not modelled.
    ontarioTaxReduction: { base: 300 },
    // V2 health premium: statutory bands, premium = min(cap, base + rate × (A − over)).
    healthPremiumBands: [
      { over: 0, base: 0, rate: 0, cap: 0 },
      { over: 20_000, base: 0, rate: 0.06, cap: 300 },
      { over: 36_000, base: 300, rate: 0.06, cap: 450 },
      { over: 48_000, base: 450, rate: 0.25, cap: 600 },
      { over: 72_000, base: 600, rate: 0.25, cap: 750 },
      { over: 200_000, base: 750, rate: 0.25, cap: 900 },
    ],
    meta: VERIFIED,
  },
  PE: {
    province: 'PE', year: 2026, lowestRate: 0.095,
    // No indexation in PE; 4th threshold/KP carry CRA's May-2026 update.
    brackets: [
      { upTo: 33_928, rate: 0.095, k: 0 },
      { upTo: 65_820, rate: 0.1347, k: 1_347 },
      { upTo: 106_890, rate: 0.166, k: 3_407 },
      { upTo: 142_520, rate: 0.1762, k: 4_497 },
      { upTo: null, rate: 0.19, k: 6_464 },
    ],
    bpa: 15_000,
    meta: VERIFIED,
  },
  QC: {
    province: 'QC', year: 2026, lowestRate: 0.14,
    // QC constants are Revenu Québec's printed K values from
    // TP-1015.F-V (2026-01) §2.1.1 — Quebec is not in T4127 Table 8.1.
    brackets: [
      { upTo: 54_345, rate: 0.14, k: 0 },
      { upTo: 108_680, rate: 0.19, k: 2_717 },
      { upTo: 132_245, rate: 0.24, k: 8_151 },
      { upTo: null, rate: 0.2575, k: 10_465 },
    ],
    bpa: 18_952,
    meta: VERIFIED,
  },
  SK: {
    province: 'SK', year: 2026, lowestRate: 0.105,
    brackets: [
      { upTo: 54_532, rate: 0.105, k: 0 },
      { upTo: 155_805, rate: 0.125, k: 1_091 },
      { upTo: null, rate: 0.145, k: 4_207 },
    ],
    // Saskatchewan Affordability Act: +$500/yr on top of indexation through 2028.
    bpa: 20_381,
    meta: VERIFIED,
  },
  YT: {
    province: 'YT', year: 2026, lowestRate: 0.064,
    brackets: [
      { upTo: 58_523, rate: 0.064, k: 0 },
      { upTo: 117_045, rate: 0.09, k: 1_522 },
      { upTo: 181_440, rate: 0.109, k: 3_745 },
      { upTo: 500_000, rate: 0.128, k: 7_193 },
      { upTo: null, rate: 0.15, k: 18_193 },
    ],
    // BPAYT = BPAF (mirrors the federal income-tested formula).
    bpa: { max: 16_452, min: 14_829, phaseOutStart: 181_440, phaseOutEnd: 258_482 },
    // Yukon is the only jurisdiction with a provincial CEA credit (K4P).
    cea: 1_501,
    meta: VERIFIED,
  },
};
