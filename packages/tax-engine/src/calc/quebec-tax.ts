/**
 * Quebec provincial income tax (TP-1015.3), QPIP premiums, and federal abatement.
 *
 * QC uses Revenu Québec formulas, not T4127 provincial formulas. Key differences:
 *   - QC provincial tax: T = V × A − KP − K1P − K2P − K3P
 *   - K3P: 20% credit on QPP and QPIP contributions (unique to Quebec)
 *   - Federal abatement: T1 = T3 − 16.5% × T3 for QC residents
 *   - QPP replaces CPP; QPIP is an additional payroll deduction
 *
 * Source: TP-1015.3 (2026-01), Revenu Québec. Verified constants in data/2026/quebec.ts.
 */

import { TaxEngineError, type CppTable, type ProvincialTable } from '../types';
import { roundCent } from '../money';
import { bracketFor } from './income-tax';
import { eiRateFor, maxEiPremium as maxEiPremiumFn } from './ei';
import type { EiTable } from '../types';

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
// Quebec provincial income tax (TP-1015.3)
// ---------------------------------------------------------------------------

/**
 * TP-1015.3 annual Quebec provincial tax.
 * Formula: T = V × A − KP − K1P − K2P − K3P, floored at zero.
 *
 * K1P = V_lowest × TCP (QC BPA)
 * K2P = V_lowest × (QPP base credit + QPIP credit), capped
 * K3P = 20% × (QPP contributions + QPIP premiums)
 */
export function annualQuebecTax(
  A: number,
  prov: ProvincialTable,
  qppContrib: number,
  qpipContrib: number,
  periodsPerYear: number,
  qppTable: CppTable,
  qpipTable: QpipTable,
  provincialClaim?: number,
): number {
  if (prov.province !== 'QC') {
    throw new TaxEngineError('annualQuebecTax requires a QC provincial table');
  }

  const { rate: V, k: KP } = bracketFor(prov.brackets, A);
  const TCP = provincialClaim ?? (typeof prov.bpa === 'number' ? prov.bpa : 0);

  // K1P: lowest-rate credit on QC BPA
  const K1P = prov.lowestRate * TCP;

  // K2P: lowest-rate credit on QPP base + QPIP (annualized, capped)
  const baseQppFraction = qppTable.baseRate / qppTable.employeeRate;
  const annualQppBase = Math.min(
    periodsPerYear * qppContrib * baseQppFraction,
    (qppTable.ympe - qppTable.basicExemption) * qppTable.baseRate,
  );
  const annualQpipCredit = Math.min(periodsPerYear * qpipContrib, qpipTable.maxEmployeePremium);
  const K2P = prov.lowestRate * (annualQppBase + annualQpipCredit);

  // K3P: 20% credit on QPP + QPIP contributions (QC unique)
  const K3P = 0.20 * roundCent(periodsPerYear * (qppContrib + qpipContrib));

  return Math.max(0, V * A - KP - K1P - K2P - K3P);
}

// ---------------------------------------------------------------------------
// Federal abatement for Quebec residents
// ---------------------------------------------------------------------------

/** Apply the 16.5% federal abatement: T1 = T3 × (1 − 0.165). */
export function applyFederalAbatement(federalTaxT3: number): number {
  return roundCent(federalTaxT3 * (1 - 0.165));
}
