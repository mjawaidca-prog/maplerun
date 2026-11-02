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
 *
 * When the bracket carries CRA's published constant (T4127 Table 8.1 K/KP;
 * TP-1015.F K for Quebec), it is used verbatim: CRA publishes the constants
 * rounded to whole dollars and PDOC computes with those values. Deriving
 * K from the thresholds instead (K_i = K_{i-1} + (rate_i − rate_{i-1}) ×
 * lowerThreshold_i) drifts up to ~$0.50/yr from the published figure, which
 * surfaced as 1–2¢ per-period residuals against PDOC in the Wave 4 Phase 0
 * cross-check (defect D6). Brackets without a published constant (the
 * unpublished 2027 tables) still derive from thresholds.
 */
export function bracketFor(brackets: TaxBracket[], annualIncome: number): { rate: number; k: number } {
  if (brackets.length === 0) throw new TaxEngineError('Empty bracket table');
  let k = 0;
  let prev: TaxBracket = brackets[0]!;
  for (const b of brackets) {
    k += (b.rate - prev.rate) * (prev.upTo ?? 0);
    if (b.upTo === null || annualIncome <= b.upTo) {
      return { rate: b.rate, k: b.k ?? k };
    }
    prev = b;
  }
  return { rate: prev.rate, k: prev.k ?? k };
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

/**
 * Annualized, capped K2 credit bases (base-rate CPP portion + EI premiums).
 *
 * YTD-aware (Wave 4 Phase 0 defect D1): T4127 option 1 annualizes the
 * current period's contributions (P × C), but once an employee's actual
 * year-to-date contributions exceed that annualized figure — the normal
 * case after the CPP/EI caps are reached, when the current period's
 * contribution is small or zero — PDOC credits the ACTUAL annual amounts.
 * The credit base is therefore the greater of the annualized current
 * period and (YTD + current period), capped at the statutory maximum
 * credit base. This is T4127's own Step 2 direction: "use the greater
 * of i) (P × C × (base rate/total contribution rate)) or (P × EI) and
 * ii) D or D1 for all pay periods", replacing the annualized amount by
 * the maximum annual contribution once a cap is reached. Proven against
 * PDOC to the cent in Phase 0 scenarios S5 (YTD at both caps) and S7
 * (EI at the cap, partial current period).
 */
export function creditBases(
  cpp: number,
  ei: number,
  periodsPerYear: number,
  province: ProvinceCode,
  cppT: CppTable,
  eiT: EiTable,
  ytd?: { cpp: number; ei: number },
): { annualCppCredit: number; annualEiCredit: number } {
  const baseFraction = cppT.baseRate / cppT.employeeRate;
  const maxBaseCpp = (cppT.ympe - cppT.basicExemption) * cppT.baseRate;
  const maxEi = eiT.maxInsurableEarnings * eiRateFor(province, eiT);
  const annualCpp = Math.max(periodsPerYear * cpp, (ytd?.cpp ?? 0) + cpp);
  const annualEi = Math.max(periodsPerYear * ei, (ytd?.ei ?? 0) + ei);
  return {
    annualCppCredit: Math.min(annualCpp * baseFraction, maxBaseCpp),
    annualEiCredit: Math.min(annualEi, maxEi),
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
  /**
   * Year-to-date CPP (first tier) and EI deducted BEFORE this period.
   * Feeds the YTD-aware K2 credit bases (defect D1); omit for a
   * first-period employee (equivalent to zeros).
   */
  ytd?: { cpp: number; ei: number };
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
    ...creditBases(input.cpp, input.ei, P, prov.province, cppT, eiT, input.ytd),
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
