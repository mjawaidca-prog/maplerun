/**
 * RL-1 report assembly tests — getRl1Report (lib/actions/rl1.ts) wired to
 * the pure module from PR #20 (lib/filings/rl1-boxes.ts).
 *
 * Inclusion rule under test: an employee is in scope when a FINALIZED item
 * for the year carries QPP/QPIP amounts (qpp > 0 or qpip > 0); sums are
 * over those QC items only. Prisma/session are mocked as in the other
 * action tests; the filings module and the tax-engine QPIP cap are REAL.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  requireCompany: async () => ({ id: "user_1", email: "a@b.c", companyId: "co_1" }),
}));

type Item = Record<string, number | string> & {
  employee: { id: string; firstName: string; lastName: string };
};

function item(employee: Item["employee"], overrides: Record<string, number>): Item {
  return {
    employeeId: employee.id,
    gross: 0, cpp: 0, cpp2: 0, ei: 0, qpp: 0, qpp2: 0, qpip: 0,
    federalTax: 0, provincialTax: 0, ytdPensionable: 0,
    ...overrides,
    employee,
  } as unknown as Item;
}

const MARIE = { id: "emp-qc-1", firstName: "Marie", lastName: "Tremblay" };
const ONTARIO = { id: "emp-on-1", firstName: "Olivia", lastName: "Ontario" };
const PAUL = { id: "emp-qc-2", firstName: "Paul", lastName: "Test" };
const RICH = { id: "emp-qc-3", firstName: "Rich", lastName: "Cap" };

const RUNS = [
  {
    id: "run_1",
    payDate: "2026-06-15",
    items: [
      // PR #20 fixture shape: income 62,000 / B.A 3,713.10 / B.B 208.00 /
      // EI 834.24 / QC tax 7,450.55 / QPIP 266.60.
      item(MARIE, {
        gross: 62000, qpp: 3713.10, qpp2: 208.00, ei: 834.24,
        provincialTax: 7450.55, qpip: 266.60, ytdPensionable: 62000,
      }),
      // Non-QC employee: pension amounts live in cpp, qpp/qpip are zero.
      item(ONTARIO, {
        gross: 50000, cpp: 3000, cpp2: 100, ei: 800,
        provincialTax: 5000, ytdPensionable: 50000,
      }),
      // QPP2 positive but B.A zero → the module's B.B coherence warning.
      // No YtdLedger row → box G falls back to the item's ytdPensionable.
      item(PAUL, {
        gross: 40000, qpp: 0, qpp2: 208.00, ei: 600,
        provincialTax: 4000, qpip: 172.00, ytdPensionable: 38000,
      }),
      // Gross above the QPIP maximum insurable earnings → box I capped.
      item(RICH, {
        gross: 120000, qpp: 4000, qpp2: 400, ei: 1000,
        provincialTax: 20000, qpip: 442.90, ytdPensionable: 85000,
      }),
    ],
  },
];

const LEDGERS = [
  { employeeId: "emp-qc-1", pensionableEarnings: 62000 },
  { employeeId: "emp-qc-3", pensionableEarnings: 85000 },
  // emp-qc-2 intentionally absent — fallback path.
];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: { findUnique: async () => ({ name: "Acme Québec Inc." }) },
    payRun: { findMany: async () => RUNS },
    ytdLedger: {
      findMany: async ({ where }: { where: { employeeId: { in: string[] }; year: number } }) =>
        LEDGERS.filter((l) => where.employeeId.in.includes(l.employeeId)),
    },
  },
}));

import { getRl1Report } from "@/lib/actions/rl1";
import { buildRl1DataExport } from "@/lib/filings/rl1-boxes";

describe("getRl1Report — assembly", () => {
  it("produces the PR #20 module's expected boxes for the QC fixture employee", async () => {
    const report = await getRl1Report(2026);
    const slip = report.slips.find((s) => s.employeeId === "emp-qc-1");
    expect(slip).toBeDefined();
    expect(slip!.boxA).toBe(62000);
    expect(slip!.boxBA).toBe(3713.10);
    expect(slip!.boxBB).toBe(208.00);
    expect(slip!.qppTotal).toBe(3921.10);
    expect(slip!.boxC).toBe(834.24);
    expect(slip!.boxE).toBe(7450.55);
    expect(slip!.boxG).toBe(62000); // from YtdLedger.pensionableEarnings
    expect(slip!.boxH).toBe(266.60);
    expect(slip!.boxI).toBe(62000);
    expect(slip!.warnings).toEqual([]);
    // Boxes with no source data stay at the module default — not fabricated.
    expect(slip!.boxD).toBe(0);
    expect(slip!.boxF).toBe(0);
    expect(slip!.boxO).toBe(0);
    expect(report.companyName).toBe("Acme Québec Inc.");
  });

  it("excludes an employee whose items carry no QPP/QPIP amounts", async () => {
    const report = await getRl1Report(2026);
    expect(report.slips.map((s) => s.employeeId)).not.toContain("emp-on-1");
    expect(report.totals.employees).toBe(3);
  });

  it("surfaces module warnings on the slip and falls back to the last item's ytdPensionable for box G", async () => {
    const report = await getRl1Report(2026);
    const slip = report.slips.find((s) => s.employeeId === "emp-qc-2");
    expect(slip).toBeDefined();
    expect(slip!.boxG).toBe(38000);
    expect(slip!.warnings.some((w) => w.includes("B.B"))).toBe(true);
  });

  it("caps box I at the QPIP 2026 maximum insurable earnings ($103,000)", async () => {
    const report = await getRl1Report(2026);
    const slip = report.slips.find((s) => s.employeeId === "emp-qc-3");
    expect(slip!.boxA).toBe(120000);
    expect(slip!.boxI).toBe(103000);
  });

  it("totals sum the slips", async () => {
    const report = await getRl1Report(2026);
    expect(report.totals.boxA).toBe(62000 + 40000 + 120000);
    expect(report.totals.boxH).toBe(881.50);
  });
});

describe("getRl1Report — data export", () => {
  it("feeds buildRl1DataExport with the documented shape (no slip numbers)", async () => {
    const report = await getRl1Report(2026);
    const exp = buildRl1DataExport(report.slips, 2026);
    expect(exp.taxationYear).toBe(2026);
    expect(exp.slips).toHaveLength(3);
    const marie = exp.slips.find((s) => s["employeeId"] === "emp-qc-1")!;
    expect(marie["A"]).toBe("62000.00");
    expect(marie["B.A"]).toBe("3713.10");
    expect(marie["B.B"]).toBe("208.00");
    expect(marie["E"]).toBe("7450.55");
    expect(marie["H"]).toBe("266.60");
    expect(Object.keys(marie).some((k) => /slip/i.test(k))).toBe(false);
  });
});
