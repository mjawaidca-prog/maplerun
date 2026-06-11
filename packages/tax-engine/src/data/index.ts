import { TaxEngineError, type TaxTables } from '../types';
import { FEDERAL_2026 } from './2026/federal';
import { CPP_2026, EI_2026 } from './2026/cpp-ei';
import { PROVINCES_2026 } from './2026/provinces';
import { PROVINCES_2026_JULY } from './2026/provinces-jul';

export {
  VACATION_PAY_STANDARDS,
  getVacationPayRate,
  calcVacationPay,
} from './vacation-pay';
export type { VacationPayTier, VacationPayStandard } from './vacation-pay';

/** 122nd edition — January 1 to June 30, 2026. */
export const TABLES_2026: TaxTables = {
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-06-30',
  federal: FEDERAL_2026,
  provinces: PROVINCES_2026,
  cpp: CPP_2026,
  ei: EI_2026,
};

/** 123rd edition — July 1 to December 31, 2026. BC rate + reduction, NL BPA, PE bracket. */
export const TABLES_2026_JULY: TaxTables = {
  effectiveFrom: '2026-07-01',
  effectiveTo: '2026-12-31',
  federal: FEDERAL_2026, // no federal changes in July 2026
  provinces: PROVINCES_2026_JULY,
  cpp: CPP_2026, // no CPP changes
  ei: EI_2026, // no EI changes
};

/** All loaded editions, newest first. */
const EDITIONS: TaxTables[] = [TABLES_2026_JULY, TABLES_2026];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Resolve the tax-table edition in force on a pay date. Throws outside covered ranges. */
export function getTables(payDate: string): TaxTables {
  if (!ISO_DATE.test(payDate)) {
    throw new TaxEngineError(`payDate must be ISO yyyy-mm-dd, got "${payDate}"`);
  }
  const edition = EDITIONS.find(
    (e) => payDate >= e.effectiveFrom && payDate <= e.effectiveTo,
  );
  if (!edition) {
    throw new TaxEngineError(
      `No tax tables loaded for pay date ${payDate}. Loaded ranges: ${EDITIONS.map((e) => `${e.effectiveFrom}..${e.effectiveTo}`).join(', ')}`,
    );
  }
  return edition;
}
