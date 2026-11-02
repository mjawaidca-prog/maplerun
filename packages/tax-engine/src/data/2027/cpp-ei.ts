import type { CppTable, EiTable } from '../../types';

/**
 * CPP for 2027 — PARTIALLY VERIFIED / NOT YET CONFIRMED FOR PAYROLL USE.
 *
 * YMPE/YAMPE are OFFICIAL: CRA "MP, DB, RRSP, DPSP, and TFSA limits, the
 * YMPE and the YAMPE" page, 2027 row (YMPE 76,700; YAMPE 87,400).
 *
 * The derived maximums are arithmetic, not CRA-printed:
 * (76,700 − 3,500) × 5.75% = $4,209.00 and
 * (87,400 − 76,700) × 4% = $428.00.
 *
 * The 5.75% rate (base 4.75%) is legislated by Bill C-30 (S.C. 2026, c. 22,
 * royal assent June 18, 2026) but comes into force by order in council and
 * had NOT been confirmed on CRA payroll pages or T4127 as of 2026-11-02.
 * T4127 January 2027 edition (124th) is unpublished.
 */
export const CPP_2027: CppTable = {
  year: 2027,
  ympe: 76_700,
  yampe: 87_400,
  basicExemption: 3_500,
  employeeRate: 0.0575,
  baseRate: 0.0475,
  cpp2Rate: 0.04,
  meta: {
    verified: false,
    source:
      'YMPE/YAMPE are OFFICIAL (CRA "MP, DB, RRSP, DPSP, and TFSA limits, the YMPE and the YAMPE" page, 2027 row: YMPE 76,700; YAMPE 87,400); derived maximums (76,700-3,500) x 5.75% = $4,209.00 and (87,400-76,700) x 4% = $428.00 are arithmetic, not CRA-printed; the 5.75% rate (base 4.75%) is legislated by Bill C-30 (S.C. 2026, c. 22, royal assent June 18, 2026) but comes into force by order in council and had NOT been confirmed on CRA payroll pages or T4127 as of 2026-11-02; T4127 January 2027 edition (124th) is unpublished.',
    lastReviewed: '2026-11-02',
  },
};

/**
 * EI for 2027 — VERIFIED against the Canada Employment Insurance Commission
 * news release, Sept 14, 2026.
 * Max employee premium: 70,800 × 1.64% = $1,161.12; Quebec 70,800 × 1.29% = $913.32.
 * Employer rate 2.30% (QC 1.81%) — employerMultiple 1.4 × employee rate.
 */
export const EI_2027: EiTable = {
  year: 2027,
  maxInsurableEarnings: 70_800,
  employeeRate: 0.0164,
  employeeRateQuebec: 0.0129,
  employerMultiple: 1.4,
  meta: {
    verified: true,
    source:
      'Canada Employment Insurance Commission news release, Sept 14, 2026 (2027 EI premium rate; MIE $70,800; 1.64%; Quebec 1.29%).',
    lastReviewed: '2026-11-02',
  },
};
