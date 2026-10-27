/**
 * Prisma-backed SyncStore + default deps for the LedgerPro sync.
 *
 * This is the only sync file that touches Prisma / encryption, keeping
 * ledgerpro-sync.ts pure orchestration (unit-testable with fakes).
 */

import { prisma } from "./prisma";
import { decrypt } from "./encryption";
import { createLedgerProClient } from "./ledgerpro";
import { normalizeMapping, type MappingMode } from "./ledgerpro-journal";
import type { SyncDeps, SyncStore } from "./ledgerpro-sync";

export const prismaSyncStore: SyncStore = {
  async getConnection(companyId) {
    const conn = await prisma.ledgerProConnection.findUnique({ where: { companyId } });
    if (!conn) return null;
    let apiKey: string;
    try {
      apiKey = decrypt(conn.apiKeyEncrypted);
    } catch {
      // Corrupt/undecryptable key — treat as no usable connection rather
      // than throwing into a payroll path.
      return null;
    }
    return {
      companyId: conn.companyId,
      baseUrl: conn.baseUrl,
      apiKey,
      mappingMode: (conn.mappingMode === "MODE2" ? "MODE2" : "MODE1") as MappingMode,
      mapping: normalizeMapping(conn.mapping),
      syncEnabled: conn.syncEnabled,
    };
  },

  async getPayRun(payRunId) {
    const run = await prisma.payRun.findUnique({
      where: { id: payRunId },
      include: { payGroup: { select: { name: true } } },
    });
    if (!run) return null;
    return {
      id: run.id,
      companyId: run.companyId,
      status: run.status,
      payGroupName: run.payGroup.name,
      payDate: run.payDate,
      actualPayDate: run.actualPayDate,
      itemCount: run.itemCount,
      totalGross: run.totalGross,
      totalCpp: run.totalCpp,
      totalCpp2: run.totalCpp2,
      totalEi: run.totalEi,
      totalFederalTax: run.totalFederalTax,
      totalProvincialTax: run.totalProvincialTax,
      totalNetPay: run.totalNetPay,
      totalEmployerCpp: run.totalEmployerCpp,
      totalEmployerCpp2: run.totalEmployerCpp2,
      totalEmployerEi: run.totalEmployerEi,
      totalEmployerCost: run.totalEmployerCost,
    };
  },

  async getRecord(payRunId) {
    const rec = await prisma.ledgerProSyncRecord.findUnique({ where: { payRunId } });
    if (!rec) return null;
    return {
      payRunId: rec.payRunId,
      companyId: rec.companyId,
      idempotencyKey: rec.idempotencyKey,
      ledgerEntryId: rec.ledgerEntryId,
      status: rec.status as SyncRecordStatus,
      lastError: rec.lastError,
      syncedAt: rec.syncedAt,
    };
  },

  async upsertRecord(record) {
    await prisma.ledgerProSyncRecord.upsert({
      where: { payRunId: record.payRunId },
      create: {
        payRunId: record.payRunId,
        companyId: record.companyId,
        idempotencyKey: record.idempotencyKey,
        ledgerEntryId: record.ledgerEntryId,
        status: record.status,
        lastError: record.lastError,
        syncedAt: record.syncedAt,
      },
      update: {
        idempotencyKey: record.idempotencyKey,
        ledgerEntryId: record.ledgerEntryId,
        status: record.status,
        lastError: record.lastError,
        syncedAt: record.syncedAt,
      },
    });
  },
};

type SyncRecordStatus = "PENDING" | "SYNCED" | "FAILED" | "BLOCKED" | "VOIDED";

export const ledgerProSyncDeps: SyncDeps = {
  store: prismaSyncStore,
  createClient: (conn) => createLedgerProClient({ baseUrl: conn.baseUrl, apiKey: conn.apiKey }),
};
