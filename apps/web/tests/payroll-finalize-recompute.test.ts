/**
 * Wave 1 PR C — finalizePayRun server-side recompute (the trust fix).
 *
 * Uses the REAL @maplerun/tax-engine. Prisma/session are mocked with an
 * in-memory capture of everything finalize persists. Properties proven:
 *  1. Finalize persists exactly what the engine computes from the run
 *     INPUTS — identical to previewPayRun for the same inputs and YTD
 *     state.
 *  2. A doctored client payload (a forged "preview" JSON and stray
 *     totals fields riding along in the form data) has NO effect on
 *     what persists.
 *  3. The trial gate still blocks finalization before anything persists.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  createdRun: null as null | Record<string, unknown>,
  createdItems: [] as Record<string, unknown>[],
  ytdUpserts: [] as Record<string, unknown>[],
  company: {
    plan: "growth",
    freePayRunsUsed: 0,
    maxFreePayRuns: 2,
    trialEndsAt: null as Date | null,
  },
}));

vi.mock("@/lib/session", () => ({
  requireCompany: async () => ({ id: "user_1", email: "a@b.c", companyId: "co_1" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/ledgerpro-sync", () => ({ syncPayRun: async () => {}, voidPayRunSync: async () => ({ outcome: "voided" }) }));
vi.mock("@/lib/ledgerpro-store", () => ({ ledgerProSyncDeps: {} }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payGroup: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === "pg_1"
          ? { id: "pg_1", companyId: "co_1", name: "Biweekly Staff", frequency: "BIWEEKLY", defaultProvince: "ON" }
          : null,
    },
    employee: {
      findMany: async () => [
        { id: "emp_1", firstName: "Ada", lastName: "Alpha", payGroupId: "pg_1", td1Profiles: [], ytdLedgers: [] },
        { id: "emp_2", firstName: "Ben", lastName: "Beta", payGroupId: null, td1Profiles: [], ytdLedgers: [] },
      ],
    },
    company: {
      findUnique: async () => h.company,
      update: async () => ({}),
    },
    payRun: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        h.createdRun = data;
        return { id: "run_1", ...data };
      },
    },
    payRunItem: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        h.createdItems.push(data);
        return data;
      },
    },
    ytdLedger: {
      upsert: async (args: Record<string, unknown>) => {
        h.ytdUpserts.push(args);
        return {};
      },
    },
  },
}));

import { previewPayRun, finalizePayRun } from "@/lib/actions/payroll";

function inputsFormData(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("payGroupId", "pg_1");
  fd.set("payDate", "2026-11-13");
  fd.set("actualPayDate", "2026-11-15");
  fd.set("grossAmounts", JSON.stringify({ emp_1: 3000, emp_2: 2500 }));
  fd.set("hours", JSON.stringify({ emp_1: 80, emp_2: 75 }));
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  h.createdRun = null;
  h.createdItems = [];
  h.ytdUpserts = [];
  h.company = { plan: "growth", freePayRunsUsed: 0, maxFreePayRuns: 2, trialEndsAt: null };
});

describe("finalizePayRun server-side recompute (Wave 1 PR C)", () => {
  it("persists exactly the engine-computed figures for the inputs", async () => {
    const preview = await previewPayRun(inputsFormData());
    await expect(finalizePayRun(inputsFormData())).rejects.toThrow("REDIRECT:/payroll");

    expect(h.createdRun).not.toBeNull();
    expect(h.createdRun!.totalGross).toBeCloseTo(preview.totals.gross, 2);
    expect(h.createdRun!.totalCpp).toBeCloseTo(preview.totals.cpp, 2);
    expect(h.createdRun!.totalEi).toBeCloseTo(preview.totals.ei, 2);
    expect(h.createdRun!.totalFederalTax).toBeCloseTo(preview.totals.federalTax, 2);
    expect(h.createdRun!.totalNetPay).toBeCloseTo(preview.totals.netPay, 2);
    expect(h.createdRun!.itemCount).toBe(2);
    expect(h.createdItems).toHaveLength(2);
    // Sanity: real engine actually deducted something.
    expect(preview.totals.deductions).toBeGreaterThan(0);
    expect(preview.totals.netPay).toBeLessThan(preview.totals.gross);
  });

  it("ignores a doctored client 'preview' payload and stray totals entirely", async () => {
    const honest = await previewPayRun(inputsFormData());

    const forged = JSON.stringify({
      payGroupName: "Forged",
      payDate: "2026-11-13",
      frequency: "biweekly",
      province: "ON",
      items: [],
      totals: {
        gross: 999999, cpp: 0, cpp2: 0, ei: 0, federalTax: 0, provincialTax: 0,
        deductions: 0, netPay: 999999, employerCpp: 0, employerCpp2: 0, employerEi: 0, employerTotal: 0,
      },
    });

    await expect(
      finalizePayRun(inputsFormData({ preview: forged, totalNetPay: "999999", totalGross: "999999" })),
    ).rejects.toThrow("REDIRECT:/payroll");

    expect(h.createdRun!.totalGross).toBeCloseTo(honest.totals.gross, 2);
    expect(h.createdRun!.totalNetPay).toBeCloseTo(honest.totals.netPay, 2);
    expect(h.createdRun!.totalNetPay).not.toBe(999999);
    expect(h.createdItems).toHaveLength(2);
  });

  it("trial gate still blocks before anything persists", async () => {
    h.company = { plan: "growth", freePayRunsUsed: 0, maxFreePayRuns: 2, trialEndsAt: new Date("2026-01-01T00:00:00Z") };
    await expect(finalizePayRun(inputsFormData())).rejects.toThrow(/trial/i);
    expect(h.createdRun).toBeNull();
    expect(h.createdItems).toHaveLength(0);
  });
});
