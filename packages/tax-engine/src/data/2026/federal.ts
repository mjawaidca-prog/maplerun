import type { FederalTable } from '../../types';

/**
 * Federal income tax, 2026 — VERIFIED against T4127 121st ed. (Jan 2026),
 * Table 8.1/8.2 and BPAF formula. Source saved: docs/sources/cra-t4127.html.
 * CRA published K constants (0 / 3,804 / 10,241 / 15,685 / 26,024) match the
 * engine's cumulative derivation within $0.50/yr.
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
  // BPAF formula: 16,452 − (NI − 181,440) × (1,623 / 77,042), bounded [14,829, 16,452].
  bpa: { max: 16_452, min: 14_829, phaseOutStart: 181_440, phaseOutEnd: 258_482 },
  cea: 1_501,
  meta: {
    verified: true,
    source: 'CRA T4127 121st ed. (Jan 2026): Table 8.1 (R/K), Table 8.2 (CEA 1,501, index 2.0%), BPAF formula ch. 2.',
    lastReviewed: '2026-06-10',
  },
};
