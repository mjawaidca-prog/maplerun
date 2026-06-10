import {
  TaxEngineError,
  type CppTable,
  type DynamicBpa,
  type EiTable,
  type FederalTable,
  type HealthPremiumBand,
  type ProvinceCode,
  type ProvincialTable,
  type TaxBracket,
} from '../types';
import { roundCent } from '../money';
import { eiRateFor } from './ei';

/**
 * Rate R and cumulative constant K for an annual income within a bracket set.
 * K_i = K_{i-1} + (rate_i − rate_{i-1}) × lowerThreshold_i, computed exactly from
 * thresholds. Verified: matches every CRA-published 2026 K/KP constant within $0.50.
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
  return { rate: prev.rate, k };
}

/** Income-tested BPA (BPAF/BPAMB/BPAYT): max below phase-out, linear to min across it. Takes NI = A + HD. */
export function dynamicBpa(cfg: DynamicBpa, netIncome: number): number {
  if (netIncome <= cfg.phaseOutStart) return cfg.max;
  if (netIncome >= cfg.phaseOutEnd) return cfg.min;
  const fraction = (netIncome - cfg.phaseOutStart) / (cfg.phaseOutEnd - cfg.phaseOutStart);
  return roundCent(cfg.max - fraction * (cfg.max - cfg.min));
}

/** Ontario health premium (V2): last applicable band, min(cap, base + rate × excess). */
export function healthPremium(bands: HealthPremiumBand[], annualIncome: number): number {
  let applicable = bands[0]!;
  for (const band of bands) {
    if (annualIncome > band.over) applicable = band;
  }
  return roundCent(
    Math.min(applicable.cap, applicable.base + applicable.rate * (annualIncome - applicable.over)),
  );
}

/** Inputs shared by the annual federal/provincial tax functions (and the bonus method). */
export interface AnnualTaxContext {
  fed: FederalTable;
  prov: ProvincialTable;
  /** Annualized creditable base-CPP contributions, capped (K2 component). */
  annualCppCredit: number;
  /** Annualized EI premiums, capped (K2 component). */
  annualEiCredit: number;
  /** HD — added back to A to form NI for income-tested BPAs. */
  annualDeductions: number;
  federalClaim?: number;
  provincialClaim?: number;
}

/** Annual basic federal tax T3 = R×A − K − K1 − K2 − K4, floored at zero. */
export function annualFederalTax(A: number, ctx: AnnualTaxContext): number {
  const { rate: R, k: K } = bracketFor(ctx.fed.brackets, A);
  const NI = A + ctx.annualDeductions;
  const TC = ctx.federalClaim ?? dynamicBpa(ctx.fed.bpa, NI);
  const K1 = ctx.fed.lowestRate * TC;
  const K2 = ctx.fed.lowestRate * (ctx.annualCppCredit + ctx.annualEiCredit);
  const K4 = ctx.fed.lowestRate * Math.min(A, ctx.fed.cea);
  return Math.max(0, R * A - K - K1 - K2 - K4);
}

/**
 * Annual provincial/territorial tax T2 (except Quebec):
 * T4 = V×A − KP − K1P − K2P − K4P − K5P, then + surtax V1, − tax reduction S,
 * + ON health premium V2. Floored at zero.
 */
export function annualProvincialTax(A: number, ctx: AnnualTaxContext): number {
  const prov = ctx.prov;
  if (prov.notImplemented) {
    throw new TaxEngineError(
      `${prov.province} provincial income tax is not implemented yet (see roadmap Phase 2).`,
    );
  }

  const { rate: V, k: KP } = bracketFor(prov.brackets, A);
  const NI = A + ctx.annualDeductions;
  const TCP =
    ctx.provincialClaim ?? (typeof prov.bpa === 'number' ? prov.bpa : dynamicBpa(prov.bpa, NI));
  const K1P = prov.lowestRate * TCP;
  const K2P = prov.lowestRate * (ctx.annualCppCredit + ctx.annualEiCredit);
  const K4P = prov.cea ? prov.lowestRate * Math.min(A, prov.cea) : 0;

  let K5P = 0;
  if (prov.creditTopUp) {
    const firstBracketTax = prov.lowestRate * (prov.brackets[0]?.upTo ?? 0);
    K5P = Math.max(0, (K1P + K2P - firstBracketTax) * prov.creditTopUp.rate);
  }

  const T4 = Math.max(0, V * A - KP - K1P - K2P - K4P - K5P);

  let V1 = 0;
  if (prov.surtax) {
    for (const tier of prov.surtax) V1 += tier.rate * Math.max(0, T4 - tier.over);
  }

  let total = T4 + V1;

  if (prov.ontarioTaxReduction) {
    const S = Math.max(0, Math.min(total, 2 * prov.ontarioTaxReduction.base - total));
    total -= S;
  }
  if (prov.lowIncomeReduction) {
    const r = prov.lowIncomeReduction;
    const S =
      A > r.phaseOutEnd
        ? 0
        : Math.min(total, Math.max(0, r.max - r.phaseOutRate * Math.max(0, A - r.phaseOutStart)));
    total -= S;
  }
  if (prov.healthPremiumBands) {
    total += healthPremium(prov.healthPremiumBands, A);
  }

  return Math.max(0, total);
}

/** F5: CPP first-enhancement share of C plus all of CPP2 — an income deduction, not a credit. */
export function cppDeductionF5(cpp: number, cpp2: number, cppT: CppTable): number {
  const enhancementFraction = (cppT.employeeRate - cppT.baseRate) / cppT.employeeRate;
  return roundCent(cpp * enhancementFraction + cpp2);
}

/** Annualized, capped K2 credit bases from this period's CPP/EI deductions. */
export function creditBases(
  cpp: number,
  ei: number,
  periodsPerYear: number,
  province: ProvinceCode,
  cppT: CppTable,
  eiT: EiTable,
): { annualCppCredit: number; annualEiCredit: number } {
  const baseFraction = cppT.baseRate / cppT.employeeRate;
  const maxBaseCpp = (cppT.ympe - cppT.basicExemption) * cppT.baseRate;
  const maxEi = eiT.maxInsurableEarnings * eiRateFor(province, eiT);
  return {
    annualCppCredit: Math.min(periodsPerYear * cpp * baseFraction, maxBaseCpp),
    annualEiCredit: Math.min(periodsPerYear * ei, maxEi),
  };
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

/** T4127 option 1 (annualized) per-period income tax. */
export function calcIncomeTax(
  input: IncomeTaxInput,
  fed: FederalTable,
  prov: ProvincialTable,
  cppT: CppTable,
  eiT: EiTable,
): IncomeTaxResult {
  const P = input.periodsPerYear;
  const f5 = cppDeductionF5(input.cpp, input.cpp2, cppT);
  const A = Math.max(
    0,
    P * (input.grossPeriodIncome - input.periodDeductions - f5) - input.annualDeductions,
  );

  const ctx: AnnualTaxContext = {
    fed,
    prov,
    ...creditBases(input.cpp, input.ei, P, prov.province, cppT, eiT),
    annualDeductions: input.annualDeductions,
    federalClaim: input.federalClaim,
    provincialClaim: input.provincialClaim,
  };

  return {
    federalPeriod: roundCent(annualFederalTax(A, ctx) / P),
    provincialPeriod: roundCent(annualProvincialTax(A, ctx) / P),
    annualTaxableIncome: roundCent(A),
  };
}
