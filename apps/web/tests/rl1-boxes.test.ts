/**
 * RL-1 slip computation tests — spec: specs/rq-rl1-xml.md §1, §5.
 */
import { describe, it, expect } from "vitest";
import {
  computeRl1Slip,
  buildRl1DataExport,
  type Rl1EmployeeYearData,
} from "../src/lib/filings/rl1-boxes";

const qcEmployee: Rl1EmployeeYearData = {
  employeeId: "emp-qc-1",
  employeeName: "Tremblay, Marie",
  provinceOfEmployment: "QC",
  employmentIncome: 62000,
  qppBaseAndFirstAdditional: 3713.10,
  qppSecondAdditional: 208.00,
  eiPremiums: 834.24, // reduced Québec EI rate
  quebecTaxWithheld: 7450.55,
  qppPensionableEarnings: 62000,
  qpipPremiums: 266.60,
  qpipEligibleEarnings: 62000,
};

describe("computeRl1Slip", () => {
  it("maps the core boxes and keeps B.A / B.B separate with a correct total", () => {
    const slip = computeRl1Slip(qcEmployee);
    expect(slip.boxA).toBe(62000);
    expect(slip.boxBA).toBe(3713.10);
    expect(slip.boxBB).toBe(208.00);
    expect(slip.qppTotal).toBe(3921.10);
    expect(slip.boxC).toBe(834.24);
    expect(slip.boxE).toBe(7450.55);
    expect(slip.boxG).toBe(62000);
    expect(slip.boxH).toBe(266.60);
    expect(slip.boxI).toBe(62000);
    expect(slip.warnings).toEqual([]);
  });

  it("rejects non-Québec province of employment", () => {
    expect(() => computeRl1Slip({ ...qcEmployee, provinceOfEmployment: "ON" })).toThrow(/Québec/);
  });

  it("box O without its mandatory case-O code throws", () => {
    expect(() => computeRl1Slip({ ...qcEmployee, otherIncome: 500 })).toThrow(/case O/);
    const ok = computeRl1Slip({ ...qcEmployee, otherIncome: 500, caseOCode: "A1" });
    expect(ok.boxO).toBe(500);
    expect(ok.caseOCode).toBe("A1");
  });

  it("box J is the employer private-health-plan amount, defaulting to 0 (never employer QPIP)", () => {
    expect(computeRl1Slip(qcEmployee).boxJ).toBe(0);
    expect(computeRl1Slip({ ...qcEmployee, employerPrivateHealthPlan: 900 }).boxJ).toBe(900);
  });

  it("warns on incoherent splits instead of silently accepting them", () => {
    const slip = computeRl1Slip({ ...qcEmployee, qppBaseAndFirstAdditional: 0 });
    expect(slip.warnings.some((w) => w.includes("B.B"))).toBe(true);
    const slip2 = computeRl1Slip({ ...qcEmployee, qpipEligibleEarnings: 0 });
    expect(slip2.warnings.some((w) => w.includes("Box H"))).toBe(true);
  });

  it("rejects negative amounts loudly", () => {
    expect(() => computeRl1Slip({ ...qcEmployee, employmentIncome: -1 })).toThrow(/non-negative/);
  });

  it("rounds to cents", () => {
    const slip = computeRl1Slip({ ...qcEmployee, quebecTaxWithheld: 7450.555 });
    expect(slip.boxE).toBe(7450.56);
  });
});

describe("buildRl1DataExport", () => {
  it("emits fixed 2-decimal box strings keyed by RL-1 box letters", () => {
    const exp = buildRl1DataExport([computeRl1Slip(qcEmployee)], 2026);
    expect(exp.taxationYear).toBe(2026);
    expect(exp.slips).toHaveLength(1);
    expect(exp.slips[0]!["A"]).toBe("62000.00");
    expect(exp.slips[0]!["B.A"]).toBe("3713.10");
    expect(exp.slips[0]!["B.B"]).toBe("208.00");
    expect(exp.slips[0]!["E"]).toBe("7450.55");
    expect(exp.slips[0]!["caseOCode"]).toBeUndefined();
  });
});
