import type { CppTable, EmployeeYtd } from '../types';
import { clamp, roundCent } from '../money';

export interface CppResult {
  cpp: number;
  cpp2: number;
  pensionableEarnings: number;
}

/** Maximum annual employee first-tier CPP contribution. */
export function maxCppContribution(t: CppTable): number {
  return roundCent((t.ympe - t.basicExemption) * t.employeeRate);
}

/** Maximum annual employee CPP2 contribution. */
export function maxCpp2Contribution(t: CppTable): number {
  return roundCent((t.yampe - t.ympe) * t.cpp2Rate);
}

/**
 * Decimal-safe cent rounding for premium components.
 *
 * The exact decimal product rate × (pensionable − exemption) can land
 * exactly on a half-cent — e.g. QPP on $4,800 monthly:
 * (4800 − 3500/12) × 6.30% = 284.025 exactly — but binary floating point
 * evaluates it a hair below (284.02499999999998), so a plain Math.round
 * drops the cent that PDOC/WebRAS, computing in decimal, round up
 * (Wave 4 defect W4-D2(b), Prairie Peak proof run). The 1e-9-dollar
 * epsilon (a ten-millionth of a cent) is orders of magnitude below any
 * genuine sub-half distance these cent-denominated inputs and 4–5
 * decimal rates can produce, so it only ever corrects representation
 * error, never a real amount.
 */
function roundPremium(n: number): number {
  return Math.round((n + 1e-9) * 100) / 100;
}

/**
 * Per-period CPP and CPP2 (T4127 method).
 * First tier: rate × (pensionable − exemption/P), capped by remaining annual room.
 * CPP2: 4% of the slice of cumulative pensionable earnings between YMPE and YAMPE.
 *
 * `vacationPensionable` (Wave 4 defect W4-D2(a)): the vacation-pay
 * component of `pensionable`, when the caller knows it. PDOC prices CPP
 * on vacation pay as a SEPARATE component with NO basic exemption —
 * the exemption applies once, to the regular component — and rounds
 * each component to cents before summing:
 *   Doyle (AB monthly, regular 5,760 + vacation 230.40): PDOC 339.08
 *     = round(5.95% × (5760 − 3500/12)) + round(5.95% × 230.40)
 *     = 325.37 + 13.71, where the lumped formula gives 339.07.
 *   Tyler (AB monthly, regular 1,760 + vacation 70.40): PDOC 91.56
 *     = 87.37 + 4.19, lumped 91.55.
 * With no vacation component the single-component formula applies.
 * CPP2 stays on the total pensionable (its YMPE/YAMPE slice is a
 * cumulative-earnings concept; no separate vacation treatment is known
 * or evidenced).
 */
export function calcCpp(
  pensionable: number,
  periodsPerYear: number,
  ytd: EmployeeYtd,
  t: CppTable,
  exempt: boolean,
  vacationPensionable = 0,
): CppResult {
  if (exempt || pensionable <= 0) {
    return { cpp: 0, cpp2: 0, pensionableEarnings: Math.max(0, pensionable) };
  }

  // The per-period exemption is carried EXACTLY (basicExemption / P) and
  // only the contribution outputs are rounded. Rounding the exemption to
  // cents first (roundCent(3500/12) = 291.67 instead of 291.6667) cost a
  // cent on monthly QPP against Revenu Québec/PDOC — Wave 4 Phase 0
  // defect D5 (S3: $321.82 vs the oracle's $321.83).
  const periodExemption = t.basicExemption / periodsPerYear;
  const vac = Math.min(Math.max(0, vacationPensionable), pensionable);
  let cpp: number;
  if (vac > 0) {
    const regularComponent = roundPremium(
      t.employeeRate * Math.max(0, pensionable - vac - periodExemption),
    );
    const vacationComponent = roundPremium(t.employeeRate * vac);
    cpp = roundPremium(regularComponent + vacationComponent);
  } else {
    cpp = roundPremium(t.employeeRate * Math.max(0, pensionable - periodExemption));
  }
  cpp = Math.min(cpp, Math.max(0, roundCent(maxCppContribution(t) - ytd.cpp)));

  const cpp2Earnings =
    clamp(ytd.pensionableEarnings + pensionable, t.ympe, t.yampe) -
    clamp(ytd.pensionableEarnings, t.ympe, t.yampe);
  let cpp2 = roundPremium(t.cpp2Rate * cpp2Earnings);
  cpp2 = Math.min(cpp2, Math.max(0, roundCent(maxCpp2Contribution(t) - ytd.cpp2)));

  return { cpp, cpp2, pensionableEarnings: pensionable };
}
