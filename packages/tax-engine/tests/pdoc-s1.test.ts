/**
 * PDOC oracle pin — scenario S1 (Wave 3 investigation, 2026-11-02).
 *
 * Source: CRA Paycheck Deductions Online Calculator (PDOC), version
 * 2026-10-28, captured in ~/workspace/nexvar-pay-versatility/pdoc-oracle.md.
 * AB biweekly salary $2,800.00, pay date 2026-01-16, YTD zero, TD1 claims
 * federal $16,452 / Alberta $22,769 (the 2026 defaults).
 *
 * This test pins the finding that the engine's 2026 tables carry the
 * CORRECT 2026 basic personal amounts (federal BPAF max $16,452; Alberta
 * $22,769) and reproduce PDOC to the cent — the 2025 amounts seen in the
 * live app on 2026-11-01 were a stale production deployment of the
 * Settings display, not an engine defect.
 */
import { describe, it, expect } from 'vitest';
import { calculatePay } from '../src/calc/pay-run';
import { ZERO_YTD } from '../src/types';

const S1 = {
  payDate: '2026-01-16',
  province: 'AB' as const,
  frequency: 'biweekly' as const,
  grossPeriodIncome: 2800,
  ytd: ZERO_YTD,
};

describe('PDOC oracle — S1 (AB biweekly $2,800, 2026-01-16)', () => {
  it('matches PDOC to the cent with explicit 2026 TD1 claims', () => {
    const r = calculatePay({ ...S1, federalClaim: 16_452, provincialClaim: 22_769 });
    expect(r.cpp).toBe(158.59);
    expect(r.cpp2).toBe(0);
    expect(r.ei).toBe(45.64);
    expect(r.federalTax).toBe(301.04);
    expect(r.provincialTax).toBe(146.19);
    expect(r.totalDeductions).toBe(651.46);
    expect(r.netPay).toBe(2148.54);
  });

  it('matches PDOC with default claims (engine BPA defaults are the 2026 amounts)', () => {
    const r = calculatePay({ ...S1 });
    expect(r.cpp).toBe(158.59);
    expect(r.ei).toBe(45.64);
    expect(r.federalTax).toBe(301.04);
    expect(r.provincialTax).toBe(146.19);
  });
});
