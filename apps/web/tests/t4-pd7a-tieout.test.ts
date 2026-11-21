import { describe, it, expect } from "vitest";
import {
  buildT4Pd7aTieOut,
  round2,
  type TieOutItemInput,
  type TieOutParams,
  type TieOutRunInput,
} from "../src/lib/filings/t4-pd7a-tieout";

/**
 * Hand-built cases for the T4 ↔ PD7A tie-out. Params are the verified 2026
 * figures from @maplerun/tax-engine (CPP 5.95% / $3,500 exemption / YMPE
 * $74,600 / CPP2 max $416.00; EI 1.63% / MIE $68,900 / max premium $1,123.07).
 */
const PARAMS: TieOutParams = {
  cppRate: 0.0595,
  cpp2Rate: 0.04,
  basicExemption: 3500,
  ympe: 74600,
  yampe: 85000,
  maxCpp: 4230.45,
  maxCpp2: 416,
  eiRate: 0.0163,
  eiRateQuebec: 0.013,
  maxInsurableEarnings: 68900,
};

const EMPLOYEES = {
  "emp-1": { name: "Alice Aird", province: "AB" },
  "emp-2": { name: "Bob Berg", province: "ON" },
};

function item(overrides: Partial<TieOutItemInput> = {}): TieOutItemInput {
  return {
    employeeId: "emp-1",
    gross: 4000,
    cpp: 200,
    cpp2: 0,
    ei: 65.2,
    federalTax: 500,
    provincialTax: 250,
    employerCpp: 200,
    employerCpp2: 0,
    employerEi: 91.28,
    ytdPensionable: 4000,
    ytdInsurable: 4000,
    ...overrides,
  };
}

/** A run whose stored totals default to the sum of its items (consistent). */
function run(partial: Partial<TieOutRunInput> & { items: TieOutItemInput[] }): TieOutRunInput {
  const items = partial.items;
  const sum = (f: (i: TieOutItemInput) => number) => round2(items.reduce((s, i) => s + f(i), 0));
  const base: TieOutRunInput = {
    id: "run-1",
    payDate: "2026-01-15",
    status: "FINALIZED",
    finalizedAt: "2026-01-15T12:00:00.000Z",
    reversedAt: null,
    periodsPerYear: 12,
    totalGross: sum((i) => i.gross),
    totalCpp: sum((i) => i.cpp),
    totalCpp2: sum((i) => i.cpp2),
    totalEi: sum((i) => i.ei),
    totalFederalTax: sum((i) => i.federalTax),
    totalProvincialTax: sum((i) => i.provincialTax),
    totalEmployerCpp: sum((i) => i.employerCpp),
    totalEmployerCpp2: sum((i) => i.employerCpp2),
    totalEmployerEi: sum((i) => i.employerEi),
    itemCount: items.length,
    items,
  };
  return { ...base, ...partial };
}

function tieOut(runs: TieOutRunInput[]) {
  return buildT4Pd7aTieOut({ year: 2026, runs, employees: EMPLOYEES, params: PARAMS });
}

describe("buildT4Pd7aTieOut", () => {
  it("ties out exactly when run totals, pay slips and YTD earnings all agree", () => {
    const result = tieOut([
      run({
        id: "r1",
        payDate: "2026-01-15",
        finalizedAt: "2026-01-15T12:00:00.000Z",
        items: [
          item({ employeeId: "emp-1", ytdPensionable: 4000, ytdInsurable: 4000 }),
          item({ employeeId: "emp-2", gross: 3000, cpp: 160, ei: 48.9, federalTax: 350, provincialTax: 175, employerCpp: 160, employerEi: 68.46, ytdPensionable: 3000, ytdInsurable: 3000 }),
        ],
      }),
      run({
        id: "r2",
        payDate: "2026-02-15",
        finalizedAt: "2026-02-15T12:00:00.000Z",
        items: [
          item({ employeeId: "emp-1", ytdPensionable: 8000, ytdInsurable: 8000 }),
          item({ employeeId: "emp-2", gross: 3000, cpp: 160, ei: 48.9, federalTax: 350, provincialTax: 175, employerCpp: 160, employerEi: 68.46, ytdPensionable: 6000, ytdInsurable: 6000 }),
        ],
      }),
    ]);

    expect(result.tiesOut).toBe(true);
    expect(result.differenceCount).toBe(0);
    expect(result.differences).toEqual([]);
    expect(result.employeeCount).toBe(2);
    expect(result.payRunCount).toBe(2);
    expect(result.comparedTotals).toHaveLength(8);
    for (const ct of result.comparedTotals) {
      expect(ct.difference).toBe(0);
    }
    const cpp = result.comparedTotals.find((c) => c.field === "employeeCpp");
    expect(cpp?.pd7aAmount).toBe(720);
    expect(cpp?.t4Amount).toBe(720);
  });

  it("flags a CPP difference equal to the basic exemption with the exemption cause", () => {
    // Items carry per-period CPP of $600 × 2 = $1,200. The stored run totals
    // carry $208.25 less — exactly $3,500 × 5.95%, the full annual exemption
    // applied a second time on the remittance side.
    const result = tieOut([
      run({ id: "r1", payDate: "2026-01-15", items: [item({ cpp: 600, employerCpp: 600, ytdPensionable: 4000, ytdInsurable: 4000 })] }),
      run({
        id: "r2",
        payDate: "2026-02-15",
        finalizedAt: "2026-02-15T12:00:00.000Z",
        items: [item({ cpp: 600, employerCpp: 600, ytdPensionable: 8000, ytdInsurable: 8000 })],
        totalCpp: 391.75,
      }),
    ]);

    const row = result.differences.find((d) => d.scope === "employee" && d.field === "employeeCpp");
    expect(row).toBeDefined();
    expect(row?.employeeName).toBe("Alice Aird");
    expect(row?.pd7aAmount).toBe(991.75);
    expect(row?.t4Amount).toBe(1200);
    expect(row?.difference).toBe(208.25);
    expect(row?.causeCode).toBe("cpp-exemption");
    expect(result.tiesOut).toBe(false);
  });

  it("flags EI insurable earnings that run past the MIE cap on the T4 side", () => {
    // Gross (and the T4 box-24 heuristic) reach $75,000; the engine's YTD
    // insurable earnings stop at the $68,900 maximum insurable earnings.
    const result = tieOut([
      run({
        id: "r1",
        payDate: "2026-12-15",
        finalizedAt: "2026-12-15T12:00:00.000Z",
        items: [
          item({
            gross: 75000, cpp: 4230.45, ei: 1123.07,
            federalTax: 15000, provincialTax: 7500,
            employerCpp: 4230.45, employerEi: 1572.3,
            ytdPensionable: 74600, ytdInsurable: 68900,
          }),
        ],
      }),
    ]);

    const row = result.differences.find((d) => d.scope === "employee" && d.field === "eiInsurableEarnings");
    expect(row).toBeDefined();
    expect(row?.pd7aAmount).toBe(68900);
    expect(row?.t4Amount).toBe(75000);
    expect(row?.difference).toBe(6100);
    expect(row?.causeCode).toBe("earnings-over-cap");
    expect(row?.cause).toContain("maximum insurable earnings");
  });

  it("flags EI premiums deducted past the annual maximum premium", () => {
    // Pay slips total exactly the $1,123.07 maximum premium; the stored run
    // total remitted $100 more — premiums kept going after the cap.
    const result = tieOut([
      run({
        id: "r1",
        payDate: "2026-12-15",
        finalizedAt: "2026-12-15T12:00:00.000Z",
        items: [
          item({
            gross: 68900, cpp: 3905.35, ei: 1123.07,
            employerCpp: 3905.35, employerEi: 1572.3,
            ytdPensionable: 68900, ytdInsurable: 68900,
          }),
        ],
        totalEi: 1223.07,
      }),
    ]);

    const row = result.differences.find((d) => d.scope === "employee" && d.field === "employeeEi");
    expect(row).toBeDefined();
    expect(row?.pd7aAmount).toBe(1223.07);
    expect(row?.t4Amount).toBe(1123.07);
    expect(row?.difference).toBe(-100);
    expect(row?.causeCode).toBe("ei-cap");
  });

  it("flags a pay run finalized after the last remittance period of the year", () => {
    // December run: slips are real and in the T4, but the run was finalized
    // Jan 10, 2027 and its stored totals (the PD7A source) are still zero.
    const result = tieOut([
      run({
        id: "r1",
        payDate: "2026-11-15",
        finalizedAt: "2026-11-16T09:00:00.000Z",
        items: [item({ cpp: 500, employerCpp: 500, ytdPensionable: 4000, ytdInsurable: 4000 })],
      }),
      run({
        id: "r2",
        payDate: "2026-12-15",
        finalizedAt: "2027-01-10T09:00:00.000Z",
        items: [item({ cpp: 300, employerCpp: 300, ytdPensionable: 8000, ytdInsurable: 8000 })],
        totalGross: 0, totalCpp: 0, totalCpp2: 0, totalEi: 0,
        totalFederalTax: 0, totalProvincialTax: 0,
        totalEmployerCpp: 0, totalEmployerCpp2: 0, totalEmployerEi: 0,
      }),
    ]);

    const total = result.comparedTotals.find((c) => c.field === "employeeCpp");
    expect(total?.pd7aAmount).toBe(500);
    expect(total?.t4Amount).toBe(800);
    expect(total?.difference).toBe(300);

    const row = result.differences.find((d) => d.scope === "total" && d.field === "employeeCpp");
    expect(row).toBeDefined();
    expect(row?.causeCode).toBe("late-run");
    expect(row?.cause).toContain("2026-12-15");
    expect(row?.cause).toContain("2027-01-10");
  });

  it("flags amounts that match a reversed pay run", () => {
    // The replacement run's stored CPP total still includes the reversed
    // run's $200 — the PD7A side is $200 higher than the pay slips.
    const result = tieOut([
      run({
        id: "r-rev",
        payDate: "2026-05-15",
        status: "REVERSED",
        finalizedAt: "2026-05-15T12:00:00.000Z",
        reversedAt: "2026-06-20T12:00:00.000Z",
        items: [item({ cpp: 200, employerCpp: 200, gross: 2000, ei: 32.6, employerEi: 45.64, federalTax: 250, provincialTax: 125, ytdPensionable: 2000, ytdInsurable: 2000 })],
      }),
      run({
        id: "r2",
        payDate: "2026-06-15",
        finalizedAt: "2026-06-15T12:00:00.000Z",
        items: [item({ cpp: 500, employerCpp: 500, ytdPensionable: 4000, ytdInsurable: 4000 })],
        totalCpp: 700,
      }),
    ]);

    const row = result.differences.find((d) => d.scope === "total" && d.field === "employeeCpp");
    expect(row).toBeDefined();
    expect(row?.pd7aAmount).toBe(700);
    expect(row?.t4Amount).toBe(500);
    expect(row?.difference).toBe(-200);
    expect(row?.causeCode).toBe("reversed-run");
    expect(row?.cause).toContain("2026-05-15");
  });

  it("never nets employee differences against each other", () => {
    // Alice's run totals overstate CPP by $50; Bob's understate by $50.
    // Company totals agree to the cent — the verdict must still fail with
    // both employee rows listed.
    const result = tieOut([
      run({
        id: "r1",
        payDate: "2026-03-15",
        items: [item({ employeeId: "emp-1", cpp: 500, employerCpp: 500 })],
        totalCpp: 550,
      }),
      run({
        id: "r2",
        payDate: "2026-03-15",
        finalizedAt: "2026-03-15T12:00:00.000Z",
        items: [item({ employeeId: "emp-2", gross: 3000, cpp: 400, ei: 48.9, federalTax: 350, provincialTax: 175, employerCpp: 400, employerEi: 68.46, ytdPensionable: 3000, ytdInsurable: 3000 })],
        totalCpp: 350,
      }),
    ]);

    const total = result.comparedTotals.find((c) => c.field === "employeeCpp");
    expect(total?.difference).toBe(0);
    expect(result.tiesOut).toBe(false);
    expect(result.differenceCount).toBe(2);
    const rows = result.differences.filter((d) => d.field === "employeeCpp");
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.difference).sort((a, b) => a - b)).toEqual([-50, 50]);
    for (const r of rows) expect(r.causeCode).toBe("run-mismatch");
  });

  it("explains a cent-level difference as per-period rounding", () => {
    const result = tieOut([
      run({
        id: "r1",
        items: [item({ cpp: 500, employerCpp: 500 })],
        totalCpp: 499.98,
      }),
    ]);

    const row = result.differences.find((d) => d.scope === "employee" && d.field === "employeeCpp");
    expect(row).toBeDefined();
    expect(row?.difference).toBe(0.02);
    expect(row?.causeCode).toBe("rounding");
  });

  it("names the run when a multi-employee run's stored totals disagree with its slips", () => {
    const result = tieOut([
      run({
        id: "r1",
        payDate: "2026-04-15",
        items: [
          item({ employeeId: "emp-1" }),
          item({ employeeId: "emp-2", gross: 3000, cpp: 160, ei: 48.9, federalTax: 350, provincialTax: 175, employerCpp: 160, employerEi: 68.46, ytdPensionable: 3000, ytdInsurable: 3000 }),
        ],
        totalEi: 144.1, // items sum to 114.10 — stored total is $30 higher
      }),
    ]);

    const row = result.differences.find((d) => d.scope === "total" && d.field === "employeeEi");
    expect(row).toBeDefined();
    expect(row?.difference).toBe(-30);
    expect(row?.causeCode).toBe("run-mismatch");
    expect(row?.cause).toContain("2026-04-15");
    // No employee row: the discrepancy cannot be attributed to one employee.
    expect(result.differences.find((d) => d.scope === "employee" && d.field === "employeeEi")).toBeUndefined();
  });

  it("marks a totals difference as explained when the employee rows add up to it", () => {
    // Each employee's own run overstates federal tax by $40 in its stored
    // totals; the totals difference is exactly the two employee differences.
    const result = tieOut([
      run({
        id: "r1",
        payDate: "2026-05-15",
        items: [item({ employeeId: "emp-1" })],
        totalFederalTax: 540,
      }),
      run({
        id: "r2",
        payDate: "2026-06-15",
        finalizedAt: "2026-06-15T12:00:00.000Z",
        items: [item({ employeeId: "emp-2", gross: 3000, cpp: 160, ei: 48.9, federalTax: 350, provincialTax: 175, employerCpp: 160, employerEi: 68.46, ytdPensionable: 3000, ytdInsurable: 3000 })],
        totalFederalTax: 390,
      }),
    ]);

    const row = result.differences.find((d) => d.scope === "total" && d.field === "incomeTax");
    expect(row).toBeDefined();
    expect(row?.difference).toBe(-80);
    expect(row?.causeCode).toBe("explained-by-employees");
  });
});
