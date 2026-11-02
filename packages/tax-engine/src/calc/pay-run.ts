import {
  PERIODS_PER_YEAR,
  TaxEngineError,
  ZERO_YTD,
  type FederalTable,
  type PayInput,
  type PayResult,
} from '../types';
import { roundCent } from '../money';
import { getTables } from '../data/index';
import { QPP_2026, QPIP_2026 } from '../data/2026/quebec';
import { calcCpp } from './cpp';
import { calcEi } from './ei';
import { resolveDeductions } from './deductions';
import {
  calcIncomeTax,
  cppDeductionF5,
  annualFederalTax,
  dynamicBpa,
  bracketFor,
} from './income-tax';
import {
  calcQpp,
  calcQpip,
  annualQuebecTax,
  applyFederalAbatement,
} from './quebec-tax';

/** Full statutory deduction calculation for one employee, one pay period. */
export function calculatePay(input: PayInput): PayResult {
  const gross = input.grossPeriodIncome;
  if (!Number.isFinite(gross) || gross < 0) {
    throw new TaxEngineError(`grossPeriodIncome must be a non-negative number, got ${gross}`);
  }
  // Wave 3 B6 — named deductions resolve per base; the legacy bare
  // number keeps meaning factor F (taxable base only).
  const deductions = resolveDeductions(input.periodDeductions);
  const periodDeductions = deductions.taxable;
  const annualDeductions = input.annualDeductions ?? 0;
  if (annualDeductions < 0) {
    throw new TaxEngineError('Deductions cannot be negative');
  }
  const taxableBenefits = input.taxableBenefits ?? 0;
  if (!Number.isFinite(taxableBenefits) || taxableBenefits < 0) {
    throw new TaxEngineError(`taxableBenefits must be a non-negative number, got ${taxableBenefits}`);
  }
  const extraTax = input.extraTaxPerPeriod ?? 0;
  if (!Number.isFinite(extraTax) || extraTax < 0) {
    throw new TaxEngineError(`extraTaxPerPeriod must be a non-negative number, got ${extraTax}`);
  }
  // Statutory bases (Wave 3 B6): CPP/EI/tax see gross + non-cash
  // taxable benefits, minus any deductions flagged for that base.
  // Cash gross itself never changes.
  const pensionableBase = Math.max(0, gross + taxableBenefits - deductions.pensionable);
  const insurableBase = Math.max(0, gross + taxableBenefits - deductions.insurable);
  const taxableGross = gross + taxableBenefits;

  const P = PERIODS_PER_YEAR[input.frequency];
  if (!P) throw new TaxEngineError(`Unknown pay frequency "${input.frequency}"`);

  const tables = getTables(input.payDate);
  const prov = tables.provinces[input.province];
  if (!prov) throw new TaxEngineError(`Unknown province "${input.province}"`);

  const ytd = input.ytd ?? ZERO_YTD;
  const warnings: string[] = [];
  const isQC = input.province === 'QC';

  // ── CPP/QPP ──────────────────────────────────────────────────────────────
  // Quebec uses QPP (6.30%) instead of CPP (5.95%). Same formula, different table.
  const cppTable = isQC ? QPP_2026 : tables.cpp;
  const cppRes = calcCpp(pensionableBase, P, ytd, cppTable, input.cppExempt ?? false);

  // ── EI (QC gets reduced rate) + QPIP (QC only) ───────────────────────────
  const eiRes = calcEi(insurableBase, input.province, ytd, tables.ei, input.eiExempt ?? false);
  let qpipRes = { qpip: 0, insurableEarnings: 0 };
  if (isQC && !(input.eiExempt ?? false)) {
    qpipRes = calcQpip(insurableBase, ytd.insurableEarnings, 0, QPIP_2026);
  }

  // ── Income tax ───────────────────────────────────────────────────────────
  let federalTax: number;
  let provincialTax: number;
  let annualTaxableIncome: number;

  if (isQC) {
    // Quebec provincial tax via TP-1015.3, NOT T4127 provincial formulas.
    const f5 = cppDeductionF5(cppRes.cpp, cppRes.cpp2, cppTable);
    const A = Math.max(0, P * (taxableGross - periodDeductions - f5) - annualDeductions);

    // K2 credit bases: QPP base fraction + EI (QC-reduced rate)
    const baseQppFraction = cppTable.baseRate / cppTable.employeeRate;
    const maxBaseQpp = (cppTable.ympe - cppTable.basicExemption) * cppTable.baseRate;
    const annualCppCredit = Math.min(P * cppRes.cpp * baseQppFraction, maxBaseQpp);
    const annualEiCredit = Math.min(
      P * eiRes.ei,
      tables.ei.maxInsurableEarnings * tables.ei.employeeRateQuebec,
    );

    // Federal tax T3 on A (pre-abatement)
    const fedRaw = computeFederalTax(
      A, tables.federal, annualDeductions, annualCppCredit, annualEiCredit, input.federalClaim,
    );

    // Apply 16.5% federal abatement for QC residents
    federalTax = roundCent(applyFederalAbatement(fedRaw) / P);

    // QC provincial tax via TP-1015.3
    provincialTax = roundCent(
      annualQuebecTax(
        A, prov, cppRes.cpp, qpipRes.qpip, P, cppTable, QPIP_2026, input.provincialClaim,
      ) / P,
    );
    annualTaxableIncome = roundCent(A);
  } else {
    // Standard T4127 path for all non-QC provinces
    const tax = calcIncomeTax(
      {
        grossPeriodIncome: taxableGross,
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
      cppTable,
      tables.ei,
    );
    federalTax = tax.federalPeriod;
    provincialTax = tax.provincialPeriod;
    annualTaxableIncome = tax.annualTaxableIncome;
  }

  // Wave 3 B6 — TD1 additional tax per period (TD1 line 2): a flat
  // amount the employee asked to have withheld, added to federal tax
  // after the T4127 computation (both the standard and QC paths).
  if (extraTax > 0) {
    federalTax = roundCent(federalTax + extraTax);
  }

  // ── Verification warnings ────────────────────────────────────────────────
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

  // ── Totals ───────────────────────────────────────────────────────────────
  const totalDeductions = roundCent(
    cppRes.cpp + cppRes.cpp2 + eiRes.ei + qpipRes.qpip + federalTax + provincialTax,
  );
  const employerEi = roundCent(eiRes.ei * tables.ei.employerMultiple);
  const employerQpip = isQC
    ? roundCent(qpipRes.qpip * QPIP_2026.employerRate / QPIP_2026.employeeRate)
    : 0;

  return {
    gross: roundCent(gross),
    taxableBenefits: roundCent(taxableBenefits),
    cpp: cppRes.cpp,
    cpp2: cppRes.cpp2,
    ei: eiRes.ei,
    qpip: qpipRes.qpip,
    federalTax,
    provincialTax,
    totalDeductions,
    netPay: roundCent(gross - totalDeductions),
    annualTaxableIncome,
    employer: {
      cpp: cppRes.cpp,
      cpp2: cppRes.cpp2,
      ei: roundCent(employerEi + employerQpip),
      total: roundCent(cppRes.cpp + cppRes.cpp2 + employerEi + employerQpip),
    },
    newYtd: {
      pensionableEarnings: roundCent(ytd.pensionableEarnings + cppRes.pensionableEarnings),
      cpp: roundCent(ytd.cpp + cppRes.cpp),
      cpp2: roundCent(ytd.cpp2 + cppRes.cpp2),
      insurableEarnings: roundCent(ytd.insurableEarnings + eiRes.insurableEarnings + qpipRes.insurableEarnings),
      ei: roundCent(ytd.ei + eiRes.ei + qpipRes.qpip),
    },
    warnings,
  };
}

/** Compute annual federal tax T3 inline (avoids circular imports). */
function computeFederalTax(
  A: number,
  fed: FederalTable,
  annualDeductions: number,
  annualCppCredit: number,
  annualEiCredit: number,
  federalClaim?: number,
): number {
  const { rate: R, k: K } = bracketFor(fed.brackets, A);
  const NI = A + annualDeductions;
  const TC = federalClaim ?? dynamicBpa(fed.bpa, NI);
  const K1 = fed.lowestRate * TC;
  const K2 = fed.lowestRate * (annualCppCredit + annualEiCredit);
  const K4 = fed.lowestRate * Math.min(A, fed.cea);
  return Math.max(0, R * A - K - K1 - K2 - K4);
}
