import {
  PERIODS_PER_YEAR,
  TaxEngineError,
  ZERO_YTD,
  type PayInput,
} from '../types';
import { clamp, roundCent } from '../money';
import { getTables } from '../data/index';
import { calcCpp, maxCpp2Contribution, maxCppContribution } from './cpp';
import { calcEi, eiRateFor, maxEiPremium } from './ei';
import {
  annualFederalTax,
  annualProvincialTax,
  cppDeductionF5,
  creditBases,
  type AnnualTaxContext,
} from './income-tax';

export interface BonusInput extends PayInput {
  /** Bonus, retro pay, or other non-periodic payment paid this period (factor B). */
  bonusAmount: number;
  /** Prior non-periodic payments this year (factor B1), gross. */
  ytdBonuses?: number;
}

export interface BonusResult {
  bonus: number;
  bonusCpp: number;
  bonusCpp2: number;
  bonusEi: number;
  bonusFederalTax: number;
  bonusProvincialTax: number;
  totalDeductions: number;
  netBonus: number;
  warnings: string[];
}

/**
 * T4127 bonus method: tax on B = annual tax at (A + B-net-of-F5) minus annual tax
 * at A, withheld in full (not divided by P). CPP applies with no per-period
 * exemption (the exemption is consumed by regular pay); EI applies at the normal
 * rate. Documented deviation from the T4127 worked example: CRA prorates the
 * period CPP exemption across regular pay and bonus; we allocate it entirely to
 * regular pay — total withholding matches within rounding.
 */
export function calculateBonus(input: BonusInput): BonusResult {
  const B = input.bonusAmount;
  if (!Number.isFinite(B) || B <= 0) {
    throw new TaxEngineError(`bonusAmount must be a positive number, got ${B}`);
  }
  const gross = input.grossPeriodIncome;
  if (!Number.isFinite(gross) || gross < 0) {
    throw new TaxEngineError(`grossPeriodIncome must be a non-negative number, got ${gross}`);
  }

  const P = PERIODS_PER_YEAR[input.frequency];
  const tables = getTables(input.payDate);
  const prov = tables.provinces[input.province];
  if (!prov) throw new TaxEngineError(`Unknown province "${input.province}"`);
  const ytd = input.ytd ?? ZERO_YTD;
  const cppT = tables.cpp;
  const eiT = tables.ei;
  const warnings: string[] = [];

  // Regular-period CPP/EI establish the baseline (exemption + remaining caps).
  const regularCpp = calcCpp(gross, P, ytd, cppT, input.cppExempt ?? false);
  const regularEi = calcEi(gross, input.province, ytd, eiT, input.eiExempt ?? false);

  // CPP on the bonus: no per-period exemption, capped by remaining annual room.
  let bonusCpp = 0;
  let bonusCpp2 = 0;
  if (!(input.cppExempt ?? false)) {
    bonusCpp = roundCent(cppT.employeeRate * B);
    bonusCpp = Math.min(
      bonusCpp,
      Math.max(0, roundCent(maxCppContribution(cppT) - ytd.cpp - regularCpp.cpp)),
    );
    const baseEarnings = ytd.pensionableEarnings + gross;
    const cpp2Earnings =
      clamp(baseEarnings + B, cppT.ympe, cppT.yampe) - clamp(baseEarnings, cppT.ympe, cppT.yampe);
    bonusCpp2 = roundCent(cppT.cpp2Rate * cpp2Earnings);
    bonusCpp2 = Math.min(
      bonusCpp2,
      Math.max(0, roundCent(maxCpp2Contribution(cppT) - ytd.cpp2 - regularCpp.cpp2)),
    );
  }

  // EI on the bonus: insurable up to the remaining MIE room after regular pay.
  let bonusEi = 0;
  if (!(input.eiExempt ?? false)) {
    const insurableRoom = Math.max(0, eiT.maxInsurableEarnings - ytd.insurableEarnings - gross);
    bonusEi = roundCent(eiRateFor(input.province, eiT) * Math.min(B, insurableRoom));
    bonusEi = Math.min(
      bonusEi,
      Math.max(0, roundCent(maxEiPremium(input.province, eiT) - ytd.ei - regularEi.ei)),
    );
  }

  // Annual income without (A1) and with (A2) the bonus, each net of its F5.
  const periodDeductions = input.periodDeductions ?? 0;
  const annualDeductions = input.annualDeductions ?? 0;
  const f5Regular = cppDeductionF5(regularCpp.cpp, regularCpp.cpp2, cppT);
  const f5Bonus = cppDeductionF5(bonusCpp, bonusCpp2, cppT);
  const A1 = Math.max(
    0,
    P * (gross - periodDeductions - f5Regular) - annualDeductions + (input.ytdBonuses ?? 0),
  );
  const A2 = A1 + Math.max(0, B - f5Bonus);

  // Credits held identical on both sides of the difference (they cancel).
  const ctx: AnnualTaxContext = {
    fed: tables.federal,
    prov,
    ...creditBases(regularCpp.cpp, regularEi.ei, P, input.province, cppT, eiT),
    annualDeductions,
    federalClaim: input.federalClaim,
    provincialClaim: input.provincialClaim,
  };

  const bonusFederalTax = roundCent(
    Math.max(0, annualFederalTax(A2, ctx) - annualFederalTax(A1, ctx)),
  );
  const bonusProvincialTax = roundCent(
    Math.max(0, annualProvincialTax(A2, ctx) - annualProvincialTax(A1, ctx)),
  );

  if (!tables.federal.meta.verified || !prov.meta.verified) {
    warnings.push('Tax tables for this pay date are UNVERIFIED — not for live payroll.');
  }
  for (const note of prov.notes ?? []) warnings.push(note);

  const totalDeductions = roundCent(
    bonusCpp + bonusCpp2 + bonusEi + bonusFederalTax + bonusProvincialTax,
  );

  return {
    bonus: roundCent(B),
    bonusCpp,
    bonusCpp2,
    bonusEi,
    bonusFederalTax,
    bonusProvincialTax,
    totalDeductions,
    netBonus: roundCent(B - totalDeductions),
    warnings,
  };
}
