-- Legacy Auth.js password sign-up/sign-in: nullable scrypt password hash
-- on User (see src/lib/password.ts).
--
-- HAND-TRIMMED migration: contains ONLY this column addition. Nullable,
-- no default, no backfill — existing users (magic link, Google,
-- Clerk-linked) simply have no password until they set one, and every
-- existing sign-in path is unaffected.
--
-- NOTE (production drift): as with Company.businessNumber /
-- Company.trialEndsAt before it, this column must be applied to the
-- production database through the normal release step; the password
-- sign-up endpoint fails closed (500 on register) until it exists,
-- while magic-link and Google sign-in keep working either way.

ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
