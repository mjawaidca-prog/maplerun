export * from './types';
export { roundCent, clamp } from './money';
export { getTables, TABLES_2026 } from './data/index';
export { QPP_2026, QPIP_2026, QC_FEDERAL_ABATEMENT } from './data/2026/quebec';
export { calculatePay } from './calc/pay-run';
export { calculateBonus, type BonusInput, type BonusResult } from './calc/bonus';
export { calcCpp, maxCppContribution, maxCpp2Contribution } from './calc/cpp';
export { calcEi, eiRateFor, maxEiPremium } from './calc/ei';
export {
  calcIncomeTax,
  annualFederalTax,
  annualProvincialTax,
  bracketFor,
  dynamicBpa,
  healthPremium,
} from './calc/income-tax';
