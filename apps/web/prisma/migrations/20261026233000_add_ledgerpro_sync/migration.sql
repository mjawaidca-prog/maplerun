-- Nexvar Pay → LedgerPro payroll sync v1 (tasks M1–M6).
--
-- HAND-TRIMMED migration: contains ONLY the DDL for the two new models
-- (LedgerProConnection, LedgerProSyncRecord) plus their indexes and
-- foreign keys. It intentionally does NOT touch any existing table.
--
-- ⚠️ PRODUCTION DRIFT WARNING: schema.prisma contains fields that exist
-- in NO migration (Company.businessNumber, Company.trialEndsAt,
-- PayRun.actualPayDate, PayRunItem.bonus) — production was evidently
-- applied outside migration history. Before applying this migration to
-- production, verify the production schema matches schema.prisma for the
-- existing tables; do NOT regenerate this migration with
-- `prisma migrate dev` against production until that drift is reconciled,
-- or the generated SQL will try to re-add columns that already exist.

-- CreateTable
CREATE TABLE "LedgerProConnection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "mappingMode" TEXT NOT NULL DEFAULT 'MODE1',
    "mapping" JSONB NOT NULL,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerProConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerProSyncRecord" (
    "id" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "ledgerEntryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerProSyncRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LedgerProConnection_companyId_key" ON "LedgerProConnection"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerProSyncRecord_payRunId_key" ON "LedgerProSyncRecord"("payRunId");

-- CreateIndex
CREATE INDEX "LedgerProSyncRecord_companyId_idx" ON "LedgerProSyncRecord"("companyId");

-- CreateIndex
CREATE INDEX "LedgerProSyncRecord_status_idx" ON "LedgerProSyncRecord"("status");

-- AddForeignKey
ALTER TABLE "LedgerProConnection" ADD CONSTRAINT "LedgerProConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerProSyncRecord" ADD CONSTRAINT "LedgerProSyncRecord_payRunId_fkey" FOREIGN KEY ("payRunId") REFERENCES "PayRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerProSyncRecord" ADD CONSTRAINT "LedgerProSyncRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
