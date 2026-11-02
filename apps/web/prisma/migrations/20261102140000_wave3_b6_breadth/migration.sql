-- Wave 3 B6 (earnings/deduction breadth) — ADDITIVE ONLY.
--
-- HAND-WRITTEN migration in the style of 20261102090000_wave1_schema_foundation
-- and 20261102130000_wave3_b5_payslip (which this migration follows —
-- apply order is by folder name: ...130000 B5 before ...140000 B6).
-- Contains ONLY the DDL for the B6 additions listed below. No existing
-- column is altered, dropped, renamed or backfilled beyond the Prisma
-- defaults declared in schema.prisma.
--
-- ⚠️ PRODUCTION DRIFT WARNING (unchanged from 20261026233000 / Wave 1):
-- schema.prisma contains fields that exist in NO migration — production
-- has them via an out-of-history apply. This file deliberately does NOT
-- touch them. Do NOT regenerate migrations with `prisma migrate dev`
-- against production until that drift is reconciled.
--
-- Scope:
--   Employee   + provinceOfEmployment (nullable TEXT)
--   PayRunItem + customDeductions (nullable JSONB),
--                reimbursement (DOUBLE PRECISION NOT NULL DEFAULT 0),
--                taxableBenefits (DOUBLE PRECISION NOT NULL DEFAULT 0)

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "provinceOfEmployment" TEXT;

-- AlterTable
ALTER TABLE "PayRunItem" ADD COLUMN     "customDeductions" JSONB,
ADD COLUMN     "reimbursement" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "taxableBenefits" DOUBLE PRECISION NOT NULL DEFAULT 0;
