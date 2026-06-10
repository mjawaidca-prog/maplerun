import type { CppTable, TableMeta } from '../../types';

/**
 * Quebec constants for 2026, captured during the T4127 verification sweep.
 * Used in Phase 2 when QC payroll lands (QPP/QPIP deductions + the federal
 * calculation differences for QC employees). QC provincial income tax itself
 * follows Revenu Québec TP-1015.3 / WebRAS, not T4127.
 */

const META: TableMeta = {
  verified: true,
  source: 'CRA T4127 121st ed. Tables 8.3–8.6 (QPP), 8.8 (QPIP), 8.2 (abatement).',
  lastReviewed: '2026-06-10',
};

/** QPP mirrors CPP's YMPE/YAMPE but at a 6.30% total rate (5.30% base) for 2026. */
export const QPP_2026: CppTable = {
  year: 2026,
  ympe: 74_600,
  yampe: 85_000,
  basicExemption: 3_500,
  employeeRate: 0.063,
  baseRate: 0.053,
  cpp2Rate: 0.04,
  meta: META,
};

/** Quebec Parental Insurance Plan, 2026. Premiums apply to all QC insurable earnings. */
export const QPIP_2026 = {
  year: 2026,
  maxInsurableEarnings: 103_000,
  employeeRate: 0.0043,
  employerRate: 0.00602,
  maxEmployeePremium: 442.9,
  maxEmployerPremium: 620.06,
  meta: META,
} as const;

/** Federal tax abatement for Quebec employees: T1 = T3 − 16.5% × T3. */
export const QC_FEDERAL_ABATEMENT = 0.165;
