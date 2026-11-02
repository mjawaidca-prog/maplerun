/**
 * Workers' compensation premium ESTIMATE.
 *
 * Workers'-comp rates are set by each provincial board (WSIB in Ontario,
 * WorkSafeBC, WCB Alberta, CNESST in Quebec, etc.) per industry
 * classification and experience rating. This product deliberately does NOT
 * hardcode them — the employer enters the rate from their board statement.
 * This is a budgeting estimate, not a filing amount.
 */
import { roundCent } from '../money';
import { TaxEngineError } from '../types';
import type { ProvinceCode } from '../types';

export interface WcbEstimateInput {
  province?: ProvinceCode; // for labelling only — NO rate tables are encoded
  assessableEarnings: number; // earnings for the period (or year) being estimated
  ratePer100: number; // employer-entered board rate, $ per $100 of assessable earnings
  maxAssessableEarnings?: number; // employer-entered annual cap for the province/class, if any
}

export interface WcbEstimateResult {
  assessableEarnings: number;
  cappedEarnings: number;
  premium: number; // cappedEarnings * ratePer100 / 100, roundCent
  warnings: string[]; // ALWAYS includes an estimate-only warning
}

const ESTIMATE_WARNING =
  'Estimate only: this workers\' compensation premium is a budgeting estimate based on the employer-entered rate and is not a filing amount. Confirm the rate, classification and assessable-earnings cap on your provincial board statement.';

export function estimateWcbPremium(input: WcbEstimateInput): WcbEstimateResult {
  if (!Number.isFinite(input.assessableEarnings) || input.assessableEarnings < 0) {
    throw new TaxEngineError('assessableEarnings must be a non-negative number');
  }
  if (!Number.isFinite(input.ratePer100) || input.ratePer100 < 0) {
    throw new TaxEngineError('ratePer100 must be a non-negative number');
  }
  if (
    input.maxAssessableEarnings !== undefined &&
    (!Number.isFinite(input.maxAssessableEarnings) || input.maxAssessableEarnings < 0)
  ) {
    throw new TaxEngineError('maxAssessableEarnings must be a non-negative number');
  }

  const warnings: string[] = [ESTIMATE_WARNING];

  let cappedEarnings = input.assessableEarnings;
  if (
    input.maxAssessableEarnings !== undefined &&
    input.assessableEarnings > input.maxAssessableEarnings
  ) {
    cappedEarnings = input.maxAssessableEarnings;
    warnings.push(
      'Maximum assessable earnings cap applied: assessable earnings exceed the employer-entered cap, so the premium is calculated on the capped amount.',
    );
  }

  const premium = roundCent((cappedEarnings * input.ratePer100) / 100);

  return {
    assessableEarnings: input.assessableEarnings,
    cappedEarnings,
    premium,
    warnings,
  };
}
