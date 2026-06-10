import {
  PERIODS_PER_YEAR,
  TaxEngineError,
  ZERO_YTD,
  type PayInput,
  type PayResult,
} from '../types';
import { roundCent } from '../money';
import { getTables } from '../data/index';
import { calcCpp } from './cpp';
import { calcEi } from './ei';
import { calcIncomeTax } from './income-tax';

/** Full statutory deduction calculation for one employee, one pay period. */
export function calculatePay(input: PayInput): PayResult {
  const gross = input.grossPeriodIncome;
  if (!Number.isFinite(gross) || gross < 0) {
    throw new TaxEngineError(`grossPeriodIncome must be a non-negative number, got ${gross}`);
  }
  const periodDeductions = input.periodDeductions ?? 0;
  const annualDeductions = input.annualDeductions ?? 0;
  if (periodDeductions < 0 || annualDeductions < 0) {
    throw new TaxEngineError('Deductions cannot be negative');
  }

  const P = PERIODS_PER_YEAR[input.frequency];
  if (!P) throw new TaxEngineError(`Unknown pay frequency "${input.frequency}"`);

  const tables = getTables(input.payDate);
  const prov = tables.provinces[input.province];
  if (!prov) throw new TaxEngineError(`Unknown province "${input.province}"`);

  const ytd = input.ytd ?? ZERO_YTD;
  const warnings: string[] = [];

  const cppRes = calcCpp(gross, P, ytd, tables.cpp, input.cppExempt ?? false);
  const eiRes = calcEi(gross, input.province, ytd, tables.ei, input.eiExempt ?? false);

  const tax = calcIncomeTax(
    {
      grossPeriodIncome: gross,
      periodDeductions,
      annualDeductions,
      periodsPerYear: P,
      cpp: cppRes.cpp,
      cpp2: cppRes.cpp2,
      ei: eiRes.ei,
      federalClaim: input.federalClaim,
      provincialClaim: input.provincialClaim,
    },
    tables.federal,
    prov,
    tables.cpp,
    tables.ei,
  );

  if (!tables.federal.meta.verified) {
    warnings.push(`Federal ${tables.federal.year} table is UNVERIFIED — not for live payroll.`);
  }
  if (!tables.cpp.meta.verified || !tables.ei.meta.verified) {
    warnings.push(`CPP/EI ${tables.cpp.year} tables are UNVERIFIED — not for live payroll.`);
  }
  if (!prov.meta.verified) {
    warnings.push(`${prov.province} ${prov.year} table is UNVERIFIED — not for live payroll.`);
  }
  for (const note of prov.notes ?? []) warnings.push(note);

  const totalDeductions = roundCent(
    cppRes.cpp + cppRes.cpp2 + eiRes.ei + tax.federalPeriod + tax.provincialPeriod,
  );
  const employerEi = roundCent(eiRes.ei * tables.ei.employerMultiple);

  return {
    gross: roundCent(gross),
    cpp: cppRes.cpp,
    cpp2: cppRes.cpp2,
    ei: eiRes.ei,
    federalTax: tax.federalPeriod,
    provincialTax: tax.provincialPeriod,
    totalDeductions,
    netPay: roundCent(gross - totalDeductions),
    annualTaxableIncome: tax.annualTaxableIncome,
    employer: {
      cpp: cppRes.cpp,
      cpp2: cppRes.cpp2,
      ei: employerEi,
      total: roundCent(cppRes.cpp + cppRes.cpp2 + employerEi),
    },
    newYtd: {
      pensionableEarnings: roundCent(ytd.pensionableEarnings + cppRes.pensionableEarnings),
      cpp: roundCent(ytd.cpp + cppRes.cpp),
      cpp2: roundCent(ytd.cpp2 + cppRes.cpp2),
      insurableEarnings: roundCent(ytd.insurableEarnings + eiRes.insurableEarnings),
      ei: roundCent(ytd.ei + eiRes.ei),
    },
    warnings,
  };
}
