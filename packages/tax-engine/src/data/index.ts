import { TaxEngineError, type TaxTables } from '../types';
import { FEDERAL_2026 } from './2026/federal';
import { CPP_2026, EI_2026 } from './2026/cpp-ei';
import { PROVINCES_2026 } from './2026/provinces';

export const TABLES_2026: TaxTables = {
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  federal: FEDERAL_2026,
  provinces: PROVINCES_2026,
  cpp: CPP_2026,
  ei: EI_2026,
};

/** All loaded editions, newest first. A July edition would be added here when published. */
const EDITIONS: TaxTables[] = [TABLES_2026];

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
