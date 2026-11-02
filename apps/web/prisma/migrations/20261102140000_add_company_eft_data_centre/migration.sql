-- Wave 2 Wiring — EFT: Company.eftDataCentre. ADDITIVE ONLY.
--
-- The CPA-005 header carries a bank-assigned processing/data centre
-- (5 digits, header positions 31–35) and the pure builder in
-- src/lib/eft/cpa005.ts refuses to build a file without a real one —
-- fabricating it is forbidden. The Wave 1 foundation added the rest of
-- the originator profile (eftOriginatorName/Id, eftInstitution,
-- eftTransit, eftAccount) but no data-centre column, so this migration
-- adds exactly that one nullable column. Nothing else is touched.
--
-- DO NOT apply to production outside the merge window (Ren applies
-- migrations there); this file is the complete DDL for the change.

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "eftDataCentre" TEXT;
