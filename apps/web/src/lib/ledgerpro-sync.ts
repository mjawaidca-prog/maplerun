/**
 * Sync service for Nexvar Pay → LedgerPro (M3/M4/M5 core).
 *
 * Orchestration only — storage and HTTP are injected (`SyncStore`,
 * `createClient`) so the whole flow is unit-testable with fakes and the
 * payroll actions stay thin. EVERY public function here is failure-isolated:
 * it returns an outcome object and never throws into payroll code paths.
 *
 * Status mapping (scoping doc §3.5):
 *   POST success (incl. LedgerPro replaying a stored success for the same
 *     key+payload)                    → SYNCED, entry ID stored
 *   409 closed period                 → BLOCKED (key NOT burned — retry reuses it)
 *   unbalanced rounded lines (local)  → FAILED, never POSTed
 *   missing/inactive mapped account   → FAILED, names the code(s)
 *   anything else ≥400 / network      → FAILED with a plain-language error
 */

import {
  describeLedgerProError,
  type LedgerProClient,
  type LedgerProError,
} from "./ledgerpro";
import {
  buildJournalPayload,
  idempotencyKeyForRun,
  mappedCodes,
  normalizeMapping,
  UnbalancedJournalError,
  voidIdempotencyKeyForRun,
  type LedgerProMapping,
  type MappingMode,
  type PayRunTotals,
} from "./ledgerpro-journal";

// ─── Injected dependencies ────────────────────────────────────────────────────

export interface SyncConnection {
  companyId: string;
  baseUrl: string;
  /** Plaintext API key (the store layer decrypts; never log this). */
  apiKey: string;
  mappingMode: MappingMode;
  mapping: LedgerProMapping;
  syncEnabled: boolean;
}

export type SyncStatus = "PENDING" | "SYNCED" | "FAILED" | "BLOCKED" | "VOIDED";

export interface SyncRecordData {
  payRunId: string;
  companyId: string;
  idempotencyKey: string;
  ledgerEntryId: string | null;
  status: SyncStatus;
  lastError: string | null;
  syncedAt: Date | null;
}

export interface PayRunForSync extends PayRunTotals {
  companyId: string;
  status: string;
  payGroupName: string;
}

export interface SyncStore {
  getConnection(companyId: string): Promise<SyncConnection | null>;
  getPayRun(payRunId: string): Promise<PayRunForSync | null>;
  getRecord(payRunId: string): Promise<SyncRecordData | null>;
  upsertRecord(record: SyncRecordData): Promise<void>;
}

export interface SyncDeps {
  store: SyncStore;
  createClient: (conn: { baseUrl: string; apiKey: string }) => LedgerProClient;
}

// ─── Outcomes ─────────────────────────────────────────────────────────────────

export type SyncOutcome =
  | { outcome: "synced"; entryId: string }
  | { outcome: "already_synced"; entryId: string | null }
  | { outcome: "skipped"; reason: string }
  | { outcome: "failed" | "blocked"; error: string };

export type VoidOutcome =
  | { outcome: "voided" }
  | { outcome: "not_synced" }
  | { outcome: "failed"; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Codes from the mapping that are absent or inactive in LedgerPro. */
export function findMissingCodes(
  accounts: { code: string; active?: boolean; isActive?: boolean }[],
  codes: string[],
): string[] {
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  return codes.filter((code) => {
    const acct = byCode.get(code);
    if (!acct) return true;
    if (acct.active === false || acct.isActive === false) return true;
    return false;
  });
}

export function missingCodesMessage(codes: string[]): string {
  return `Account ${codes.join(", ")} is missing or inactive in LedgerPro — check the mapping in Company → Integrations.`;
}

function failureStatus(error: LedgerProError): "blocked" | "failed" {
  return error.kind === "closed_period" ? "blocked" : "failed";
}

function failureMessage(error: LedgerProError): string {
  if (error.kind === "validation" && error.code === "invalid_account") {
    // LedgerPro's message names the account; keep it, it's the actionable part.
    return error.message;
  }
  return describeLedgerProError(error);
}

// ─── Sync one pay run ─────────────────────────────────────────────────────────

export async function syncPayRun(deps: SyncDeps, payRunId: string): Promise<SyncOutcome> {
  try {
    const run = await deps.store.getPayRun(payRunId);
    if (!run) return { outcome: "skipped", reason: "Pay run not found." };
    if (run.status !== "FINALIZED") {
      return { outcome: "skipped", reason: `Pay run is ${run.status}, not FINALIZED.` };
    }

    const conn = await deps.store.getConnection(run.companyId);
    if (!conn) return { outcome: "skipped", reason: "No LedgerPro connection for this company." };
    if (!conn.syncEnabled) return { outcome: "skipped", reason: "LedgerPro sync is switched off for this company." };

    const existing = await deps.store.getRecord(payRunId);
    if (existing?.status === "SYNCED") {
      return { outcome: "already_synced", entryId: existing.ledgerEntryId };
    }
    if (existing?.status === "VOIDED") {
      return { outcome: "failed", error: "This run's LedgerPro journal was reversed. Reversing is final for v1 — flag it for review instead of retrying." };
    }

    const idempotencyKey = idempotencyKeyForRun(payRunId);
    const base: SyncRecordData = {
      payRunId,
      companyId: run.companyId,
      idempotencyKey,
      ledgerEntryId: existing?.ledgerEntryId ?? null,
      status: "PENDING",
      lastError: null,
      syncedAt: existing?.syncedAt ?? null,
    };
    await deps.store.upsertRecord(base);

    const recordFailure = async (status: "failed" | "blocked", error: string): Promise<SyncOutcome> => {
      await deps.store.upsertRecord({
        ...base,
        status: status === "blocked" ? "BLOCKED" : "FAILED",
        lastError: error,
      });
      return { outcome: status, error };
    };

    // Build + balance-check locally before any network call.
    let payload;
    try {
      payload = buildJournalPayload(run, run.payGroupName, conn.mappingMode, conn.mapping);
    } catch (err) {
      if (err instanceof UnbalancedJournalError) return recordFailure("failed", err.message);
      throw err;
    }

    const client = deps.createClient(conn);

    // Pre-flight: mapped codes must exist and be active in LedgerPro.
    const accountsRes = await client.listAccounts();
    if (!accountsRes.ok) {
      return recordFailure(failureStatus(accountsRes.error), failureMessage(accountsRes.error));
    }
    const missing = findMissingCodes(accountsRes.data, mappedCodes(conn.mappingMode, conn.mapping));
    if (missing.length > 0) {
      return recordFailure("failed", missingCodesMessage(missing));
    }

    // POST the journal. A replayed stored success (same key + payload)
    // returns 201 with the original entry — indistinguishable from a fresh
    // post, and correctly treated as success either way (no duplicate).
    const res = await client.createJournalEntry(payload, idempotencyKey);
    if (!res.ok) {
      return recordFailure(failureStatus(res.error), failureMessage(res.error));
    }

    await deps.store.upsertRecord({
      ...base,
      status: "SYNCED",
      ledgerEntryId: res.data.id,
      lastError: null,
      syncedAt: new Date(),
    });
    return { outcome: "synced", entryId: res.data.id };
  } catch (err) {
    // Last-resort isolation: a sync problem must never break payroll.
    const message = err instanceof Error ? err.message : String(err);
    try {
      const run = await deps.store.getPayRun(payRunId).catch(() => null);
      if (run) {
        await deps.store.upsertRecord({
          payRunId,
          companyId: run.companyId,
          idempotencyKey: idempotencyKeyForRun(payRunId),
          ledgerEntryId: null,
          status: "FAILED",
          lastError: `Sync failed unexpectedly: ${message}`,
          syncedAt: null,
        });
      }
    } catch {
      // Even the failure record failed — swallow; payroll must proceed.
    }
    return { outcome: "failed", error: message };
  }
}

// ─── Void a synced run's journal (M5) ─────────────────────────────────────────

export async function voidPayRunSync(deps: SyncDeps, payRunId: string): Promise<VoidOutcome> {
  try {
    const record = await deps.store.getRecord(payRunId);
    if (!record || record.status !== "SYNCED" || !record.ledgerEntryId) {
      return { outcome: "not_synced" };
    }
    const run = await deps.store.getPayRun(payRunId);
    const companyId = run?.companyId ?? record.companyId;
    const conn = await deps.store.getConnection(companyId);
    if (!conn) {
      return { outcome: "failed", error: "No LedgerPro connection is stored for this company, so the journal can't be reversed. Reconnect LedgerPro first." };
    }

    const client = deps.createClient(conn);
    const res = await client.voidJournalEntry(record.ledgerEntryId, voidIdempotencyKeyForRun(payRunId));
    if (!res.ok) {
      return { outcome: "failed", error: failureMessage(res.error) };
    }

    await deps.store.upsertRecord({ ...record, status: "VOIDED", lastError: null });
    return { outcome: "voided" };
  } catch (err) {
    return { outcome: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Test connection (M6) ─────────────────────────────────────────────────────

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  missingCodes: string[];
}

export async function testConnection(
  deps: Pick<SyncDeps, "createClient">,
  conn: { baseUrl: string; apiKey: string; mappingMode: MappingMode; mapping: unknown },
): Promise<TestConnectionResult> {
  const mapping = normalizeMapping(conn.mapping);
  const client = deps.createClient(conn);
  const res = await client.listAccounts();
  if (!res.ok) {
    return { ok: false, message: failureMessage(res.error), missingCodes: [] };
  }
  const missing = findMissingCodes(res.data, mappedCodes(conn.mappingMode, mapping));
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Connected to LedgerPro, but ${missingCodesMessage(missing)}`,
      missingCodes: missing,
    };
  }
  return {
    ok: true,
    message: `Connected to LedgerPro — ${res.data.length} accounts found and every mapped payroll account exists and is active.`,
    missingCodes: [],
  };
}
