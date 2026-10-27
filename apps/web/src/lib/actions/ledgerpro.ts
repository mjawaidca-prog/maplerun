"use server";

/**
 * Server actions for the LedgerPro integration (M4 retry, M5 reverse,
 * M6 connection management).
 *
 * Save/disconnect follow the repo's form-action pattern (throw on invalid
 * input, revalidate on success). Retry/reverse never throw for LedgerPro
 * failures — the outcome lands on the sync record and the UI re-renders it.
 */

import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { revalidatePath } from "next/cache";
import {
  DEFAULT_MAPPING,
  normalizeMapping,
  type LedgerProMapping,
  type MappingMode,
} from "@/lib/ledgerpro-journal";
import { syncPayRun, voidPayRunSync } from "@/lib/ledgerpro-sync";
import { ledgerProSyncDeps } from "@/lib/ledgerpro-store";

const MAPPING_KEYS = Object.keys(DEFAULT_MAPPING) as (keyof LedgerProMapping)[];

function mappingFromForm(formData: FormData): LedgerProMapping {
  const raw: Record<string, unknown> = {};
  for (const key of MAPPING_KEYS) {
    const v = formData.get(`map_${key}`);
    if (typeof v === "string") raw[key] = v;
  }
  return normalizeMapping(raw);
}

function cleanBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("LedgerPro base URL is not a valid URL.");
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("LedgerPro base URL must use https.");
  }
  return trimmed;
}

/** Create or update the company's LedgerPro connection. Blank API key = keep the stored one. */
export async function saveLedgerProConnection(formData: FormData) {
  const { companyId } = await requireCompany();

  const baseUrl = cleanBaseUrl((formData.get("baseUrl") as string) ?? "");
  const apiKeyInput = ((formData.get("apiKey") as string) ?? "").trim();
  const mappingMode: MappingMode = formData.get("mappingMode") === "MODE2" ? "MODE2" : "MODE1";
  const mapping = mappingFromForm(formData);
  const syncEnabled = formData.get("syncEnabled") === "on";

  const existing = await prisma.ledgerProConnection.findUnique({ where: { companyId } });

  if (!existing && !apiKeyInput) {
    throw new Error("Paste the LedgerPro API key to connect.");
  }

  const data = {
    baseUrl,
    mappingMode,
    mapping: mapping as unknown as Record<string, string>,
    syncEnabled,
    ...(apiKeyInput ? { apiKeyEncrypted: encrypt(apiKeyInput) } : {}),
  };

  await prisma.ledgerProConnection.upsert({
    where: { companyId },
    // On create, apiKeyInput is guaranteed non-empty by the check above.
    create: { companyId, apiKeyEncrypted: encrypt(apiKeyInput), ...data },
    update: data,
  });

  revalidatePath("/company");
}

/** Disconnect LedgerPro: deletes the stored (encrypted) key and the connection. Sync history is kept. */
export async function disconnectLedgerPro() {
  const { companyId } = await requireCompany();
  await prisma.ledgerProConnection.deleteMany({ where: { companyId } });
  revalidatePath("/company");
}

/**
 * Manual Retry (M4) — re-runs the sync for one pay run with the SAME
 * idempotency key. No-ops when the run is already SYNCED (the sync service
 * also treats a LedgerPro replayed success as success, never a duplicate).
 */
export async function retryLedgerProSync(formData: FormData) {
  const { companyId } = await requireCompany();
  const payRunId = formData.get("payRunId") as string;
  if (!payRunId) throw new Error("Pay run ID required.");

  const run = await prisma.payRun.findUnique({ where: { id: payRunId }, select: { companyId: true } });
  if (!run || run.companyId !== companyId) throw new Error("Pay run not found.");

  const record = await prisma.ledgerProSyncRecord.findUnique({ where: { payRunId } });
  if (record?.status === "SYNCED") {
    revalidatePath("/payroll");
    return; // already synced — no-op
  }

  // Retry must work even though finalize-time sync respects the toggle:
  // pressing Retry is the owner's explicit instruction, so temporarily
  // honour it regardless of the toggle state recorded at finalize time.
  // (syncPayRun checks the toggle; the deps wrapper below forces it on
  // for this manual path only.)
  await syncPayRun(retryDeps, payRunId);
  revalidatePath("/payroll");
  revalidatePath(`/payroll/${payRunId}`);
}

/** Manual "Reverse in LedgerPro" (M5) — voids the journal without deleting the run. */
export async function reverseLedgerProSync(formData: FormData) {
  const { companyId } = await requireCompany();
  const payRunId = formData.get("payRunId") as string;
  if (!payRunId) throw new Error("Pay run ID required.");

  const run = await prisma.payRun.findUnique({ where: { id: payRunId }, select: { companyId: true } });
  if (!run || run.companyId !== companyId) throw new Error("Pay run not found.");

  const result = await voidPayRunSync(ledgerProSyncDeps, payRunId);
  if (result.outcome === "failed") {
    throw new Error(`Could not reverse the LedgerPro journal: ${result.error}`);
  }
  revalidatePath("/payroll");
  revalidatePath(`/payroll/${payRunId}`);
}

/** Deps wrapper for the manual Retry path: same store/client, toggle forced on. */
const retryDeps: typeof ledgerProSyncDeps = {
  ...ledgerProSyncDeps,
  store: {
    ...ledgerProSyncDeps.store,
    async getConnection(companyId: string) {
      const conn = await ledgerProSyncDeps.store.getConnection(companyId);
      return conn ? { ...conn, syncEnabled: true } : conn;
    },
  },
};
