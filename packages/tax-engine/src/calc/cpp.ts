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
 * Per-period CPP and CPP2 (T4127 method).
 * First tier: rate × (pensionable − exemption/P), capped by remaining annual room.
 * CPP2: 4% of the slice of cumulative pensionable earnings between YMPE and YAMPE.
 */
export function calcCpp(
  pensionable: number,
  periodsPerYear: number,
  ytd: EmployeeYtd,
  t: CppTable,
  exempt: boolean,
): CppResult {
  if (exempt || pensionable <= 0) {
    return { cpp: 0, cpp2: 0, pensionableEarnings: Math.max(0, pensionable) };
  }

  const periodExemption = roundCent(t.basicExemption / periodsPerYear);
  let cpp = roundCent(t.employeeRate * Math.max(0, pensionable - periodExemption));
  cpp = Math.min(cpp, Math.max(0, roundCent(maxCppContribution(t) - ytd.cpp)));

  const cpp2Earnings =
    clamp(ytd.pensionableEarnings + pensionable, t.ympe, t.yampe) -
    clamp(ytd.pensionableEarnings, t.ympe, t.yampe);
  let cpp2 = roundCent(t.cpp2Rate * cpp2Earnings);
  cpp2 = Math.min(cpp2, Math.max(0, roundCent(maxCpp2Contribution(t) - ytd.cpp2)));

  return { cpp, cpp2, pensionableEarnings: pensionable };
}
