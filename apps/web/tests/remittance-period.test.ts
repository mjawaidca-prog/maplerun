/**
 * W4-D11 — Remittance scope selection (pure helpers).
 *
 * The Remittances page's period control was hardcoded decorative buttons
 * and the report was pinned to the current period. Selection now lives
 * in lib/remittance/aggregate.ts: resolveRemittanceScope turns the raw
 * `period` search param into a scope, and remittancePeriodOptions lists
 * what the selector may offer (periods with finalized runs + current).
 */
import { describe, it, expect } from "vitest";
import {
  aggregateRemittances,
  remittancePeriodOptions,
  resolveRemittanceScope,
  type RemittanceRunRow,
} from "@/lib/remittance/aggregate";

function runRow(overrides: Partial<RemittanceRunRow> = {}): RemittanceRunRow {
  return {
    payDate: "2026-09-30",
    totalCpp: 100, totalCpp2: 0, totalEi: 50,
    totalFederalTax: 80, totalProvincialTax: 40,
    totalEmployerCpp: 100, totalEmployerCpp2: 0, totalEmployerEi: 70,
    itemCount: 1,
    ...overrides,
  };
}

describe("resolveRemittanceScope", () => {
  it("defaults to the current period when the param is absent", () => {
    expect(resolveRemittanceScope(undefined, "2026-11", "monthly"))
      .toEqual({ kind: "period", period: "2026-11" });
  });

  it("selects the year-to-date scope for period=ytd", () => {
    expect(resolveRemittanceScope("ytd", "2026-11", "monthly"))
      .toEqual({ kind: "ytd" });
    expect(resolveRemittanceScope("ytd", "2026-Q4", "quarterly"))
      .toEqual({ kind: "ytd" });
  });

  it("selects a well-formed prior period", () => {
    expect(resolveRemittanceScope("2026-09", "2026-11", "monthly"))
      .toEqual({ kind: "period", period: "2026-09" });
    expect(resolveRemittanceScope("2026-Q3", "2026-Q4", "quarterly"))
      .toEqual({ kind: "period", period: "2026-Q3" });
  });

  it("falls back to the current period for malformed values", () => {
    for (const bad of ["", "garbage", "2026-9", "2026-13", "2026-00", "26-09", "2026/09"]) {
      expect(resolveRemittanceScope(bad, "2026-11", "monthly"))
        .toEqual({ kind: "period", period: "2026-11" });
    }
  });

  it("falls back when the key format belongs to the other grouping (stale link after a regroup)", () => {
    // A monthly key in the URL after the remitter type regroups to
    // quarterly must not produce a monthly period on a quarterly page.
    expect(resolveRemittanceScope("2026-09", "2026-Q4", "quarterly"))
      .toEqual({ kind: "period", period: "2026-Q4" });
    expect(resolveRemittanceScope("2026-Q3", "2026-11", "monthly"))
      .toEqual({ kind: "period", period: "2026-11" });
  });
});

describe("remittancePeriodOptions", () => {
  it("offers the periods with finalized runs plus the current period, newest first", () => {
    const { periods } = aggregateRemittances([
      runRow({ payDate: "2026-09-30" }),
      runRow({ payDate: "2026-07-15" }),
      runRow({ payDate: "2026-09-01" }),
    ]);
    const options = remittancePeriodOptions(periods.map((p) => p.period), "2026-11");
    expect(options).toEqual(["2026-11", "2026-09", "2026-07"]);
  });

  it("does not offer periods with no finalized runs (other than current)", () => {
    const { periods } = aggregateRemittances([runRow({ payDate: "2026-09-30" })]);
    const options = remittancePeriodOptions(periods.map((p) => p.period), "2026-11");
    expect(options).not.toContain("2026-10");
    expect(options).not.toContain("2026-08");
  });

  it("includes the current period exactly once even when it has runs", () => {
    const { periods } = aggregateRemittances([runRow({ payDate: "2026-11-15" })]);
    const options = remittancePeriodOptions(periods.map((p) => p.period), "2026-11");
    expect(options).toEqual(["2026-11"]);
  });

  it("with no runs at all, only the current period is offered", () => {
    expect(remittancePeriodOptions([], "2026-11")).toEqual(["2026-11"]);
  });

  it("quarterly options carry quarter keys", () => {
    const { periods } = aggregateRemittances(
      [runRow({ payDate: "2026-02-10" }), runRow({ payDate: "2026-08-10" })],
      "quarterly",
    );
    expect(remittancePeriodOptions(periods.map((p) => p.period), "2026-Q4"))
      .toEqual(["2026-Q4", "2026-Q3", "2026-Q1"]);
  });
});
