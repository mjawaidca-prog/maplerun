import type { FederalTable } from '../../types';

/**
 * Federal income tax, 2026 (T4127 121st edition, effective 2026-01-01).
 * Lowest rate 14% (legislated cut from 15% → 14.5% effective 2025 → 14% for 2026).
 * Thresholds = 2025 values × 1.02 indexation.
 */
export const FEDERAL_2026: FederalTable = {
  year: 2026,
  edition: 'T4127 121st ed. (Jan 2026)',
  lowestRate: 0.14,
  brackets: [
    { upTo: 58_523, rate: 0.14 },
    { upTo: 117_045, rate: 0.205 },
    { upTo: 181_440, rate: 0.26 },
    { upTo: 258_482, rate: 0.29 },
    { upTo: null, rate: 0.33 },
  ],
  // BPAF phases from max down to min across the fourth bracket.
  bpa: { max: 16_452, min: 14_829, phaseOutStart: 181_440, phaseOutEnd: 258_482 },
  cea: 1_500,
  meta: {
    verified: false,
    source:
      'Model knowledge of T4127 121st ed.: 2026 indexation 2.0% on 2025 values; 14% lowest rate per 2025 legislation. VERIFY against published T4127 before live use.',
    lastReviewed: '2026-06-10',
  },
};
