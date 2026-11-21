-- T4A build (improvement plan Phase 1, item 7a): Payee + PayeePayment.
--
-- Payees are NON-employee recipients (contractors, subcontractors,
-- pensioners) whose payments are tagged with a T4A box classification at
-- payment time (design §6.1.3), so the year-end T4A is an aggregation,
-- not a reconstruction. Two brand-new tables; nothing existing is
-- altered, so this migration is zero-risk to current behaviour.
--
-- SHIP ORDER: create these tables in production (Neon) BEFORE (or in the
-- same release window as) the code deploy that accompanies them — the
-- generated Prisma client will query them from the payees/T4A pages.
-- NOT applied by the build agent; local file only.

-- CreateTable
CREATE TABLE "Payee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "payeeType" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "firstName" TEXT,
    "lastName" TEXT,
    "initial" TEXT,
    "businessName" TEXT,
    "businessName2" TEXT,
    "sinEncrypted" TEXT,
    "businessNumber" TEXT,
    "recipientNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "countryCode" TEXT DEFAULT 'CAN',
    "dentalBenefitsCode" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayeePayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "payeeId" TEXT NOT NULL,
    "paymentDate" TEXT NOT NULL,
    "boxCode" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "incomeTaxDeducted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "t5018Reportable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payee_companyId_idx" ON "Payee"("companyId");

-- CreateIndex
CREATE INDEX "PayeePayment_companyId_idx" ON "PayeePayment"("companyId");

-- CreateIndex
CREATE INDEX "PayeePayment_payeeId_idx" ON "PayeePayment"("payeeId");

-- AddForeignKey
ALTER TABLE "Payee" ADD CONSTRAINT "Payee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayeePayment" ADD CONSTRAINT "PayeePayment_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "Payee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayeePayment" ADD CONSTRAINT "PayeePayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
