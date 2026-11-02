/**
 * Ontario Employer Health Tax (EHT) calculator.
 *
 * Verified against the Ontario government's Employer Health Tax page:
 * https://www.ontario.ca/document/employer-health-tax-eht
 * (Government of Ontario / Ministry of Finance), verified 2026-11-02.
 * The graduated rate table, the $1,000,000 exemption and the
 * $5,000,000 exemption ceiling below match that official page as of
 * the verification date. The rate is determined by TOTAL Ontario
 * remuneration before deducting any exemption.
 */
import { roundCent } from '../money';
import { TaxEngineError } from '../types';

export const ONTARIO_EHT_EXEMPTION_LIMIT = 1_000_000; // eligible employers, Ontario payroll <= $5M
export const ONTARIO_EHT_EXEMPTION_PAYROLL_CEILING = 5_000_000;

export function ontarioEhtRate(totalOntarioRemuneration: number): number {
  if (!Number.isFinite(totalOntarioRemuneration) || totalOntarioRemuneration < 0) {
    throw new TaxEngineError('totalOntarioRemuneration must be a non-negative number');
  }
  if (totalOntarioRemuneration <= 200_000) return 0.0098;
  if (totalOntarioRemuneration <= 230_000) return 0.01101;
  if (totalOntarioRemuneration <= 260_000) return 0.01223;
  if (totalOntarioRemuneration <= 290_000) return 0.01344;
  if (totalOntarioRemuneration <= 320_000) return 0.01465;
  if (totalOntarioRemuneration <= 350_000) return 0.01586;
  if (totalOntarioRemuneration <= 380_000) return 0.01708;
  if (totalOntarioRemuneration <= 400_000) return 0.01829;
  return 0.0195;
}

export interface OntarioEhtInput {
  totalOntarioRemuneration: number; // total annual Ontario remuneration (all employees)
  exemption?: number; // this employer's allocated share of the $1M exemption; default 1_000_000
  eligibleForExemption?: boolean; // default true; false for e.g. public-sector / ineligible employers
}

export interface OntarioEhtResult {
  totalRemuneration: number;
  exemptionApplied: number;
  taxableRemuneration: number; // max(0, payroll - exemptionApplied)
  rate: number; // graduated rate from TOTAL remuneration (before exemption)
  eht: number; // taxableRemuneration * rate, roundCent
  warnings: string[];
}

const ASSOCIATED_EMPLOYER_WARNING =
  'Associated employers must share and allocate the $1,000,000 EHT exemption; the exemption entered is treated as this employer\'s allocated share of that exemption.';

export function calcOntarioEht(input: OntarioEhtInput): OntarioEhtResult {
  if (!Number.isFinite(input.totalOntarioRemuneration) || input.totalOntarioRemuneration < 0) {
    throw new TaxEngineError('totalOntarioRemuneration must be a non-negative number');
  }
  if (
    input.exemption !== undefined &&
    (!Number.isFinite(input.exemption) || input.exemption < 0)
  ) {
    throw new TaxEngineError('exemption must be a non-negative number');
  }

  const totalRemuneration = input.totalOntarioRemuneration;
  const rate = ontarioEhtRate(totalRemuneration);
  const warnings: string[] = [];

  let exemptionApplied: number;
  if (totalRemuneration > ONTARIO_EHT_EXEMPTION_PAYROLL_CEILING) {
    exemptionApplied = 0;
    warnings.push(
      'No EHT exemption applied: total Ontario remuneration exceeds $5,000,000, so the employer is not eligible for the $1,000,000 exemption.',
    );
  } else if (input.eligibleForExemption === false) {
    exemptionApplied = 0;
    warnings.push(
      'No EHT exemption applied: this employer is not eligible for the exemption.',
    );
  } else {
    exemptionApplied = Math.min(
      input.exemption ?? ONTARIO_EHT_EXEMPTION_LIMIT,
      ONTARIO_EHT_EXEMPTION_LIMIT,
    );
    warnings.push(ASSOCIATED_EMPLOYER_WARNING);
  }

  const taxableRemuneration = Math.max(0, totalRemuneration - exemptionApplied);
  const eht = roundCent(taxableRemuneration * rate);

  return {
    totalRemuneration,
    exemptionApplied,
    taxableRemuneration,
    rate,
    eht,
    warnings,
  };
}
