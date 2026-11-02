import { TaxEngineError, type NamedDeduction } from '../types';
import { roundCent } from '../money';

export interface ResolvedDeductions {
  /** Total withheld via named deductions (the caller subtracts this from net pay). */
  total: number;
  /** Amount reducing the taxable base (T4127 factor F). */
  taxable: number;
  /** Amount reducing the CPP/QPP pensionable base. */
  pensionable: number;
  /** Amount reducing the EI/QPIP insurable base. */
  insurable: number;
}

/**
 * Normalize PayInput.periodDeductions (Wave 3 B6).
 *
 * Legacy bare-number form keeps its exact historical meaning: it is
 * the T4127 factor F and reduces ONLY the taxable base. The named-list
 * form sums amounts per flag. All amounts must be finite and ≥ 0.
 */
export function resolveDeductions(
  periodDeductions: number | NamedDeduction[] | undefined,
): ResolvedDeductions {
  if (periodDeductions === undefined) {
    return { total: 0, taxable: 0, pensionable: 0, insurable: 0 };
  }
  if (typeof periodDeductions === 'number') {
    if (!Number.isFinite(periodDeductions) || periodDeductions < 0) {
      throw new TaxEngineError('Deductions cannot be negative');
    }
    return {
      total: roundCent(periodDeductions),
      taxable: roundCent(periodDeductions),
      pensionable: 0,
      insurable: 0,
    };
  }
  let total = 0;
  let taxable = 0;
  let pensionable = 0;
  let insurable = 0;
  for (const d of periodDeductions) {
    if (!d || !Number.isFinite(d.amount) || d.amount < 0) {
      throw new TaxEngineError(
        `Deduction "${d?.name ?? '?'}" must have a non-negative amount, got ${d?.amount}`,
      );
    }
    total += d.amount;
    if (d.reducesTaxable) taxable += d.amount;
    if (d.reducesPensionable) pensionable += d.amount;
    if (d.reducesInsurable) insurable += d.amount;
  }
  return {
    total: roundCent(total),
    taxable: roundCent(taxable),
    pensionable: roundCent(pensionable),
    insurable: roundCent(insurable),
  };
}
