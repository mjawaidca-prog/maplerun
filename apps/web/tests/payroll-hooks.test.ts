/**
 * Action-level tests for the M4/M5 hooks in lib/actions/payroll.ts.
 *
 * Prisma, session, Next navigation/cache and the tax engine are mocked;
 * the LedgerPro HTTP layer is the REAL client running against a stubbed
 * global fetch; the API key round-trips through the REAL AES-256-GCM
 * encryption helper. A shared call-order log proves void-before-delete.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");

// ─── Hoisted fake DB + call log ───────────────────────────────────────────────

const h = vi.hoisted(() => {
  const callOrder: string[] = [];
  const db = {
    connection: null as null | Record<string, unknown>,
    runs: new Map<string, Record<string, unknown>>(),
    records: new Map<string, Record<string, unknown>>(),
  };
  return { callOrder, db };
});

vi.mock("@/lib/session", () => ({
  requireCompany: async () => ({ id: "user_1", email: "a@b.c", companyId: "co_1" }),
  requireSession: async () => ({ id: "user_1", email: "a@b.c" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("@maplerun/tax-engine", () => ({
  calculatePay: () => {
    throw new Error("not used in finalize/delete paths under test");
  },
  ZERO_YTD: { pensionableEarnings: 0, cpp: 0, cpp2: 0, insurableEarnings: 0, ei: 0 },
}));

vi.mock("@/lib/prisma", () => {
  const { db, callOrder } = h;
  const prisma = {
    payGroup: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === "pg_1" ? { id: "pg_1", companyId: "co_1", name: "Biweekly Staff", frequency: "BIWEEKLY", defaultProvince: "ON" } : null,
    },
    company: {
      findUnique: async () => ({ plan: "accountant", freePayRunsUsed: 0, maxFreePayRuns: 2, trialEndsAt: null }),
      update: async () => ({}),
    },
    payRun: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const run = { id: "run_new1", ...data };
        db.runs.set("run_new1", run);
        return run;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const run = db.runs.get(where.id);
        if (!run) return null;
        return { ...run, payGroup: { name: "Biweekly Staff", frequency: "BIWEEKLY", defaultProvince: "ON" } };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        callOrder.push("payRun.delete");
        db.runs.delete(where.id);
        db.records.delete(where.id);
        return {};
      },
    },
    payRunItem: { create: async () => ({}) },
    ytdLedger: { upsert: async () => ({}) },
    ledgerProConnection: {
      findUnique: async () => db.connection,
    },
    ledgerProSyncRecord: {
      findUnique: async ({ where }: { where: { payRunId: string } }) => db.records.get(where.payRunId) ?? null,
      upsert: async ({ where, create, update }: { where: { payRunId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const existing = db.records.get(where.payRunId);
        const rec = existing ? { ...existing, ...update } : { id: "rec_1", ...create };
        db.records.set(where.payRunId, rec);
        return rec;
      },
    },
  };
  return { prisma };
});

// ─── Imports under test (after mocks) ─────────────────────────────────────────

import { finalizePayRun, deletePayRun } from "../src/lib/actions/payroll";
import { encrypt } from "../src/lib/encryption";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCOUNTS = ["6920", "2400", "6940", "2410", "2420", "2430", "2440"].map((code) => ({ code, name: code, active: true }));

let fetchCalls: { url: string; init: RequestInit }[] = [];
let fetchBehaviour: (url: string, init: RequestInit) => Promise<Response>;

function stubFetch() {
  fetchCalls = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    fetchCalls.push({ url, init });
    return fetchBehaviour(url, init);
  });
}

const okAccounts = async () => new Response(JSON.stringify({ data: ACCOUNTS }), { status: 200 });
const okCreate = async () =>
  new Response(JSON.stringify({ data: { id: "je_42", entryDate: "2026-11-15", description: "d", sourceType: "manual" } }), { status: 201 });

function setConnection(syncEnabled: boolean) {
  h.db.connection = {
    companyId: "co_1",
    baseUrl: "https://ledger.nexvarlab.com",
    apiKeyEncrypted: encrypt("lp_live_test"),
    mappingMode: "MODE1",
    mapping: {},
    syncEnabled,
  };
}

function previewFormData(): FormData {
  const totals = {
    gross: 10000, cpp: 500, cpp2: 40, ei: 163, federalTax: 1200, provincialTax: 600,
    deductions: 2503, netPay: 7497, employerCpp: 500, employerCpp2: 40, employerEi: 228.2, employerTotal: 768.2,
  };
  const preview = {
    payGroupName: "Biweekly Staff",
    payDate: "2026-11-13",
    frequency: "biweekly",
    province: "ON",
    items: [],
    totals,
  };
  const fd = new FormData();
  fd.set("payGroupId", "pg_1");
  fd.set("payDate", "2026-11-13");
  fd.set("actualPayDate", "2026-11-15");
  fd.set("preview", JSON.stringify(preview));
  return fd;
}

function seedSyncedRun() {
  h.db.runs.set("run_synced", {
    id: "run_synced", companyId: "co_1", payGroupId: "pg_1", payDate: "2026-11-13", actualPayDate: "2026-11-15",
    status: "FINALIZED", totalGross: 10000, totalCpp: 500, totalCpp2: 40, totalEi: 163,
    totalFederalTax: 1200, totalProvincialTax: 600, totalDeductions: 2503, totalNetPay: 7497,
    totalEmployerCpp: 500, totalEmployerCpp2: 40, totalEmployerEi: 228.2, totalEmployerCost: 768.2, itemCount: 4,
  });
  h.db.records.set("run_synced", {
    id: "rec_1", payRunId: "run_synced", companyId: "co_1",
    idempotencyKey: "nexvarpay-payrun-run_synced", ledgerEntryId: "je_42",
    status: "SYNCED", lastError: null, syncedAt: new Date("2026-11-15T00:00:00Z"),
  });
}

beforeEach(() => {
  h.callOrder.length = 0;
  h.db.connection = null;
  h.db.runs.clear();
  h.db.records.clear();
  stubFetch();
  fetchBehaviour = async (url) => (url.includes("/accounts") ? okAccounts() : okCreate());
});

// ─── M4: finalize hook ────────────────────────────────────────────────────────

describe("finalizePayRun + LedgerPro sync (M4)", () => {
  it("finalizes and syncs when enabled: journal POSTed, record SYNCED, redirect still happens", async () => {
    setConnection(true);
    await expect(finalizePayRun(previewFormData())).rejects.toThrow("REDIRECT:/payroll");
    const posts = fetchCalls.filter((c) => c.url.includes("/journal-entries") && !c.url.includes("/void"));
    expect(posts).toHaveLength(1);
    const headers = posts[0]!.init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("nexvarpay-payrun-run_new1");
    expect(h.db.records.get("run_new1")?.status).toBe("SYNCED");
    expect(h.db.records.get("run_new1")?.ledgerEntryId).toBe("je_42");
  });

  it("makes NO LedgerPro call when sync is disabled, and still finalizes", async () => {
    setConnection(false);
    await expect(finalizePayRun(previewFormData())).rejects.toThrow("REDIRECT:/payroll");
    expect(fetchCalls).toHaveLength(0);
    expect(h.db.records.size).toBe(0);
    expect(h.db.runs.has("run_new1")).toBe(true);
  });

  it("still finalizes (redirects) when the LedgerPro call fails; record is FAILED for retry", async () => {
    setConnection(true);
    fetchBehaviour = async (url) => {
      if (url.includes("/accounts")) return okAccounts();
      return new Response("server boom", { status: 500 });
    };
    await expect(finalizePayRun(previewFormData())).rejects.toThrow("REDIRECT:/payroll");
    expect(h.db.runs.has("run_new1")).toBe(true); // payroll persisted
    expect(h.db.records.get("run_new1")?.status).toBe("FAILED");
  });
});

// ─── M5: delete hook ──────────────────────────────────────────────────────────

describe("deletePayRun + LedgerPro void (M5)", () => {
  it("voids the LedgerPro journal BEFORE deleting, then deletes", async () => {
    setConnection(true);
    seedSyncedRun();
    fetchBehaviour = async (url) => {
      if (url.includes("/void")) {
        h.callOrder.push("ledgerpro.void");
        return new Response(JSON.stringify({ data: { id: "je_42" } }), { status: 200 });
      }
      return okAccounts();
    };
    const fd = new FormData();
    fd.set("id", "run_synced");
    await expect(deletePayRun(fd)).rejects.toThrow("REDIRECT:/payroll");
    expect(h.callOrder).toEqual(["ledgerpro.void", "payRun.delete"]);
    const voidCall = fetchCalls.find((c) => c.url.includes("/void"));
    expect(voidCall?.url).toContain("/api/v1/journal-entries/je_42/void");
    expect((voidCall!.init.headers as Record<string, string>)["Idempotency-Key"]).toBe("nexvarpay-payrun-run_synced-void");
  });

  it("BLOCKS the delete when the void cannot complete — run and journal stay live", async () => {
    setConnection(true);
    seedSyncedRun();
    fetchBehaviour = async (url) => {
      if (url.includes("/void")) {
        h.callOrder.push("ledgerpro.void");
        return new Response("Period is closed", { status: 409 });
      }
      return okAccounts();
    };
    const fd = new FormData();
    fd.set("id", "run_synced");
    await expect(deletePayRun(fd)).rejects.toThrow(/Delete blocked/);
    expect(h.callOrder).toEqual(["ledgerpro.void"]); // delete never attempted
    expect(h.db.runs.has("run_synced")).toBe(true);
  });

  it("deletes an unsynced run without any LedgerPro call", async () => {
    h.db.runs.set("run_plain", { id: "run_plain", companyId: "co_1", payGroupId: "pg_1", payDate: "2026-11-13", status: "FINALIZED" });
    const fd = new FormData();
    fd.set("id", "run_plain");
    await expect(deletePayRun(fd)).rejects.toThrow("REDIRECT:/payroll");
    expect(fetchCalls).toHaveLength(0);
    expect(h.db.runs.has("run_plain")).toBe(false);
  });
});
