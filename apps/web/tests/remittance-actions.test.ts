/**
 * Wave 2 remittance wiring — submission actions.
 *
 * Pins the two behaviours that make the Remittances page's submission
 * state trustworthy:
 *  - markRemittanceSubmitted snapshots the period total from the SHARED
 *    AGGREGATION over finalized pay runs (server-computed; the caller
 *    supplies only the period key and an optional reference), and upserts
 *    on repeat so re-marking refreshes the snapshot.
 *  - updateRemitterType accepts only the four CRA remitter types and
 *    rejects anything else BEFORE any write.
 *
 * Prisma/session/cache are mocked; pay-run rows are shaped exactly like
 * the PayRun fields the aggregation consumes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  upserts: [] as Array<Record<string, unknown>>,
  companyUpdates: [] as Array<Record<string, unknown>>,
  remitterType: null as string | null,
  payRuns: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/session", () => ({
  requireCompany: async () => ({ id: "user_1", email: "a@b.c", companyId: "co_1" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: {
      findUnique: async () => ({ remitterType: h.remitterType }),
      update: async (args: Record<string, unknown>) => {
        h.companyUpdates.push(args);
        return { id: "co_1" };
      },
    },
    payRun: {
      findMany: async () => h.payRuns,
    },
    remittanceSubmission: {
      findMany: async () =>
        h.upserts.map((u) => {
          const create = (u as { create: Record<string, unknown> }).create;
          return {
            periodKey: create.periodKey,
            totalRemittance: create.totalRemittance,
            reference: create.reference ?? null,
            submittedAt: new Date("2026-11-02T00:00:00Z"),
            createdById: create.createdById ?? null,
          };
        }),
      upsert: async (args: Record<string, unknown>) => {
        h.upserts.push(args);
        const create = (args as { create: Record<string, unknown> }).create;
        return {
          periodKey: create.periodKey,
          totalRemittance: create.totalRemittance,
          reference: create.reference ?? null,
          submittedAt: new Date("2026-11-02T00:00:00Z"),
          createdById: create.createdById ?? null,
        };
      },
    },
  },
}));

import {
  getRemittanceSubmissions,
  markRemittanceSubmitted,
  updateRemitterType,
} from "@/lib/actions/remittance";

function runRow(overrides: Record<string, unknown> = {}) {
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

beforeEach(() => {
  h.upserts = [];
  h.companyUpdates = [];
  h.remitterType = null;
  h.payRuns = [runRow(), runRow({ payDate: "2026-02-12" })];
});

describe("markRemittanceSubmitted", () => {
  it("snapshots the aggregation total for the period (620 per standard run)", async () => {
    const rec = await markRemittanceSubmitted("2026-01", "CRA-REF-1");

    // 100+100 CPP, 10+10 CPP2, 50+70 EI, 200+80 tax = 620 — the Feb run
    // must NOT leak into the January snapshot.
    expect(rec.totalRemittance).toBe(620);
    expect(rec.reference).toBe("CRA-REF-1");
    expect(h.upserts).toHaveLength(1);
    const upsert = h.upserts[0] as {
      where: unknown;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(upsert.where).toEqual({
      companyId_periodKey: { companyId: "co_1", periodKey: "2026-01" },
    });
    expect(upsert.create.totalRemittance).toBe(620);
    expect(upsert.create.companyId).toBe("co_1");
    expect(upsert.create.createdById).toBe("user_1");
    // Repeat marking refreshes the snapshot via the update branch.
    expect(upsert.update.totalRemittance).toBe(620);
  });

  it("upserts on repeat: a second mark issues a second upsert for the same key", async () => {
    await markRemittanceSubmitted("2026-01");
    h.payRuns = [runRow(), runRow({ payDate: "2026-01-29", totalCpp: 50, totalEmployerCpp: 50 })];
    const rec2 = await markRemittanceSubmitted("2026-01");
    expect(h.upserts).toHaveLength(2);
    // Second snapshot reflects the added run: row2 = 50+50 CPP, 10+10 CPP2,
    // 50+70 EI, 200+80 tax = 520 → 620 + 520 = 1140
    expect(rec2.totalRemittance).toBe(1140);
    expect(rec2.reference).toBeNull();
  });

  it("rejects a malformed period key before touching the DB", async () => {
    await expect(markRemittanceSubmitted("Jan 2026")).rejects.toThrow(/Invalid period key/);
    expect(h.upserts).toHaveLength(0);
  });

  it("groups quarterly when the company is a QUARTERLY remitter", async () => {
    h.remitterType = "QUARTERLY";
    const rec = await markRemittanceSubmitted("2026-Q1");
    // Both Jan and Feb runs fall in Q1 → 620 × 2
    expect(rec.totalRemittance).toBe(1240);
  });
});

describe("getRemittanceSubmissions", () => {
  it("returns a periodKey → submission map", async () => {
    await markRemittanceSubmitted("2026-01", "REF-9");
    const map = await getRemittanceSubmissions();
    expect(Object.keys(map)).toEqual(["2026-01"]);
    expect(map["2026-01"]?.totalRemittance).toBe(620);
    expect(map["2026-01"]?.reference).toBe("REF-9");
  });
});

describe("updateRemitterType", () => {
  it("accepts each of the four CRA values", async () => {
    for (const t of ["REGULAR", "QUARTERLY", "ACCELERATED1", "ACCELERATED2"]) {
      await expect(updateRemitterType(t)).resolves.toBe(t);
    }
    expect(h.companyUpdates).toHaveLength(4);
    expect(
      (h.companyUpdates[0] as { data: unknown }).data,
    ).toEqual({ remitterType: "REGULAR" });
  });

  it("rejects an invalid value and writes nothing", async () => {
    await expect(updateRemitterType("WEEKLY")).rejects.toThrow(/Invalid remitter type/);
    await expect(updateRemitterType("")).rejects.toThrow(/Invalid remitter type/);
    expect(h.companyUpdates).toHaveLength(0);
  });
});
