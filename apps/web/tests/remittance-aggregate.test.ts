import { describe, it, expect } from "vitest";
import {
  aggregateRemittances,
  periodKeyForPayDate,
  periodKeyForDate,
  periodLabel,
  remittanceDueDate,
  type RemittanceRunRow,
} from "../src/lib/remittance/aggregate";

function run(overrides: Partial<RemittanceRunRow> = {}): RemittanceRunRow {
  return {
    payDate: "2026-01-15",
    totalCpp: 100,
    totalCpp2: 10,
    totalEi: 50,
    totalFederalTax: 200,
    totalProvincialTax: 80,
    totalEmployerCpp: 100,
    totalEmployerCpp2: 10,
    totalEmployerEi: 70,
    itemCount: 2,
    ...overrides,
  };
}

describe("periodKeyForPayDate", () => {
  it("builds monthly keys straight from the ISO string", () => {
    expect(periodKeyForPayDate("2026-01-15")).toBe("2026-01");
    expect(periodKeyForPayDate("2026-12-31")).toBe("2026-12");
    expect(periodKeyForPayDate("2027-01-01")).toBe("2027-01");
  });

  it("builds quarterly keys", () => {
    expect(periodKeyForPayDate("2026-01-15", "quarterly")).toBe("2026-Q1");
    expect(periodKeyForPayDate("2026-03-31", "quarterly")).toBe("2026-Q1");
    expect(periodKeyForPayDate("2026-04-01", "quarterly")).toBe("2026-Q2");
    expect(periodKeyForPayDate("2026-12-15", "quarterly")).toBe("2026-Q4");
  });
});

describe("periodKeyForDate", () => {
  it("uses 1-indexed months (the 2027-00 regression)", () => {
    // Due dates are constructed in the following month; January must be 01, never 00.
    expect(periodKeyForDate(new Date(2027, 0, 15))).toBe("2027-01");
    expect(periodKeyForDate(new Date(2026, 11, 15))).toBe("2026-12");
    expect(periodKeyForDate(new Date(2026, 0, 1))).toBe("2026-01");
  });

  it("rolls across the year boundary", () => {
    const due = new Date(2026, 11 + 1, 15); // JS Date rolls Dec + 1 → Jan 2027
    expect(periodKeyForDate(due)).toBe("2027-01");
    // …and the period that due date belongs to is the month before it:
    const periodDate = new Date(2026, 11 + 1 - 1, 1);
    expect(periodKeyForDate(periodDate)).toBe("2026-12");
  });

  it("builds quarterly keys from a Date", () => {
    expect(periodKeyForDate(new Date(2026, 1, 10), "quarterly")).toBe("2026-Q1");
    expect(periodKeyForDate(new Date(2026, 10, 10), "quarterly")).toBe("2026-Q4");
  });
});

describe("periodLabel", () => {
  it("labels monthly and quarterly keys", () => {
    expect(periodLabel("2026-01")).toBe("January 2026");
    expect(periodLabel("2027-12")).toBe("December 2027");
    expect(periodLabel("2026-Q3")).toBe("Q3 2026");
  });

  it("passes unknown keys through unchanged", () => {
    expect(periodLabel("nonsense")).toBe("nonsense");
  });
});

describe("remittanceDueDate", () => {
  it("is the 15th of the following month for a monthly remitter", () => {
    expect(remittanceDueDate("2026-01")).toBe("2026-02-15");
    expect(remittanceDueDate("2026-06")).toBe("2026-07-15");
  });

  it("rolls December into January of the next year (never month 00 or 13)", () => {
    expect(remittanceDueDate("2026-12")).toBe("2027-01-15");
  });

  it("is the 15th of the month after the quarter ends for quarterly", () => {
    expect(remittanceDueDate("2026-Q1", "quarterly")).toBe("2026-04-15");
    expect(remittanceDueDate("2026-Q4", "quarterly")).toBe("2027-01-15");
  });
});

describe("aggregateRemittances — monthly grouping", () => {
  it("groups runs by payDate month and sums run totals", () => {
    const { periods, totals } = aggregateRemittances([
      run({ payDate: "2026-01-15" }),
      run({ payDate: "2026-01-29", totalCpp: 50, totalEmployerCpp: 50, itemCount: 3 }),
      run({ payDate: "2026-02-12" }),
    ]);

    expect(periods.map((p) => p.period)).toEqual(["2026-01", "2026-02"]);
    const jan = periods[0];
    expect(jan.payRuns).toBe(2);
    expect(jan.employees).toBe(5); // itemCount summed per run
    expect(jan.employeeCpp).toBe(150);
    expect(jan.employerCpp).toBe(150);
    expect(totals.payRuns).toBe(3);
  });

  it("includes CPP2 in the period and the totals (the old inline loops dropped it)", () => {
    const { periods } = aggregateRemittances([run()]);
    expect(periods[0].employeeCpp2).toBe(10);
    expect(periods[0].employerCpp2).toBe(10);
    // 100+100 CPP, 10+10 CPP2, 50+70 EI, 200+80 tax = 620
    expect(periods[0].totalRemittance).toBe(620);
  });
});

describe("aggregateRemittances — quarterly grouping", () => {
  it("groups Jan–Mar into Q1 and keeps Q2 separate", () => {
    const { periods, totals } = aggregateRemittances(
      [
        run({ payDate: "2026-01-15" }),
        run({ payDate: "2026-03-15" }),
        run({ payDate: "2026-04-15" }),
      ],
      "quarterly",
    );

    expect(periods.map((p) => p.period)).toEqual(["2026-Q1", "2026-Q2"]);
    expect(periods[0].payRuns).toBe(2);
    expect(periods[0].totalRemittance).toBe(1240);
    expect(totals.totalRemittance).toBe(1860);
  });
});

describe("aggregateRemittances — composition", () => {
  it("income tax is federal + provincial", () => {
    const { periods, totals } = aggregateRemittances([run()]);
    expect(periods[0].incomeTax).toBe(280);
    expect(totals.incomeTax).toBe(280);
  });

  it("total remittance is ALL source deductions: employee + employer CPP/CPP2/EI + tax", () => {
    const { periods, totals } = aggregateRemittances([
      run({
        totalCpp: 1, totalCpp2: 2, totalEi: 3,
        totalEmployerCpp: 4, totalEmployerCpp2: 5, totalEmployerEi: 6,
        totalFederalTax: 7, totalProvincialTax: 8,
      }),
    ]);
    expect(periods[0].totalRemittance).toBe(36);
    expect(totals.totalRemittance).toBe(36);
  });

  it("keeps employee and employer portions separate", () => {
    const { periods } = aggregateRemittances([run()]);
    const p = periods[0];
    expect(p.employeeCpp + p.employeeCpp2 + p.employeeEi).toBe(160);
    expect(p.employerCpp + p.employerCpp2 + p.employerEi).toBe(180);
  });
});

describe("aggregateRemittances — rounding", () => {
  it("rounds period money fields to cents", () => {
    const { periods } = aggregateRemittances([
      run({ totalCpp: 10.005, totalEmployerCpp: 0 }),
      run({ totalCpp: 10.005, totalEmployerCpp: 0 }),
    ]);
    // 20.009999… summed raw, rounded once per period → 20.01
    expect(periods[0].employeeCpp).toBe(20.01);
  });

  it("totals are the sum of the rounded period figures, rounded again", () => {
    const { periods, totals } = aggregateRemittances([
      run({ payDate: "2026-01-15", totalFederalTax: 0.1, totalProvincialTax: 0.2 }),
      run({ payDate: "2026-02-15", totalFederalTax: 0.1, totalProvincialTax: 0.2 }),
    ]);
    expect(periods.map((p) => p.incomeTax)).toEqual([0.3, 0.3]);
    expect(totals.incomeTax).toBe(0.6);
    expect(totals.federalTax).toBe(0.2);
    expect(totals.provincialTax).toBe(0.4);
  });
});

describe("aggregateRemittances — empty input", () => {
  it("returns no periods and zeroed totals", () => {
    const { periods, totals } = aggregateRemittances([]);
    expect(periods).toEqual([]);
    expect(totals).toEqual({
      payRuns: 0,
      employeeCpp: 0,
      employeeCpp2: 0,
      employeeEi: 0,
      employerCpp: 0,
      employerCpp2: 0,
      employerEi: 0,
      federalTax: 0,
      provincialTax: 0,
      incomeTax: 0,
      totalRemittance: 0,
    });
  });
});
