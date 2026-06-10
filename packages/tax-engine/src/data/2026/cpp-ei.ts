import type { CppTable, EiTable } from '../../types';

/**
 * CPP for 2026 — VERIFIED against T4127 121st ed. Tables 8.3–8.6 and CRA's
 * CPP rates page (docs/sources/cra-cpp.html, cra-t4127.html).
 * Max employee contribution: (74,600 − 3,500) × 5.95% = $4,230.45 (base share $3,519.45).
 * CPP2: (85,000 − 74,600) × 4% = $416.00.
 */
export const CPP_2026: CppTable = {
  year: 2026,
  ympe: 74_600,
  yampe: 85_000,
  basicExemption: 3_500,
  employeeRate: 0.0595,
  baseRate: 0.0495,
  cpp2Rate: 0.04,
  meta: {
    verified: true,
    source: 'CRA T4127 121st ed. Tables 8.3–8.6 (YMPE 74,600; YAMPE 85,000; max 4,230.45; CPP2 max 416.00).',
    lastReviewed: '2026-06-10',
  },
};

/**
 * EI for 2026 — VERIFIED against T4127 121st ed. Table 8.7 and CRA's EI
 * premium-rates page (docs/sources/cra-ei.html).
 * Max employee premium: 68,900 × 1.63% = $1,123.07 (QC: 1.30% = $895.70).
 */
export const EI_2026: EiTable = {
  year: 2026,
  maxInsurableEarnings: 68_900,
  employeeRate: 0.0163,
  employeeRateQuebec: 0.013,
  employerMultiple: 1.4,
  meta: {
    verified: true,
    source: 'CRA T4127 121st ed. Table 8.7 (MIE 68,900; 1.63%/1.30% QC; employer 1.4× = 2.282%).',
    lastReviewed: '2026-06-10',
  },
};
