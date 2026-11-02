-- Wave 2 (remittance wiring) — recorded CRA remittance submissions. ADDITIVE ONLY.
--
-- HAND-WRITTEN migration: creates ONLY the RemittanceSubmission table for
-- the model added in schema.prisma in this phase. No existing table or
-- column is altered, dropped, renamed or backfilled.
--
-- ⚠️ DO NOT apply to production from this branch — the migration ships
-- with the PR and is applied under the owner's controlled deploy process.
--
-- ⚠️ PRODUCTION DRIFT WARNING (unchanged from 20261102090000): schema.prisma
-- contains fields that exist in NO migration (Company.businessNumber,
-- Company.trialEndsAt, PayRun.actualPayDate, PayRunItem.bonus) — production
-- has them via an out-of-history apply. This file deliberately does NOT
-- touch them. Do NOT regenerate migrations with `prisma migrate dev`
-- against production until that drift is reconciled.
--
-- Scope:
--   RemittanceSubmission (new table)
--     id TEXT PK, companyId TEXT NOT NULL FK → Company ON DELETE CASCADE,
--     periodKey TEXT NOT NULL, totalRemittance DOUBLE PRECISION NOT NULL,
--     reference TEXT (nullable), submittedAt TIMESTAMP(3) NOT NULL
--     DEFAULT CURRENT_TIMESTAMP, createdById TEXT (nullable)
--     + UNIQUE index on (companyId, periodKey)
--     + index on (companyId)

-- CreateTable
CREATE TABLE "RemittanceSubmission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "totalRemittance" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "RemittanceSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RemittanceSubmission_companyId_periodKey_key" ON "RemittanceSubmission"("companyId", "periodKey");

-- CreateIndex
CREATE INDEX "RemittanceSubmission_companyId_idx" ON "RemittanceSubmission"("companyId");

-- AddForeignKey
ALTER TABLE "RemittanceSubmission" ADD CONSTRAINT "RemittanceSubmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
