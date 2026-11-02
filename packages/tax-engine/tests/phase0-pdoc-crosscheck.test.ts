/**
 * Wave 4 — Phase 0 PDOC/WebRAS oracle cross-check. PERMANENT REGRESSION TEST
 * (committed with the Phase 0 tax-layer fix, Nov 2, 2026).
 *
 * Drives the SHIPPED calculation path exactly as apps/web assembles it
 * (apps/web/src/lib/actions/payroll.ts → computePayRun):
 *   regular  = calculatePay({ ...engineInput, grossPeriodIncome: gross + vacation })
 *   bonus    = calculateBonus({ ...engineInput, grossPeriodIncome: regularGross, bonusAmount })
 *              merged back with the app's own mergeBonusResult (copied verbatim below)
 *   QC bonus stays lumped in calculatePay (not exercised by the oracle set).
 *
 * Oracle: ~/workspace/nexvar-pay-versatility/pdoc-oracle.md — CRA PDOC
 * (version 2026-10-28) + Revenu Québec WebRAS for S3's Quebec lines.
 * Fixture TD1 claims (oracle discipline): federal $16,452; Alberta
 * $22,769; Ontario $12,989; Quebec TP-1015.3 basic $18,952 (WebRAS);
 * BC: no claim entered in PDOC → engine default (BC table BPA $13,216),
 * which is what the app passes when the TD1 carries the basic amount.
 * Employer EI 1.4×. No benefits/RRSP/dues; not exempt.
 *
 * ACCEPTED STANDARD (Muhammad's decision, Nov 2, 2026): the engine follows
 * the published T4127 / TP-1015.F formulas verbatim. Six scenarios assert
 * the PDOC/WebRAS oracle values at $0.00 tolerance. S4 (bonus) and S8
 * (retro) assert the engine's formula-faithful outputs instead: PDOC's
 * bonus/retro internals are unpublished, and T4127 itself states its
 * formulas are "generally more precise than those obtained by using PDOC"
 * — the documented residuals (S4 fed −0.02 / AB −0.01; S8 fed −0.01 /
 * AB −0.01) are accepted. Any drift beyond these encoded values fails.
 * Full analysis: ~/workspace/nexvar-pay-versatility/evidence/phase0-pdoc-crosscheck.md
 */
import { describe, it, expect } from 'vitest';
import { calculatePay, calculateBonus, ZERO_YTD } from '../src/index';
import type { PayInput, PayResult, BonusResult, EmployeeYtd } from '../src/index';

// ── apps/web mergeBonusResult, copied verbatim from
//    apps/web/src/lib/actions/payroll.ts (Wave 3 B6 wiring) ──────────────
function mergeBonusResult(regular: PayResult, bonus: BonusResult): PayResult {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const employerCpp = r2(regular.employer.cpp + bonus.bonusCpp);
  const employerCpp2 = r2(regular.employer.cpp2 + bonus.bonusCpp2);
  const employerEi = r2(regular.employer.ei + bonus.bonusEi * 1.4);
  return {
    gross: r2(regular.gross + bonus.bonus),
    taxableBenefits: regular.taxableBenefits ?? 0,
    cpp: r2(regular.cpp + bonus.bonusCpp),
    cpp2: r2(regular.cpp2 + bonus.bonusCpp2),
    ei: r2(regular.ei + bonus.bonusEi),
    qpip: regular.qpip,
    federalTax: r2(regular.federalTax + bonus.bonusFederalTax),
    provincialTax: r2(regular.provincialTax + bonus.bonusProvincialTax),
    totalDeductions: r2(regular.totalDeductions + bonus.totalDeductions),
    netPay: r2(regular.netPay + bonus.netBonus),
    annualTaxableIncome: regular.annualTaxableIncome,
    employer: {
      cpp: employerCpp,
      cpp2: employerCpp2,
      ei: employerEi,
      total: r2(employerCpp + employerCpp2 + employerEi),
    },
    newYtd: {
      pensionableEarnings: r2(regular.newYtd.pensionableEarnings + bonus.bonusPensionableEarnings),
      cpp: r2(regular.newYtd.cpp + bonus.bonusCpp),
      cpp2: r2(regular.newYtd.cpp2 + bonus.bonusCpp2),
      insurableEarnings: r2(regular.newYtd.insurableEarnings + bonus.bonusInsurableEarnings),
      ei: r2(regular.newYtd.ei + bonus.bonusEi),
    },
    warnings: [...regular.warnings, ...bonus.warnings],
  };
}

// ── The app's assembly: regular gross = gross + vacation payout;
//    a non-QC bonus/lump sum goes through calculateBonus and merges. ────
interface RunSpec {
  input: PayInput;
  vacationAmount?: number;
  bonusAmount?: number;
}
function runShippedPath(spec: RunSpec): { merged: PayResult; regular: PayResult; bonus?: BonusResult } {
  const regularGross = spec.input.grossPeriodIncome + (spec.vacationAmount ?? 0);
  const regular = calculatePay({ ...spec.input, grossPeriodIncome: regularGross });
  if (spec.bonusAmount && spec.bonusAmount > 0 && spec.input.province !== 'QC') {
    const bonus = calculateBonus({ ...spec.input, grossPeriodIncome: regularGross, bonusAmount: spec.bonusAmount });
    return { merged: mergeBonusResult(regular, bonus), regular, bonus };
  }
  return { merged: regular, regular };
}

const FED = 16_452;
const AB = 22_769;
const ON = 12_989;
const QC_TP = 18_952;

interface Expect {
  cpp: number; cpp2: number; ei: number; qpip?: number;
  federalTax: number; provincialTax: number; totalDeductions: number; netPay: number;
}

interface Scenario {
  id: string;
  label: string;
  spec: RunSpec;
  expect: Expect;
  /** Employer remittance total (employee deductions + employer CPP/CPP2/EI): PDOC's
   *  total for the oracle-exact scenarios; the accepted engine-derived total for S4/S8. */
  employerRemit?: number;
}

const S5_YTD: EmployeeYtd = {
  pensionableEarnings: 76_900, cpp: 4_230.45, cpp2: 92.0, insurableEarnings: 68_900, ei: 1_123.07,
};
const S7_YTD: EmployeeYtd = {
  pensionableEarnings: 67_500, cpp: 3_800.0, cpp2: 0, insurableEarnings: 67_500, ei: 1_100.25,
};

const SCENARIOS: Scenario[] = [
  {
    id: 'S1', label: 'AB biweekly 2026-01-16, salary $2,800, YTD 0',
    spec: { input: { payDate: '2026-01-16', province: 'AB', frequency: 'biweekly', grossPeriodIncome: 2800, federalClaim: FED, provincialClaim: AB, ytd: ZERO_YTD } },
    expect: { cpp: 158.59, cpp2: 0, ei: 45.64, federalTax: 301.04, provincialTax: 146.19, totalDeductions: 651.46, netPay: 2148.54 },
    employerRemit: 873.95,
  },
  {
    id: 'S2', label: 'ON biweekly 2026-01-16, $2,492 (80h×$28 + 6 OT h×$42), YTD 0',
    spec: { input: { payDate: '2026-01-16', province: 'ON', frequency: 'biweekly', grossPeriodIncome: 2492, federalClaim: FED, provincialClaim: ON, ytd: ZERO_YTD } },
    expect: { cpp: 140.26, cpp2: 0, ei: 40.62, federalTax: 241.03, provincialTax: 130.77, totalDeductions: 552.68, netPay: 1939.32 },
    employerRemit: 749.81,
  },
  {
    id: 'S3', label: 'QC monthly 2026-01-30, $5,400, YTD 0 (PDOC + WebRAS combined)',
    spec: { input: { payDate: '2026-01-30', province: 'QC', frequency: 'monthly', grossPeriodIncome: 5400, federalClaim: FED, provincialClaim: QC_TP, ytd: ZERO_YTD } },
    expect: { cpp: 321.83, cpp2: 0, ei: 70.2, qpip: 23.22, federalTax: 433.44, provincialTax: 545.81, totalDeductions: 1394.5, netPay: 4005.5 },
  },
  {
    // S4 — ACCEPTED RESIDUAL vs PDOC (Muhammad, Nov 2, 2026). The values
    // asserted below are the fixed engine's formula-faithful outputs, NOT
    // PDOC's. PDOC: fed 2318.08, AB 1129.07, total 4409.38, net 8390.62,
    // remit 5455.07. Deltas: fed −0.02, AB −0.01 (total −0.03). Reason:
    // PDOC's bonus internals are unpublished — its displayed "regular"
    // splits are residuals of its totals, not standalone calculations;
    // T4127's alternative F5A/F5B split lands +$0.20 (worse), and T4127
    // states its formulas are generally more precise than PDOC's. CPP/EI
    // match PDOC exactly. Drift beyond these values fails this test.
    id: 'S4', label: 'AB biweekly 2026-03-13, salary $2,800 + bonus $10,000, YTD 0 [accepted residual vs PDOC]',
    spec: { input: { payDate: '2026-03-13', province: 'AB', frequency: 'biweekly', grossPeriodIncome: 2800, federalClaim: FED, provincialClaim: AB, ytd: ZERO_YTD }, bonusAmount: 10_000 },
    expect: { cpp: 753.59, cpp2: 0, ei: 208.64, federalTax: 2318.06, provincialTax: 1129.06, totalDeductions: 4409.35, netPay: 8390.65 },
    employerRemit: 5455.04,
  },
  {
    id: 'S5', label: 'AB biweekly 2026-10-16, $4,500, YTD at CPP/EI caps',
    spec: { input: { payDate: '2026-10-16', province: 'AB', frequency: 'biweekly', grossPeriodIncome: 4500, federalClaim: FED, provincialClaim: AB, ytd: S5_YTD } },
    expect: { cpp: 0, cpp2: 180, ei: 0, federalTax: 617.62, provincialTax: 300.58, totalDeductions: 1098.2, netPay: 3401.8 },
    employerRemit: 1278.2,
  },
  {
    id: 'S6', label: 'ON biweekly 2026-01-16, salary $2,200 + vacation pay $1,760, YTD 0',
    spec: { input: { payDate: '2026-01-16', province: 'ON', frequency: 'biweekly', grossPeriodIncome: 2200, federalClaim: FED, provincialClaim: ON, ytd: ZERO_YTD }, vacationAmount: 1760 },
    expect: { cpp: 227.61, cpp2: 0, ei: 64.55, federalTax: 535.98, provincialTax: 271.61, totalDeductions: 1099.75, netPay: 2860.25 },
    employerRemit: 1417.73,
  },
  {
    id: 'S7', label: 'BC biweekly 2026-08-14, $3,000, YTD EI insurable $67,500 / CPP $3,800',
    spec: { input: { payDate: '2026-08-14', province: 'BC', frequency: 'biweekly', grossPeriodIncome: 3000, federalClaim: FED, ytd: S7_YTD } },
    expect: { cpp: 170.49, cpp2: 0, ei: 22.82, federalTax: 341.15, provincialTax: 156.39, totalDeductions: 690.85, netPay: 2309.15 },
    employerRemit: 893.29,
  },
  {
    // S8 — ACCEPTED RESIDUAL vs PDOC (Muhammad, Nov 2, 2026). The values
    // asserted below are the fixed engine's formula-faithful outputs, NOT
    // PDOC's. PDOC: fed 584.70, AB 284.52, total 1179.57, net 3020.43,
    // remit 1517.30. Deltas: fed −0.01, AB −0.01 (total −0.02). Reason:
    // the oracle was captured with PDOC's retroactive-pay option, which
    // spreads the $1,200 over the 6 periods it relates to; the shipped
    // path (the app folds retro into the bonus input) applies T4127's
    // one-shot bonus/retro formula — a method difference, not a formula
    // error. CPP/EI match PDOC exactly. Drift beyond these values fails.
    id: 'S8', label: 'AB biweekly 2026-05-08, salary $3,000 + retro $1,200 over 6 periods, YTD 0 [accepted residual vs PDOC]',
    spec: { input: { payDate: '2026-05-08', province: 'AB', frequency: 'biweekly', grossPeriodIncome: 3000, federalClaim: FED, provincialClaim: AB, ytd: ZERO_YTD }, bonusAmount: 1200 },
    expect: { cpp: 241.89, cpp2: 0, ei: 68.46, federalTax: 584.69, provincialTax: 284.51, totalDeductions: 1179.55, netPay: 3020.45 },
    employerRemit: 1517.28,
  },
];

describe('Wave 4 Phase 0 — PDOC/WebRAS oracle cross-check (permanent regression; S4/S8 assert accepted residuals)', () => {
  for (const s of SCENARIOS) {
    it(`${s.id} — ${s.label}`, () => {
      const { merged: r } = runShippedPath(s.spec);
      const e = s.expect;
      const remit = Math.round((r.totalDeductions + r.employer.cpp + r.employer.cpp2 + r.employer.ei) * 100) / 100;

      const rows: Array<[string, number, number]> = [
        [s.spec.input.province === 'QC' ? 'CPP/QPP' : 'CPP', e.cpp, r.cpp],
        [s.spec.input.province === 'QC' ? 'CPP2/QPP2' : 'CPP2', e.cpp2, r.cpp2],
        ['EI', e.ei, r.ei],
        ...(e.qpip !== undefined ? [['QPIP (employee)', e.qpip, r.qpip] as [string, number, number]] : []),
        ['Federal tax', e.federalTax, r.federalTax],
        ['Provincial tax', e.provincialTax, r.provincialTax],
        ['Total deductions', e.totalDeductions, r.totalDeductions],
        ['Net pay', e.netPay, r.netPay],
      ];
      const mismatches = rows
        .filter(([, exp, got]) => Math.round((got - exp) * 100) !== 0)
        .map(([name, exp, got]) => `${name}: expected ${exp.toFixed(2)}, engine ${got.toFixed(2)}, Δ ${(got - exp).toFixed(2)}`);
      if (s.employerRemit !== undefined && Math.round((remit - s.employerRemit) * 100) !== 0) {
        mismatches.push(`Employer remit total (informational): expected ${s.employerRemit.toFixed(2)}, engine-derived ${remit.toFixed(2)}, Δ ${(remit - s.employerRemit).toFixed(2)}`);
      }
      expect(mismatches, `${s.id} mismatches`).toEqual([]);
    });
  }
});
