-- Nexvar Pay billing completion: record Stripe billing state on Company
-- (customer id, subscription id, last known subscription status) so
-- /api/billing/webhook can persist checkout results and clear the free
-- trial. Until now the webhook persisted nothing, so a company that paid
-- still looked "on trial" to the pay-run gate (lib/trial reads
-- trialEndsAt), and cancellations could never take effect.
--
-- HAND-TRIMMED migration: contains ONLY these column additions. All
-- nullable, no defaults, no backfill — existing companies have simply
-- never subscribed (subscriptionStatus NULL), and lib/trial keeps its
-- exact current trial/promo behaviour for them.
--
-- NOTE (production drift + ORDER): as with Company.businessNumber /
-- Company.trialEndsAt / User.passwordHash before it, these columns are
-- applied to the production database outside the migration chain — but
-- ORDER MATTERS. Apply these ALTERs to production (Neon) BEFORE (or in
-- the same release window as) the code deploy that accompanies them:
-- the generated Prisma client includes the new columns in Company
-- reads, so new code running against a database without them breaks
-- company loads app-wide. Column-first is zero-risk: a nullable
-- ADD COLUMN is instant on a live table, and the old code simply
-- ignores the new columns.

ALTER TABLE "Company" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "Company" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "Company" ADD COLUMN "subscriptionStatus" TEXT;
