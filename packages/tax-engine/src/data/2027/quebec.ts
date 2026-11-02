import type { CppTable, TableMeta } from '../../types';

/**
 * Quebec constants for 2027 — PLACEHOLDERS ONLY, NOT FOR LIVE PAYROLL.
 *
 * 2027 QPP and QPIP parameters had NOT been published by Retraite Québec /
 * Revenu Québec as of 2026-11-02 (official pages list 2026 as current;
 * QPP's 2026 base rate itself came from a one-year suspension of the
 * automatic rate rule, so 2027 is genuinely undetermined).
 *
 * These are 2026 carry-forward PLACEHOLDERS for shape only — NOT FOR LIVE
 * PAYROLL. Replace every value with the published 2027 Retraite Québec /
 * Revenu Québec parameters and set meta.verified to true once they appear.
 */

const META: TableMeta = {
  verified: false,
  source:
    'PLACEHOLDER — NOT FOR LIVE PAYROLL: 2027 QPP and QPIP parameters had NOT been published by Retraite Québec / Revenu Québec as of 2026-11-02 (official pages list 2026 as current; QPP\'s 2026 base rate itself came from a one-year suspension of the automatic rate rule, so 2027 is genuinely undetermined); these are 2026 carry-forward placeholders for shape only.',
  lastReviewed: '2026-11-02',
};

/** QPP 2027 PLACEHOLDER — carries forward the 2026 values (74,600 / 85,000 / 6.30% total, 5.30% base). NOT FOR LIVE PAYROLL. */
export const QPP_2027: CppTable = {
  year: 2027,
  ympe: 74_600,
  yampe: 85_000,
  basicExemption: 3_500,
  employeeRate: 0.063,
  baseRate: 0.053,
  cpp2Rate: 0.04,
  meta: META,
};

/** QPIP 2027 PLACEHOLDER — carries forward the 2026 values. NOT FOR LIVE PAYROLL. */
export const QPIP_2027 = {
  year: 2027,
  maxInsurableEarnings: 103_000,
  employeeRate: 0.0043,
  employerRate: 0.00602,
  maxEmployeePremium: 442.9,
  maxEmployerPremium: 620.06,
  meta: META,
};
