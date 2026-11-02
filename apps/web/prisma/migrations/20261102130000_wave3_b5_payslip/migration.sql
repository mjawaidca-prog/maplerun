-- Wave 3 B5 (payslip completion) — ADDITIVE ONLY.
--
-- HAND-WRITTEN migration in the style of 20261102090000_wave1_schema_foundation:
-- contains ONLY the DDL for the B5 additions listed below. No existing
-- column is altered, dropped, renamed or backfilled beyond the Prisma
-- defaults declared in schema.prisma.
--
-- ⚠️ PRODUCTION DRIFT WARNING (unchanged from 20261026233000 / Wave 1):
-- schema.prisma contains fields that exist in NO migration (Company.
-- businessNumber, Company.trialEndsAt, PayRun.actualPayDate, PayRunItem.
-- bonus) — production has them via an out-of-history apply. This file
-- deliberately does NOT touch them. Do NOT regenerate migrations with
-- `prisma migrate dev` against production until that drift is reconciled.
--
-- Scope:
--   Company    + stubEmailOnFinalize BOOLEAN NOT NULL DEFAULT false
--   PayRun     + periodStart (nullable TEXT)
--   PayRunItem + regularPay, overtimePay, statPay (DOUBLE PRECISION NOT NULL DEFAULT 0),
--                overtimeHours, statHours (DOUBLE PRECISION NOT NULL DEFAULT 0),
--                vacationBalanceAfterCents (nullable INTEGER)
--   YtdLedger  + grossPay, incomeTax (DOUBLE PRECISION NOT NULL DEFAULT 0)

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "stubEmailOnFinalize" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PayRun" ADD COLUMN     "periodStart" TEXT;

-- AlterTable
ALTER TABLE "PayRunItem" ADD COLUMN     "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "overtimePay" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "regularPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "statHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "statPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "vacationBalanceAfterCents" INTEGER;

-- AlterTable
ALTER TABLE "YtdLedger" ADD COLUMN     "grossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "incomeTax" DOUBLE PRECISION NOT NULL DEFAULT 0;
