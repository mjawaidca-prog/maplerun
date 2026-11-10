-- Legacy Auth.js password sign-up/sign-in: nullable scrypt password hash
-- on User (see src/lib/password.ts).
--
-- HAND-TRIMMED migration: contains ONLY this column addition. Nullable,
-- no default, no backfill — existing users (magic link, Google,
-- Clerk-linked) simply have no password until they set one, and every
-- existing sign-in path is unaffected.
--
-- NOTE (production drift + ORDER): as with Company.businessNumber /
-- Company.trialEndsAt before it, this column is applied to the production
-- database outside the migration chain — but ORDER MATTERS. Apply this
-- ALTER to production BEFORE (or in the same release window as) the code
-- deploy that accompanies it: the generated Prisma client includes
-- passwordHash in every User read, so new code running against a database
-- without the column breaks ALL sign-ins, not just password sign-up.
-- Column-first is zero-risk: a nullable ADD COLUMN is instant on a live
-- table, and the old code simply ignores the new column.

ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
