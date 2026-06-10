import {
  TaxEngineError,
  type CppTable,
  type DynamicBpa,
  type EiTable,
  type FederalTable,
  type HealthPremiumBand,
  type ProvincialTable,
  type TaxBracket,
} from '../types';
import { roundCent } from '../money';
import { eiRateFor } from './ei';

/**
 * Rate R and cumulative constant K for an annual income within a bracket set.
 * K_i = K_{i-1} + (rate_i − rate_{i-1}) × lowerThreshold_i, computed exactly from thresholds.
 */
export function bracketFor(brackets: TaxBracket[], annualIncome: number): { rate: number; k: number } {
  if (brackets.length === 0) throw new TaxEngineError('Empty bracket table');
  let k = 0;
  let prev: TaxBracket = brackets[0]!;
  for (const b of brackets) {
    k += (b.rate - prev.rate) * (prev.upTo ?? 0);
    if (b.upTo === null || annualIncome <= b.upTo) return { rate: b.rate, k };
    prev = b;
  }
  // Unreachable when the table ends with upTo: null, but keeps TS satisfied.
  return { rate: prev.rate, k };
}

/** Income-tested BPA (federal/Yukon): max below phase-out, linear to min across it. */
export function dynamicBpa(cfg: DynamicBpa, annualIncome: number): number {
  if (annualIncome <= cfg.phaseOutStart) return cfg.max;
  if (annualIncome >= cfg.phaseOutEnd) return cfg.min;
  const fraction = (annualIncome - cfg.phaseOutStart) / (cfg.phaseOutEnd - cfg.phaseOutStart);
  return roundCent(cfg.max - fraction * (cfg.max - cfg.min));
}

/** Ontario health premium: last applicable band, min(cap, base + rate × excess). */
export function healthPremium(bands: HealthPremiumBand[], annualIncome: number): number {
  let applicable = bands[0]!;
  for (const band of bands) {
    if (annualIncome > band.over) applicable = band;
  }
  return roundCent(
    Math.min(applicable.cap, applicable.base + applicable.rate * (annualIncome - applicable.over)),
  );
}

export interface IncomeTaxInput {
  grossPeriodIncome: number;
  periodDeductions: number;
  annualDeductions: number;
  periodsPerYear: number;
  cpp: number;
  cpp2: number;
  ei: number;
  federalClaim?: number;
  provincialClaim?: number;
}

export interface IncomeTaxResult {
  federalPeriod: number;
  provincialPeriod: number;
  annualTaxableIncome: number;
}

/**
 * T4127 option 1 (annualized). Credits (K1/K2/K4) at the lowest rate; CPP credit is the
 * base-rate share only — the enhancement and all of CPP2 are deductions via F5.
 */
export function calcIncomeTax(
  input: IncomeTaxInput,
  fed: FederalTable,
  prov: ProvincialTable,
  cppT: CppTable,
  eiT: EiTable,
): IncomeTaxResult {
  if (prov.notImplemented) {
    throw new TaxEngineError(
      `${prov.province} provincial income tax is not implemented yet (see roadmap Phase 2).`,
    );
  }

  const P = input.periodsPerYear;

  // F5: CPP enhancement portion of C, plus all of CPP2 — deducted from income.
  const enhancementFraction = (cppT.employeeRate - cppT.baseRate) / cppT.employeeRate;
  const f5 = roundCent(input.cpp * enhancementFraction + input.cpp2);

  const A = Math.max(
    0,
    P * (input.grossPeriodIncome - input.periodDeductions - f5) - input.annualDeductions,
  );

  // Annualized credit bases shared by K2 and K2P.
  const baseFraction = cppT.baseRate / cppT.employeeRate;
  const maxBaseCpp = (cppT.ympe - cppT.basicExemption) * cppT.baseRate;
  const maxEi = eiT.maxInsurableEarnings * eiRateFor(prov.province, eiT);
  const annualCppCredit = Math.min(P * input.cpp * baseFraction, maxBaseCpp);
  const annualEiCredit = Math.min(P * input.ei, maxEi);

  // Federal: T3 = R×A − K − K1 − K2 − K4
  const { rate: R, k: K } = bracketFor(fed.brackets, A);
  const TC = input.federalClaim ?? dynamicBpa(fed.bpa, A);
  const K1 = fed.lowestRate * TC;
  const K2 = fed.lowestRate * (annualCppCredit + annualEiCredit);
  const K4 = fed.lowestRate * Math.min(A, fed.cea);
  const annualFederal = Math.max(0, R * A - K - K1 - K2 - K4);

  // Provincial: T4 = V×A − KP − K1P − K2P (+ surtax + health premium)
  const { rate: V, k: KP } = bracketFor(prov.brackets, A);
  const TCP =
    input.provincialClaim ?? (typeof prov.bpa === 'number' ? prov.bpa : dynamicBpa(prov.bpa, A));
  const K1P = prov.lowestRate * TCP;
  const K2P = prov.lowestRate * (annualCppCredit + annualEiCredit);
  let annualProvincial = Math.max(0, V * A - KP - K1P - K2P);

  if (prov.surtax) {
    let surtax = 0;
    for (const tier of prov.surtax) {
      surtax += tier.rate * Math.max(0, annualProvincial - tier.over);
    }
    annualProvincial += surtax;
  }
  if (prov.healthPremiumBands) {
    annualProvincial += healthPremium(prov.healthPremiumBands, A);
  }

  return {
    federalPeriod: roundCent(annualFederal / P),
    provincialPeriod: roundCent(annualProvincial / P),
    annualTaxableIncome: roundCent(A),
  };
}
