/**
 * Tests for the Nexvar Pay → LedgerPro sync (M2/M3/M5 service level).
 *
 * HTTP is faked at the client boundary; storage is an in-memory SyncStore.
 * The fake LedgerPro client models the real API's idempotency semantics:
 * same key + same payload replays the stored response without creating a
 * second journal; failures do not burn the key.
 */
import { describe, it, expect, vi } from "vitest";
import { createLedgerProClient, LedgerProError } from "../src/lib/ledgerpro";
import {
  buildJournalPayload,
  DEFAULT_MAPPING,
  idempotencyKeyForRun,
  mappedCodes,
  normalizeMapping,
  UnbalancedJournalError,
  type PayRunTotals,
} from "../src/lib/ledgerpro-journal";
import {
  findMissingCodes,
  syncPayRun,
  testConnection,
  voidPayRunSync,
  type PayRunForSync,
  type SyncConnection,
  type SyncDeps,
  type SyncRecordData,
  type SyncStore,
} from "../src/lib/ledgerpro-sync";
import {
  connectionFingerprint,
  formStateFromConnection,
  type LedgerProConnectionView,
} from "../src/lib/ledgerpro-form-state";
import type { LedgerProResult, CreatedJournal, LedgerProAccount } from "../src/lib/ledgerpro";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_RUN: PayRunTotals = {
  id: "run_abc123456789",
  payDate: "2026-11-13",
  actualPayDate: "2026-11-15",
  itemCount: 4,
  totalGross: 10000,
  totalCpp: 500,
  totalCpp2: 40,
  totalEi: 163,
  totalFederalTax: 1200,
  totalProvincialTax: 600,
  totalNetPay: 7497, // 10000 − (500+40+163+1200+600)
  totalEmployerCpp: 500,
  totalEmployerCpp2: 40,
  totalEmployerEi: 228.2,
  totalEmployerCost: 768.2, // contributions only
};

/** Quebec: QPP rides in the cpp fields; QPIP is folded into the EI fields. */
const QC_RUN: PayRunTotals = {
  id: "run_qc987654321",
  payDate: "2026-11-13",
  actualPayDate: null,
  itemCount: 2,
  totalGross: 8000,
  totalCpp: 504, // QPP
  totalCpp2: 0,
  totalEi: 150.1, // EI + employee QPIP, folded by the engine
  totalFederalTax: 900,
  totalProvincialTax: 700, // Quebec tax
  totalNetPay: 5745.9, // 8000 − (504+0+150.10+900+700)
  totalEmployerCpp: 504,
  totalEmployerCpp2: 0,
  totalEmployerEi: 190.3, // incl. employer QPIP
  totalEmployerCost: 694.3,
};

function sumCents(lines: { debit: number; credit: number }[], side: "debit" | "credit") {
  return lines.reduce((s, l) => s + Math.round(l[side] * 100), 0);
}

function makeConnection(overrides: Partial<SyncConnection> = {}): SyncConnection {
  return {
    companyId: "co_1",
    baseUrl: "https://ledger.nexvarlab.com",
    apiKey: "lp_live_test",
    mappingMode: "MODE1",
    mapping: { ...DEFAULT_MAPPING },
    syncEnabled: true,
    ...overrides,
  };
}

const ALL_ACCOUNTS: LedgerProAccount[] = [
  "6920", "2400", "6940", "2410", "2420", "2430", "2440",
].map((code) => ({ code, name: `Account ${code}`, active: true }));

// ─── Fake store + fake LedgerPro ──────────────────────────────────────────────

class FakeStore implements SyncStore {
  connection: SyncConnection | null = makeConnection();
  runs = new Map<string, PayRunForSync>();
  records = new Map<string, SyncRecordData>();

  async getConnection(companyId: string) {
    return this.connection && this.connection.companyId === companyId ? this.connection : null;
  }
  async getPayRun(payRunId: string) {
    return this.runs.get(payRunId) ?? null;
  }
  async getRecord(payRunId: string) {
    return this.records.get(payRunId) ?? null;
  }
  async upsertRecord(record: SyncRecordData) {
    this.records.set(record.payRunId, { ...record });
  }
}

/** In-memory LedgerPro with stored-response idempotency replay. */
class FakeLedgerPro {
  journals = new Map<string, { id: string }>();
  private byKey = new Map<string, { payloadJson: string; entryId: string }>();
  private seq = 0;
  accounts: LedgerProAccount[] = ALL_ACCOUNTS;
  createCalls: { payload: unknown; key: string }[] = [];
  voidCalls: { entryId: string; key: string }[] = [];
  /** When set, createJournalEntry returns this error instead of posting. */
  createError: LedgerProError | null = null;
  voidError: LedgerProError | null = null;

  client() {
    return {
      listAccounts: async (): Promise<LedgerProResult<LedgerProAccount[]>> => ({ ok: true, data: this.accounts }),
      createJournalEntry: async (payload: never, key: string): Promise<LedgerProResult<CreatedJournal>> => {
        this.createCalls.push({ payload, key });
        if (this.createError) return { ok: false, error: this.createError };
        const payloadJson = JSON.stringify(payload);
        const prior = this.byKey.get(key);
        if (prior) {
          if (prior.payloadJson !== payloadJson) {
            return { ok: false, error: new LedgerProError({ kind: "idempotency_conflict", status: 409, code: "idempotency_key_conflict", message: "conflict" }) };
          }
          // Stored-response replay — no second journal.
          return { ok: true, data: { id: prior.entryId, entryDate: "2026-11-15", description: "…", sourceType: "manual" } };
        }
        const id = `je_${++this.seq}`;
        this.byKey.set(key, { payloadJson, entryId: id });
        this.journals.set(id, { id });
        return { ok: true, data: { id, entryDate: "2026-11-15", description: "…", sourceType: "manual" } };
      },
      voidJournalEntry: async (entryId: string, key: string): Promise<LedgerProResult<{ id: string }>> => {
        this.voidCalls.push({ entryId, key });
        if (this.voidError) return { ok: false, error: this.voidError };
        return { ok: true, data: { id: entryId } };
      },
    };
  }
}

function makeDeps(store: FakeStore, lp: FakeLedgerPro): SyncDeps {
  return { store, createClient: () => lp.client() as never };
}

function seedRun(store: FakeStore, run: PayRunTotals = BASE_RUN) {
  store.runs.set(run.id, { ...run, companyId: "co_1", status: "FINALIZED", payGroupName: "Biweekly Staff" });
}

// ─── Journal builder (M3) ─────────────────────────────────────────────────────

describe("buildJournalPayload — Mode 1", () => {
  it("maps to a single expense debit and two 2400 credits, balanced to the cent", () => {
    const payload = buildJournalPayload(BASE_RUN, "Biweekly Staff", "MODE1", DEFAULT_MAPPING);
    expect(payload.entryDate).toBe("2026-11-15"); // actualPayDate wins
    expect(payload.description).toContain("Biweekly Staff");
    expect(payload.description).toContain("period end 2026-11-13");
    expect(payload.description).toContain("4 employees");
    expect(payload.description).toContain("run run_abc1");
    expect(payload.description.length).toBeLessThanOrEqual(500);

    expect(payload.lines).toHaveLength(3);
    const [expense, remittance, netPay] = payload.lines;
    expect(expense).toMatchObject({ glAccountCode: "6920", debit: 10768.2, credit: 0 });
    expect(remittance).toMatchObject({ glAccountCode: "2400", debit: 0, credit: 3271.2 });
    expect(netPay).toMatchObject({ glAccountCode: "2400", debit: 0, credit: 7497 });
    expect(sumCents(payload.lines, "debit")).toBe(sumCents(payload.lines, "credit"));
    // Every line carries BOTH debit and credit, per the LedgerPro contract.
    for (const l of payload.lines) {
      expect(typeof l.debit).toBe("number");
      expect(typeof l.credit).toBe("number");
    }
  });
});

describe("buildJournalPayload — Mode 2", () => {
  it("maps granular lines with the L1 default codes, balanced to the cent", () => {
    const payload = buildJournalPayload(BASE_RUN, "Biweekly Staff", "MODE2", DEFAULT_MAPPING);
    const byDesc = new Map(payload.lines.map((l) => [l.description, l]));
    expect(byDesc.get("Wages & salaries")).toMatchObject({ glAccountCode: "6920", debit: 10000, credit: 0 });
    expect(byDesc.get("Employer CPP")).toMatchObject({ glAccountCode: "6940", debit: 500, credit: 0 });
    expect(byDesc.get("Employer CPP2")).toMatchObject({ glAccountCode: "6940", debit: 40, credit: 0 });
    expect(byDesc.get("Employer EI")).toMatchObject({ glAccountCode: "6940", debit: 228.2, credit: 0 });
    expect(byDesc.get("CPP payable")).toMatchObject({ glAccountCode: "2410", debit: 0, credit: 1000 });
    expect(byDesc.get("CPP2 payable")).toMatchObject({ glAccountCode: "2410", debit: 0, credit: 80 });
    expect(byDesc.get("EI payable")).toMatchObject({ glAccountCode: "2420", debit: 0, credit: 391.2 });
    expect(byDesc.get("Income tax payable")).toMatchObject({ glAccountCode: "2430", debit: 0, credit: 1800 });
    expect(byDesc.get("Net pay payable")).toMatchObject({ glAccountCode: "2440", debit: 0, credit: 7497 });
    expect(sumCents(payload.lines, "debit")).toBe(1076820);
    expect(sumCents(payload.lines, "debit")).toBe(sumCents(payload.lines, "credit"));
  });

  it("honours a customised mapping (distinct employer-expense codes)", () => {
    const mapping = { ...DEFAULT_MAPPING, employerCppExpense: "6931", cppPayable: "2411" };
    const payload = buildJournalPayload(BASE_RUN, "G", "MODE2", mapping);
    expect(payload.lines.find((l) => l.description === "Employer CPP")?.glAccountCode).toBe("6931");
    expect(payload.lines.find((l) => l.description === "CPP payable")?.glAccountCode).toBe("2411");
  });
});

describe("buildJournalPayload — Quebec fixture", () => {
  it("balances to the cent with QPP in cpp fields and QPIP folded into EI", () => {
    const payload = buildJournalPayload(QC_RUN, "QC Staff", "MODE2", DEFAULT_MAPPING);
    expect(payload.entryDate).toBe("2026-11-13"); // no actualPayDate → payDate
    expect(sumCents(payload.lines, "debit")).toBe(869430);
    expect(sumCents(payload.lines, "debit")).toBe(sumCents(payload.lines, "credit"));
    // EI payable carries EI + folded QPIP (ee + er).
    expect(payload.lines.find((l) => l.description === "EI payable")).toMatchObject({ credit: 340.4 });
    // Zero CPP2 → both CPP2 lines omitted.
    expect(payload.lines.some((l) => l.description?.includes("CPP2"))).toBe(false);
  });

  it("balances in Mode 1 too", () => {
    const payload = buildJournalPayload(QC_RUN, "QC Staff", "MODE1", DEFAULT_MAPPING);
    expect(sumCents(payload.lines, "debit")).toBe(sumCents(payload.lines, "credit"));
  });
});

describe("buildJournalPayload — balance assertion", () => {
  it("throws UnbalancedJournalError when rounded lines do not balance", () => {
    const broken = { ...BASE_RUN, totalNetPay: BASE_RUN.totalNetPay - 5 };
    expect(() => buildJournalPayload(broken, "G", "MODE1", DEFAULT_MAPPING)).toThrow(UnbalancedJournalError);
  });

  it("normalizeMapping fills defaults for missing/garbage values", () => {
    const m = normalizeMapping({ wagesExpense: " 6921 ", bogus: 1, cppPayable: "" });
    expect(m.wagesExpense).toBe("6921");
    expect(m.cppPayable).toBe(DEFAULT_MAPPING.cppPayable);
    expect(m.employerEiExpense).toBe("6940");
  });
});

// ─── Sync service (M3/M4) ─────────────────────────────────────────────────────

describe("syncPayRun", () => {
  it("posts the journal and persists SYNCED with the entry ID", async () => {
    const store = new FakeStore(); const lp = new FakeLedgerPro();
    seedRun(store);
    const res = await syncPayRun(makeDeps(store, lp), BASE_RUN.id);
    expect(res.outcome).toBe("synced");
    const rec = store.records.get(BASE_RUN.id);
    expect(rec?.status).toBe("SYNCED");
    expect(rec?.ledgerEntryId).toBe("je_1");
    expect(rec?.idempotencyKey).toBe(idempotencyKeyForRun(BASE_RUN.id));
    expect(lp.createCalls[0]?.key).toBe("nexvarpay-payrun-run_abc123456789");
  });

  it("is idempotent: a second sync of a SYNCED run issues no second POST", async () => {
    const store = new FakeStore(); const lp = new FakeLedgerPro();
    seedRun(store);
    const deps = makeDeps(store, lp);
    await syncPayRun(deps, BASE_RUN.id);
    const res2 = await syncPayRun(deps, BASE_RUN.id);
    expect(res2.outcome).toBe("already_synced");
    expect(lp.createCalls).toHaveLength(1);
    expect(lp.journals.size).toBe(1);
  });

  it("treats a replayed stored success as success without a duplicate journal", async () => {
    const store = new FakeStore(); const lp = new FakeLedgerPro();
    seedRun(store);
    const deps = makeDeps(store, lp);
    await syncPayRun(deps, BASE_RUN.id);
    // Simulate the SYNCED write being lost (crash after LedgerPro committed):
    store.records.delete(BASE_RUN.id);
    const res = await syncPayRun(deps, BASE_RUN.id);
    expect(res.outcome).toBe("synced");
    expect(lp.createCalls).toHaveLength(2);
    expect(lp.createCalls[1]?.key).toBe(lp.createCalls[0]?.key); // same key
    expect(lp.journals.size).toBe(1); // replay — still one journal
    expect(store.records.get(BASE_RUN.id)?.ledgerEntryId).toBe("je_1");
  });

  it("does not call the API at all when sync is disabled", async () => {
    const store = new FakeStore(); const lp = new FakeLedgerPro();
    store.connection = makeConnection({ syncEnabled: false });
    seedRun(store);
    const createClient = vi.fn(() => lp.client() as never);
    const res = await syncPayRun({ store, createClient }, BASE_RUN.id);
    expect(res.outcome).toBe("skipped");
    expect(createClient).not.toHaveBeenCalled();
    expect(store.records.size).toBe(0);
  });

  it("records FAILED and resolves (never throws) when LedgerPro fails — payroll still finalizes", async () => {
    const store = new FakeStore(); const lp = new FakeLedgerPro();
    lp.createError = new LedgerProError({ kind: "network", status: null, message: "Could not reach LedgerPro: boom" });
    seedRun(store);
    const res = await syncPayRun(makeDeps(store, lp), BASE_RUN.id);
    expect(res.outcome).toBe("failed");
    expect(store.records.get(BASE_RUN.id)?.status).toBe("FAILED");
    expect(store.records.get(BASE_RUN.id)?.lastError).toContain("LedgerPro");
  });

  it("maps a closed-period 409 to BLOCKED with the key intact, and Retry reuses the same key", async () => {
    const store = new FakeStore(); const lp = new FakeLedgerPro();
    lp.createError = new LedgerProError({ kind: "closed_period", status: 409, code: null, message: "Period 2026-11 is closed." });
    seedRun(store);
    const deps = makeDeps(store, lp);
    const res = await syncPayRun(deps, BASE_RUN.id);
    expect(res.outcome).toBe("blocked");
    const rec = store.records.get(BASE_RUN.id);
    expect(rec?.status).toBe("BLOCKED");
    expect(rec?.lastError).toContain("closed");
    expect(rec?.idempotencyKey).toBe("nexvarpay-payrun-run_abc123456789");

    lp.createError = null; // period reopened
    const retry = await syncPayRun(deps, BASE_RUN.id);
    expect(retry.outcome).toBe("synced");
    expect(lp.createCalls[1]?.key).toBe(lp.createCalls[0]?.key);
  });

  it("maps the plan gate to a plain-language FAILED", async () => {
    const store = new FakeStore(); const lp = new FakeLedgerPro();
    lp.createError = new LedgerProError({ kind: "plan", status: 403, code: "api_plan_required", message: "plan required" });
    seedRun(store);
    const res = await syncPayRun(makeDeps(store, lp), BASE_RUN.id);
    expect(res.outcome).toBe("failed");
    expect(store.records.get(BASE_RUN.id)?.lastError).toContain("API access isn't enabled");
  });

  it("fails pre-flight naming the missing code, without POSTing", async () => {
    const store = new FakeStore(); const lp = new FakeLedgerPro();
    store.connection = makeConnection({ mappingMode: "MODE2" });
    lp.accounts = ALL_ACCOUNTS.filter((a) => a.code !== "2430");
    seedRun(store);
    const res = await syncPayRun(makeDeps(store, lp), BASE_RUN.id);
    expect(res.outcome).toBe("failed");
    expect(store.records.get(BASE_RUN.id)?.lastError).toContain("2430");
    expect(lp.createCalls).toHaveLength(0);
  });

  it("records FAILED without POSTing when the rounded journal is unbalanced", async () => {
    const store = new FakeStore(); const lp = new FakeLedgerPro();
    seedRun(store, { ...BASE_RUN, totalNetPay: 1 });
    const res = await syncPayRun(makeDeps(store, lp), BASE_RUN.id);
    expect(res.outcome).toBe("failed");
    expect(store.records.get(BASE_RUN.id)?.lastError).toContain("rounding mismatch");
    expect(lp.createCalls).toHaveLength(0);
  });
});

// ─── Void path (M5, service level) ────────────────────────────────────────────

describe("voidPayRunSync", () => {
  it("voids with the -void key and marks the record VOIDED", async () => {
    const store = new FakeStore(); const lp = new FakeLedgerPro();
    seedRun(store);
    const deps = makeDeps(store, lp);
    await syncPayRun(deps, BASE_RUN.id);
    const res = await voidPayRunSync(deps, BASE_RUN.id);
    expect(res.outcome).toBe("voided");
    expect(lp.voidCalls).toHaveLength(1);
    expect(lp.voidCalls[0]?.key).toBe("nexvarpay-payrun-run_abc123456789-void");
    expect(lp.voidCalls[0]?.entryId).toBe("je_1");
    expect(store.records.get(BASE_RUN.id)?.status).toBe("VOIDED");
  });

  it("reports failure (so the caller can block deletion) when the void fails", async () => {
    const store = new FakeStore(); const lp = new FakeLedgerPro();
    seedRun(store);
    const deps = makeDeps(store, lp);
    await syncPayRun(deps, BASE_RUN.id);
    lp.voidError = new LedgerProError({ kind: "closed_period", status: 409, code: null, message: "Today is in a closed period." });
    const res = await voidPayRunSync(deps, BASE_RUN.id);
    expect(res.outcome).toBe("failed");
    expect(store.records.get(BASE_RUN.id)?.status).toBe("SYNCED"); // untouched
  });

  it("is a no-op for a run that was never synced", async () => {
    const store = new FakeStore(); const lp = new FakeLedgerPro();
    seedRun(store);
    const res = await voidPayRunSync(makeDeps(store, lp), BASE_RUN.id);
    expect(res.outcome).toBe("not_synced");
    expect(lp.voidCalls).toHaveLength(0);
  });
});

// ─── Client error mapping (M2) ────────────────────────────────────────────────

describe("createLedgerProClient error mapping", () => {
  function clientWith(status: number, body: string) {
    const fetchFn = vi.fn(async () => new Response(body, { status }));
    return createLedgerProClient({ baseUrl: "https://ledger.example.com/", apiKey: "lp_live_x", fetchFn: fetchFn as never });
  }

  it("sends Bearer auth + Idempotency-Key and unwraps { data }", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ data: { id: "je_9", entryDate: "2026-11-15", description: "d", sourceType: "manual" } }), { status: 201 }));
    const client = createLedgerProClient({ baseUrl: "https://ledger.example.com", apiKey: "lp_live_x", fetchFn: fetchFn as never });
    const res = await client.createJournalEntry({ entryDate: "2026-11-15", description: "d", lines: [] }, "key-1");
    expect(res.ok).toBe(true);
    const init = (fetchFn.mock.calls[0] as unknown[])[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer lp_live_x");
    expect(headers["Idempotency-Key"]).toBe("key-1");
  });

  it("classifies 403 api_access_disabled as plan", async () => {
    const res = await clientWith(403, JSON.stringify({ error: { code: "api_access_disabled", message: "off" } })).listAccounts();
    expect(res.ok).toBe(false);
    if (!res.ok) { expect(res.error.kind).toBe("plan"); expect(res.error.code).toBe("api_access_disabled"); }
  });

  it("classifies a plain-body 409 as closed_period", async () => {
    const res = await clientWith(409, "Period is closed").createJournalEntry({ entryDate: "2026-01-01", description: "d", lines: [] }, "k");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("closed_period");
  });

  it("classifies 409 idempotency_key_conflict distinctly", async () => {
    const res = await clientWith(409, JSON.stringify({ error: { code: "idempotency_key_conflict" } })).createJournalEntry({ entryDate: "2026-01-01", description: "d", lines: [] }, "k");
    expect(res.ok).toBe(false);
    if (!res.ok) { expect(res.error.kind).toBe("idempotency_conflict"); expect(res.error.code).toBe("idempotency_key_conflict"); }
  });

  it("preserves LedgerPro's code on 400 invalid_account", async () => {
    const res = await clientWith(400, JSON.stringify({ error: { code: "invalid_account", message: "Account 9999 is missing or inactive" } })).createJournalEntry({ entryDate: "2026-01-01", description: "d", lines: [] }, "k");
    expect(res.ok).toBe(false);
    if (!res.ok) { expect(res.error.kind).toBe("validation"); expect(res.error.code).toBe("invalid_account"); expect(res.error.message).toContain("9999"); }
  });

  it("classifies a thrown fetch as network", async () => {
    const fetchFn = vi.fn(async () => { throw new Error("ECONNREFUSED"); });
    const client = createLedgerProClient({ baseUrl: "https://ledger.example.com", apiKey: "k", fetchFn: fetchFn as never });
    const res = await client.listAccounts();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("network");
  });
});

// ─── Client pagination (Fix 1) ────────────────────────────────────────────────
// LedgerPro's GET /api/v1/accounts is cursor-paginated (default 50/page,
// ordered by code asc). Muja has 52 accounts, so its two highest mapped
// codes (6920, 6940) live on page 2 — a first-page-only client made the
// pre-flight report them "missing or inactive" (the live pilot failure).

describe("createLedgerProClient listAccounts pagination", () => {
  const acct = (code: string): LedgerProAccount => ({ code, name: `Account ${code}`, active: true });

  /** Muja-shaped chart: 50 accounts on page 1 (incl. the low mapped codes), 6920 + 6940 alone on page 2. */
  function mujaPages() {
    const fillers = Array.from({ length: 46 }, (_, i) => acct(`1${100 + i}`));
    const page1 = [acct("2410"), acct("2420"), acct("2430"), acct("2440"), ...fillers];
    const page2 = [acct("6920"), acct("6940")];
    return { page1, page2 };
  }

  function fetchServing(handler: (url: string) => Response) {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (input: string) => {
      calls.push(String(input));
      return handler(String(input));
    });
    return { fetchFn, calls };
  }

  function mujaFetch() {
    const { page1, page2 } = mujaPages();
    return fetchServing((url) => {
      const cursor = new URL(url).searchParams.get("cursor");
      if (cursor === "acct_050") {
        return new Response(JSON.stringify({ data: page2, pagination: { nextCursor: null, hasMore: false } }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: page1, pagination: { nextCursor: "acct_050", hasMore: true } }), { status: 200 });
    });
  }

  it("walks every page: the full 52-account chart comes back and no Mode 2 code is missing", async () => {
    const { fetchFn, calls } = mujaFetch();
    const client = createLedgerProClient({ baseUrl: "https://ledger.example.com", apiKey: "k", fetchFn: fetchFn as never });
    const res = await client.listAccounts();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(52);
    expect(res.data.map((a) => a.code)).toContain("6920");
    expect(res.data.map((a) => a.code)).toContain("6940");
    expect(findMissingCodes(res.data, mappedCodes("MODE2", DEFAULT_MAPPING))).toEqual([]);
    // Page 2 was requested with page 1's cursor, at the max page size.
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("limit=100");
    expect(calls[1]).toContain("cursor=acct_050");
  });

  it("single-page behaviour is unchanged (with and without a pagination envelope)", async () => {
    const withEnvelope = fetchServing(() =>
      new Response(JSON.stringify({ data: ALL_ACCOUNTS, pagination: { nextCursor: null, hasMore: false } }), { status: 200 }));
    const clientA = createLedgerProClient({ baseUrl: "https://ledger.example.com", apiKey: "k", fetchFn: withEnvelope.fetchFn as never });
    const resA = await clientA.listAccounts();
    expect(resA.ok).toBe(true);
    if (resA.ok) expect(resA.data).toEqual(ALL_ACCOUNTS);
    expect(withEnvelope.calls).toHaveLength(1);

    const bare = fetchServing(() => new Response(JSON.stringify({ data: ALL_ACCOUNTS }), { status: 200 }));
    const clientB = createLedgerProClient({ baseUrl: "https://ledger.example.com", apiKey: "k", fetchFn: bare.fetchFn as never });
    const resB = await clientB.listAccounts();
    expect(resB.ok).toBe(true);
    if (resB.ok) expect(resB.data).toEqual(ALL_ACCOUNTS);
    expect(bare.calls).toHaveLength(1);
  });

  it("a page-2 HTTP failure returns the typed error — never a partial list", async () => {
    const { page1 } = mujaPages();
    const { fetchFn, calls } = fetchServing((url) => {
      if (new URL(url).searchParams.get("cursor")) return new Response("boom", { status: 500 });
      return new Response(JSON.stringify({ data: page1, pagination: { nextCursor: "acct_050", hasMore: true } }), { status: 200 });
    });
    const client = createLedgerProClient({ baseUrl: "https://ledger.example.com", apiKey: "k", fetchFn: fetchFn as never });
    const res = await client.listAccounts();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBeInstanceOf(LedgerProError);
      expect(res.error.kind).toBe("http");
      expect(res.error.status).toBe(500);
    }
    expect(calls).toHaveLength(2);
  });

  it("a repeated cursor bails with a typed error instead of looping", async () => {
    const { fetchFn, calls } = fetchServing(() =>
      new Response(JSON.stringify({ data: [acct("1000")], pagination: { nextCursor: "loop", hasMore: true } }), { status: 200 }));
    const client = createLedgerProClient({ baseUrl: "https://ledger.example.com", apiKey: "k", fetchFn: fetchFn as never });
    const res = await client.listAccounts();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain("repeated a pagination cursor");
    expect(calls).toHaveLength(2); // first page + first cursor page, then stop
  });

  it("runaway pagination is capped with a typed error", async () => {
    const { fetchFn, calls } = fetchServing((url) => {
      const cursor = new URL(url).searchParams.get("cursor");
      const n = cursor ? Number(cursor.slice(1)) : 0;
      return new Response(JSON.stringify({ data: [acct("1000")], pagination: { nextCursor: `c${n + 1}`, hasMore: true } }), { status: 200 });
    });
    const client = createLedgerProClient({ baseUrl: "https://ledger.example.com", apiKey: "k", fetchFn: fetchFn as never });
    const res = await client.listAccounts();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain("did not finish");
    expect(calls).toHaveLength(100); // MAX_ACCOUNT_PAGES — terminated, not infinite
  });

  it("malformed pagination (hasMore with no cursor) is a typed error", async () => {
    const { fetchFn } = fetchServing(() =>
      new Response(JSON.stringify({ data: [acct("1000")], pagination: { nextCursor: null, hasMore: true } }), { status: 200 }));
    const client = createLedgerProClient({ baseUrl: "https://ledger.example.com", apiKey: "k", fetchFn: fetchFn as never });
    const res = await client.listAccounts();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain("no usable cursor");
  });

  it("testConnection passes end-to-end over a paginated chart (the pilot scenario)", async () => {
    const { fetchFn } = mujaFetch();
    const result = await testConnection(
      { createClient: (conn) => createLedgerProClient({ ...conn, fetchFn: fetchFn as never }) },
      { baseUrl: "https://ledger.example.com", apiKey: "k", mappingMode: "MODE2", mapping: DEFAULT_MAPPING },
    );
    expect(result.ok).toBe(true);
    expect(result.missingCodes).toEqual([]);
    expect(result.message).toContain("52 accounts found");
  });
});

// ─── Integrations form state (Fix 2) ──────────────────────────────────────────
// Persistence was never wrong: the save action stores the submitted mode
// verbatim and the store/settings page read it back with the same
// normalization a finalize-time sync uses. The bug was display-only — the
// form kept its mount-time state and never re-synced from the saved
// connection, so after a save it could show a different mode than the one
// persisted. These tests pin the pure rules the component now applies:
// derive form state from the saved connection, and detect "the saved
// connection changed" via a stable fingerprint.

describe("LedgerPro form state (Fix 2)", () => {
  function makeView(overrides: Partial<LedgerProConnectionView> = {}): LedgerProConnectionView {
    return {
      baseUrl: "https://ledger.nexvarlab.com",
      mappingMode: "MODE2",
      mapping: { ...DEFAULT_MAPPING },
      syncEnabled: true,
      hasKey: true,
      ...overrides,
    };
  }

  it("derives the form state from the saved connection — Mode 2 stays Mode 2", () => {
    const state = formStateFromConnection(makeView());
    expect(state.mode).toBe("MODE2");
    expect(state.baseUrl).toBe("https://ledger.nexvarlab.com");
    expect(state.syncEnabled).toBe(true);
    expect(state.mapping).toEqual(DEFAULT_MAPPING);
  });

  it("falls back to first-connect defaults when there is no saved connection", () => {
    const state = formStateFromConnection(null);
    expect(state.mode).toBe("MODE1");
    expect(state.syncEnabled).toBe(false);
    expect(state.mapping).toEqual(DEFAULT_MAPPING);
  });

  it("fingerprints equal saved connections equally, regardless of object identity or mapping key order", () => {
    const a = makeView();
    const reordered = { ...DEFAULT_MAPPING };
    const b = makeView({ mapping: Object.fromEntries(Object.entries(reordered).reverse()) as never });
    expect(connectionFingerprint(a)).toBe(connectionFingerprint(a));
    expect(connectionFingerprint(b)).toBe(connectionFingerprint(a));
    expect(connectionFingerprint(null)).toBe("null");
  });

  it("the fingerprint changes when the saved mode, a mapped code, or the key presence changes", () => {
    const base = makeView();
    expect(connectionFingerprint(makeView({ mappingMode: "MODE1" }))).not.toBe(connectionFingerprint(base));
    expect(connectionFingerprint(makeView({ mapping: { ...DEFAULT_MAPPING, cppPayable: "2411" } }))).not.toBe(connectionFingerprint(base));
    expect(connectionFingerprint(makeView({ hasKey: false }))).not.toBe(connectionFingerprint(base));
    expect(connectionFingerprint(makeView({ syncEnabled: false }))).not.toBe(connectionFingerprint(base));
  });

  it("a save landing with a different mode re-derives the form from the new record", () => {
    // The component's rule: fingerprint changed → form = formStateFromConnection(new saved view).
    const before = makeView({ mappingMode: "MODE1" });
    const afterSave = makeView({ mappingMode: "MODE2" });
    expect(connectionFingerprint(afterSave)).not.toBe(connectionFingerprint(before));
    expect(formStateFromConnection(afterSave).mode).toBe("MODE2");
  });
});
