-- Wave 3 (A4) — employee portal + self-onboarding. ADDITIVE ONLY.
--
-- HAND-WRITTEN migration: contains ONLY the DDL for the portal additions
-- listed below, against the schema as rebased onto redesign (which already
-- includes all Wave 1 fields). No existing column is altered, dropped,
-- renamed or backfilled.
--
-- CREATED, NOT APPLIED: this migration is applied by Ren at merge time,
-- per the program's migration sequencing (Wave 3 migrations last).
--
-- ⚠️ PRODUCTION DRIFT WARNING (unchanged from 20261102090000):
-- schema.prisma contains fields that exist in NO migration
-- (Company.businessNumber, Company.trialEndsAt, PayRun.actualPayDate,
-- PayRunItem.bonus) — production has them via an out-of-history apply.
-- This file deliberately does NOT touch them. Do NOT regenerate
-- migrations with `prisma migrate dev` against production until that
-- drift is reconciled.
--
-- Scope:
--   Employee   + clerkUserId (nullable TEXT, UNIQUE — the Clerk user id
--                once the employee is linked; distinct from
--                User.clerkUserId, which is the Clerk track's column),
--                portalInvitedAt (nullable TIMESTAMP)
--   EmployeePendingUpdate (new table)
--              + id, employeeId (FK → Employee ON DELETE CASCADE),
--                companyId (FK → Company ON DELETE CASCADE),
--                status TEXT NOT NULL DEFAULT 'PENDING',
--                payload JSONB NOT NULL,
--                submittedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
--                reviewedAt (nullable TIMESTAMP),
--                reviewedByUserId, reviewNote (nullable TEXT)
--              + indexes on (employeeId, status) and (companyId, status)

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "clerkUserId" TEXT,
ADD COLUMN     "portalInvitedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmployeePendingUpdate" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,

    CONSTRAINT "EmployeePendingUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_clerkUserId_key" ON "Employee"("clerkUserId");

-- CreateIndex
CREATE INDEX "EmployeePendingUpdate_employeeId_status_idx" ON "EmployeePendingUpdate"("employeeId", "status");

-- CreateIndex
CREATE INDEX "EmployeePendingUpdate_companyId_status_idx" ON "EmployeePendingUpdate"("companyId", "status");

-- AddForeignKey
ALTER TABLE "EmployeePendingUpdate" ADD CONSTRAINT "EmployeePendingUpdate_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePendingUpdate" ADD CONSTRAINT "EmployeePendingUpdate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
