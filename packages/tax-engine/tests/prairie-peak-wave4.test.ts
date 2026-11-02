/**
 * Wave 4 — Prairie Peak proof-run fixtures (defect W4-D2).
 *
 * These are the exact employees and amounts from the live Prairie Peak
 * end-to-end proof run (Nov 2, 2026), cross-checked line-by-line against
 * CRA's PDOC and Revenu Québec's WebRAS at $0.00 tolerance
 * (evidence: ~/workspace/nexvar-pay-versatility/evidence/2026-11-02-wave4/
 * verification-report.md). The shipped engine missed CPP/QPP by $0.01 on
 * three of them; this file pins the oracle values so the class cannot
 * regress:
 *
 *  - Doyle / Tyler (AB, vacation payout in the period): PDOC prices CPP
 *    on vacation pay as a separate no-exemption component, each
 *    component rounded to cents. The lumped formula is $0.01 low.
 *  - Sophie (QC, no vacation): QPP on $4,800 monthly is exactly
 *    284.025 in decimal; binary floating point lands a hair below and
 *    the old rounding dropped the cent WebRAS keeps.
 *  - Whitfield / Sandhu / Callahan are the proof run's PASS controls —
 *    the fix must not move them.
 *
 * All runs: monthly, pay date 2026-09-30, YTD zero, TD1 basic claims
 * (federal $16,452; Alberta $22,769) exactly as entered in PDOC.
 */
import { describe, it, expect } from "vitest";
import { calculatePay, type PayInput } from "../src/index";

const base: PayInput = {
  payDate: "2026-09-30",
  province: "AB",
  frequency: "monthly",
  grossPeriodIncome: 0,
  federalClaim: 16452,
  provincialClaim: 22769,
};

describe("W4-D2 — Prairie Peak PDOC/WebRAS fixtures", () => {
  it("Doyle: CPP splits the vacation component (PDOC 339.08, was 339.07)", () => {
    const r = calculatePay({ ...base, grossPeriodIncome: 5990.40, vacationPay: 230.40 });
    expect(r.cpp).toBe(339.08);
    expect(r.cpp2).toBe(0);
    expect(r.ei).toBe(97.64); // PDOC — EI is NOT split; lumped matches
    expect(r.totalDeductions).toBe(1383.51);
    expect(r.netPay).toBe(4606.89); // PDOC net
    expect(r.employer.cpp).toBe(339.08);
  });

  it("Tyler: CPP splits the vacation component (PDOC 91.56, was 91.55)", () => {
    const r = calculatePay({ ...base, grossPeriodIncome: 1830.40, vacationPay: 70.40 });
    expect(r.cpp).toBe(91.56);
    expect(r.ei).toBe(29.84);
    expect(r.federalTax).toBe(29.81);
    expect(r.provincialTax).toBe(0);
    expect(r.netPay).toBe(1679.19); // PDOC net
  });

  it("Sophie: QPP half-cent boundary rounds the decimal way (WebRAS 284.03, was 284.02)", () => {
    const r = calculatePay({
      payDate: "2026-09-30",
      province: "QC",
      frequency: "monthly",
      grossPeriodIncome: 4800,
      federalClaim: 16452,
      // No provincialClaim: the app passed none, so the QC table's own
      // basic amount applies — the combination that reproduced WebRAS.
    });
    expect(r.cpp).toBe(284.03); // the engine's cpp field carries QPP for QC
    expect(r.cpp2).toBe(0);
    expect(r.ei).toBe(62.40);
    expect(r.qpip).toBe(20.64);
    expect(r.federalTax).toBe(343.32); // PDOC (Quebec)
    expect(r.provincialTax).toBe(432.95); // WebRAS
    // The corrected QPP moves total deductions/net by the same cent:
    // the live proof showed 1,143.33 / 3,656.67 WITH the defective
    // 284.02; at WebRAS's 284.03 they are 1,143.34 / 3,656.66.
    expect(r.totalDeductions).toBe(1143.34);
    expect(r.netPay).toBe(3656.66);
  });

  it("Whitfield (control): salary, no vacation — unchanged", () => {
    const r = calculatePay({ ...base, grossPeriodIncome: 6000 });
    expect(r.cpp).toBe(339.65);
    expect(r.ei).toBe(97.80);
    expect(Math.round((r.federalTax + r.provincialTax) * 100) / 100).toBe(949.60);
    expect(r.netPay).toBe(4612.95);
  });

  it("Sandhu (control): hourly, vacation ACCRUES (not in gross) — unchanged", () => {
    const r = calculatePay({ ...base, grossPeriodIncome: 4560 });
    expect(r.cpp).toBe(253.97);
    expect(r.ei).toBe(74.33);
    expect(Math.round((r.federalTax + r.provincialTax) * 100) / 100).toBe(569.73);
    expect(r.netPay).toBe(3661.97);
  });

  it("Callahan (control): small vacation payout — both compositions agree at 42.05", () => {
    const r = calculatePay({ ...base, grossPeriodIncome: 998.40, vacationPay: 38.40 });
    expect(r.cpp).toBe(42.05);
    expect(r.ei).toBe(16.27);
    expect(Math.round((r.federalTax + r.provincialTax) * 100) / 100).toBe(0);
    expect(r.netPay).toBe(940.08);
  });

  it("vacationPay defaults to the lumped formula when absent (no phantom split)", () => {
    const withZero = calculatePay({ ...base, grossPeriodIncome: 5990.40, vacationPay: 0 });
    const absent = calculatePay({ ...base, grossPeriodIncome: 5990.40 });
    expect(withZero.cpp).toBe(absent.cpp);
  });
});
