/**
 * Quebec provincial income tax (TP-1015.F), QPIP premiums, and federal abatement.
 *
 * QC uses Revenu Québec formulas, not T4127 provincial formulas.
 * Quebec income tax follows TP-1015.F-V §2.1.1 verbatim (regular payments):
 *   Step 1: I = P × (G − F − H − CSA) − J − J1        (annual taxable income)
 *   Step 2: Y = T × I − K − K1 − 0.14 × E − 0.15 × P × Q − 0.15 × P × Q1
 *   Step 3: per-period withholding = Y ÷ P (+ L, handled by the caller)
 * There is NO QPP/QPIP non-refundable credit in the Quebec formula — an
 * earlier implementation invented K2P/K3P credits and omitted the H
 * deduction for workers, under-withholding ~$87/month at a $5,400 monthly
 * salary (Wave 4 Phase 0 defect D2, proven against WebRAS).
 * Federal abatement: T1 = T3 − 16.5% × T3 for QC residents.
 * QPP replaces CPP; QPIP is an additional payroll deduction.
 *
 * Source: Revenu Québec TP-1015.F-V (2026-01) §2.1.1. Verified constants
 * in data/2026/quebec.ts and the QC table in data/2026/provinces.ts.
 */

import { TaxEngineError, type CppTable, type ProvincialTable } from '../types';
import { roundCent } from '../money';
import { bracketFor } from './income-tax';
import { QC_TAX_2026 } from '../data/2026/quebec';

// ---------------------------------------------------------------------------
// QPP (Quebec Pension Plan)
// ---------------------------------------------------------------------------

/**
 * QPP mirrors CPP's formula but at 6.30% employee rate (5.30% base).
 * Parameters come from QPP_2026 (same YMPE/YAMPE structure as CPP).
 */
export function calcQpp(
  grossPeriodIncome: number,
  periodsPerYear: number,
  ytdPensionable: number,
  ytdCpp: number,
  ytdCpp2: number,
  qppTable: CppTable,
  exempt: boolean,
): { qpp: number; qpp2: number; pensionableEarnings: number } {
  if (exempt) return { qpp: 0, qpp2: 0, pensionableEarnings: 0 };

  const P = periodsPerYear;
  const exemptionPerPeriod = qppTable.basicExemption / P;
  const pensionable = Math.max(0, grossPeriodIncome - exemptionPerPeriod);

  // First-tier QPP
  const remainingRoom = qppTable.ympe - ytdPensionable;
  const cappedPensionable = Math.min(pensionable, Math.max(0, remainingRoom));
  let qpp = roundCent(cappedPensionable * qppTable.employeeRate);
  const qppCapRemaining = roundCent(
    (qppTable.ympe - qppTable.basicExemption) * qppTable.employeeRate - ytdCpp,
  );
  qpp = Math.min(qpp, Math.max(0, qppCapRemaining));

  // Second-tier QPP2 (same 4% rate as CPP2, between YMPE and YAMPE)
  let qpp2 = 0;
  const cumulativeAfter = ytdPensionable + cappedPensionable;
  if (cumulativeAfter > qppTable.ympe) {
    const qpp2Earnings = Math.min(
      cumulativeAfter - qppTable.ympe,
      qppTable.yampe - Math.max(ytdPensionable, qppTable.ympe),
    );
    qpp2 = roundCent(Math.max(0, qpp2Earnings) * qppTable.cpp2Rate);
    const qpp2CapRemaining = roundCent(
      (qppTable.yampe - qppTable.ympe) * qppTable.cpp2Rate - ytdCpp2,
    );
    qpp2 = Math.min(qpp2, Math.max(0, qpp2CapRemaining));
  }

  return { qpp, qpp2, pensionableEarnings: roundCent(cappedPensionable) };
}

/**
 * QPP employee-only version; employer matches 1:1.
 */
export function maxQppContribution(qppTable: CppTable): number {
  return roundCent((qppTable.ympe - qppTable.basicExemption) * qppTable.employeeRate);
}

export function maxQpp2Contribution(qppTable: CppTable): number {
  return roundCent((qppTable.yampe - qppTable.ympe) * qppTable.cpp2Rate);
}

// ---------------------------------------------------------------------------
// QPIP (Quebec Parental Insurance Plan)
// ---------------------------------------------------------------------------

export interface QpipTable {
  year: number;
  maxInsurableEarnings: number;
  employeeRate: number;
  employerRate: number;
  maxEmployeePremium: number;
  maxEmployerPremium: number;
}

export function calcQpip(
  grossPeriodIncome: number,
  ytdInsurableEarnings: number,
  ytdQpip: number,
  qpipTable: QpipTable,
): { qpip: number; insurableEarnings: number } {
  const remainingInsurable = Math.max(0, qpipTable.maxInsurableEarnings - ytdInsurableEarnings);
  const insurable = Math.min(grossPeriodIncome, remainingInsurable);
  let qpip = roundCent(insurable * qpipTable.employeeRate);
  const remaining = Math.max(0, qpipTable.maxEmployeePremium - ytdQpip);
  qpip = Math.min(qpip, remaining);
  return { qpip, insurableEarnings: roundCent(insurable) };
}

export function maxQpipPremium(qpipTable: QpipTable): number {
  return qpipTable.maxEmployeePremium;
}

// ---------------------------------------------------------------------------
// Quebec provincial income tax (TP-1015.F §2.1.1 — regular payments)
// ---------------------------------------------------------------------------

/** Inputs for the TP-1015.F §2.1.1 regular-payments formula. */
export interface QuebecTaxInput {
  /** G — gross remuneration subject to QC source deductions for the pay
   *  period (earnings + taxable benefits, excl. lump sums). Also D, the
   *  base of the deduction for workers. */
  grossPeriodIncome: number;
  /** F — per-period amounts that reduce QC taxable income (RPP/RRSP/VRSP/
   *  FHSA contributions, union-dues-type deductions resolved by the caller). */
  periodDeductions: number;
  /** C — employee QPP contribution for the period (base + first additional). */
  qpp: number;
  /** C2 — second additional employee QPP contribution for the period. */
  qpp2: number;
  /** P — number of pay periods in the year. */
  periodsPerYear: number;
  /** J — annual deductions shown on line 19 of form TP-1015.3-V.
   *  (J1, deductions authorized by Revenu Québec on form TP-1016-V, is
   *  not modelled — the app carries a single annual-deductions amount.) */
  annualDeductions?: number;
  /** E — personal tax credits from form TP-1015.3-V (line 10 total).
   *  Defaults to the Quebec basic personal amount. */
  provincialClaim?: number;
}

/**
 * TP-1015.F-V §2.1.1 annual Quebec income tax Y (steps 1–2; the caller
 * divides by P for the per-period withholding, step 3).
 *
 * Step 1 — annual taxable income:
 *   I = P × (G − F − H − CSA) − J − J1, floored at zero, where
 *   H   = deduction for workers = min(6% × D, $1,450 ÷ P) for 2026;
 *   CSA = deduction of additional QPP contributions = CS × (S3 − B2) ÷ S3
 *         with CS = C × (0.01 ÷ 0.0630) + C2. For regular payments B2 = 0,
 *         so CSA = CS; the rate share is (employeeRate − baseRate) ÷
 *         employeeRate taken from the QPP table (1.00 ÷ 6.30 for 2026).
 * Step 2 — income tax for the year:
 *   Y = T × I − K − K1 − (0.14 × E) − (0.15 × P × Q) − (0.15 × P × Q1),
 *   floored at zero. T and K are Revenu Québec's printed rate/constant for
 *   the bracket of I (carried on the QC table's brackets). K1 (credits
 *   authorized on form TP-1016-V) and Q/Q1 (labour-sponsored fund
 *   withholdings — FTQ / Fondaction) are not modelled and enter as zero.
 *
 * Source: Revenu Québec, TP-1015.F-V (2026-01), §2.1.1.
 */
export function annualQuebecTax(
  input: QuebecTaxInput,
  prov: ProvincialTable,
  qppTable: CppTable,
): number {
  if (prov.province !== 'QC') {
    throw new TaxEngineError('annualQuebecTax requires a QC provincial table');
  }

  const P = input.periodsPerYear;

  // Step 1 — I (annual taxable income).
  const H = Math.min(
    QC_TAX_2026.workerDeductionRate * input.grossPeriodIncome,
    QC_TAX_2026.workerDeductionMax / P,
  );
  const additionalShare =
    (qppTable.employeeRate - qppTable.baseRate) / qppTable.employeeRate;
  const CSA = input.qpp * additionalShare + input.qpp2;
  const I = Math.max(
    0,
    P * (input.grossPeriodIncome - input.periodDeductions - H - CSA) -
      (input.annualDeductions ?? 0),
  );

  // Step 2 — Y (income tax for the year). K1 = 0 and Q = Q1 = 0 (not modelled).
  const { rate: T, k: K } = bracketFor(prov.brackets, I);
  const E =
    input.provincialClaim ?? (typeof prov.bpa === 'number' ? prov.bpa : 0);
  return Math.max(0, T * I - K - QC_TAX_2026.personalCreditRate * E);
}

// ---------------------------------------------------------------------------
// Federal abatement for Quebec residents
// ---------------------------------------------------------------------------

/** Apply the 16.5% federal abatement: T1 = T3 × (1 − 0.165). */
export function applyFederalAbatement(federalTaxT3: number): number {
  return roundCent(federalTaxT3 * (1 - 0.165));
}
