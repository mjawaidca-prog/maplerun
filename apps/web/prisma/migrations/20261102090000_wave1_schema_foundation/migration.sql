-- Wave 1 (trust foundation) — schema foundation. ADDITIVE ONLY.
--
-- HAND-TRIMMED migration: contains ONLY the DDL for the Wave 1 additions
-- listed below. No existing column is altered, dropped, renamed or
-- backfilled beyond the Prisma defaults declared in schema.prisma
-- (Employee.vacationMode 'PAYOUT', Employee.vacationBalanceCents 0,
-- PayRunItem.qpp/qpp2/qpip 0, PayRunItem.vacationAccruedCents 0 — these
-- defaults simply stamp the values the code already assumed).
--
-- ⚠️ PRODUCTION DRIFT WARNING (unchanged from 20261026233000): schema.prisma
-- contains fields that exist in NO migration (Company.businessNumber,
-- Company.trialEndsAt, PayRun.actualPayDate, PayRunItem.bonus) — production
-- has them via an out-of-history apply. This file deliberately does NOT
-- touch them. Do NOT regenerate migrations with `prisma migrate dev`
-- against production until that drift is reconciled.
--
-- Scope:
--   Company    + remitterType, eftOriginatorName, eftOriginatorId,
--                eftInstitution, eftTransit, eftAccount (all nullable TEXT)
--   Employee   + startDate, terminationDate (nullable TIMESTAMP),
--                jobTitle, department (nullable TEXT),
--                vacationMode TEXT NOT NULL DEFAULT 'PAYOUT',
--                vacationRatePct (nullable DOUBLE PRECISION),
--                vacationBalanceCents INTEGER NOT NULL DEFAULT 0,
--                payGroupId (nullable TEXT, FK → PayGroup ON DELETE SET NULL)
--                + index on payGroupId
--   PayRun     + reversedAt (nullable TIMESTAMP)
--   PayRunItem + qpp, qpp2, qpip (DOUBLE PRECISION NOT NULL DEFAULT 0),
--                vacationAccruedCents (INTEGER NOT NULL DEFAULT 0)

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "eftAccount" TEXT,
ADD COLUMN     "eftInstitution" TEXT,
ADD COLUMN     "eftOriginatorId" TEXT,
ADD COLUMN     "eftOriginatorName" TEXT,
ADD COLUMN     "eftTransit" TEXT,
ADD COLUMN     "remitterType" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "department" TEXT,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "payGroupId" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "terminationDate" TIMESTAMP(3),
ADD COLUMN     "vacationBalanceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vacationMode" TEXT NOT NULL DEFAULT 'PAYOUT',
ADD COLUMN     "vacationRatePct" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PayRun" ADD COLUMN     "reversedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PayRunItem" ADD COLUMN     "qpp" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "qpp2" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "qpip" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "vacationAccruedCents" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Employee_payGroupId_idx" ON "Employee"("payGroupId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_payGroupId_fkey" FOREIGN KEY ("payGroupId") REFERENCES "PayGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
