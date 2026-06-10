import type { EiTable, EmployeeYtd, ProvinceCode } from '../types';
import { roundCent } from '../money';

export interface EiResult {
  ei: number;
  insurableEarnings: number;
}

export function eiRateFor(province: ProvinceCode, t: EiTable): number {
  return province === 'QC' ? t.employeeRateQuebec : t.employeeRate;
}

export function maxEiPremium(province: ProvinceCode, t: EiTable): number {
  return roundCent(t.maxInsurableEarnings * eiRateFor(province, t));
}

/** Per-period EI premium: rate × insurable, capped by remaining insurable earnings and premium room. */
export function calcEi(
  insurable: number,
  province: ProvinceCode,
  ytd: EmployeeYtd,
  t: EiTable,
  exempt: boolean,
): EiResult {
  if (exempt || insurable <= 0) {
    return { ei: 0, insurableEarnings: Math.max(0, insurable) };
  }

  const remainingInsurable = Math.max(0, t.maxInsurableEarnings - ytd.insurableEarnings);
  const effectiveInsurable = Math.min(insurable, remainingInsurable);
  let ei = roundCent(eiRateFor(province, t) * effectiveInsurable);
  ei = Math.min(ei, Math.max(0, roundCent(maxEiPremium(province, t) - ytd.ei)));

  return { ei, insurableEarnings: insurable };
}
