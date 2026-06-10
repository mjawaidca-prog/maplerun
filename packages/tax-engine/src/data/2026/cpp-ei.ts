import type { CppTable, EiTable } from '../../types';

/**
 * CPP for 2026. YMPE/YAMPE announced by CRA Nov 2025.
 * Max employee contribution: (74,900 − 3,500) × 5.95% = $4,248.30.
 * Max CPP2: (85,400 − 74,900) × 4% = $420.00.
 */
export const CPP_2026: CppTable = {
  year: 2026,
  ympe: 74_900,
  yampe: 85_400,
  basicExemption: 3_500,
  employeeRate: 0.0595,
  baseRate: 0.0495,
  cpp2Rate: 0.04,
  meta: {
    verified: false,
    source:
      'Model knowledge of CRA Nov-2025 announcement. YAMPE rounding uncertain (85,400 vs 85,300) — VERIFY.',
    lastReviewed: '2026-06-10',
  },
};

/**
 * EI for 2026 (CEIC announcement Sept 2025).
 * Max employee premium: 68,500 × 1.63% = $1,116.55 (QC: 1.30% = $890.50).
 */
export const EI_2026: EiTable = {
  year: 2026,
  maxInsurableEarnings: 68_500,
  employeeRate: 0.0163,
  employeeRateQuebec: 0.013,
  employerMultiple: 1.4,
  meta: {
    verified: false,
    source:
      'Model knowledge of CEIC Sept-2025 rate setting. QC rate medium confidence — VERIFY.',
    lastReviewed: '2026-06-10',
  },
};
