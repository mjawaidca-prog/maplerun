/**
 * Credential verification + registration validation for legacy Auth.js
 * password sign-in (see lib/auth.ts Credentials provider and
 * app/api/register/route.ts).
 *
 * Design notes:
 * - Emails are normalized (trim + lowercase) at registration and at
 *   sign-in, so an account is always found the same way.
 * - verifyCredentials returns null for EVERY failure — unknown email,
 *   account without a password, wrong password — and still runs a scrypt
 *   verification against a dummy hash when there is nothing real to check,
 *   so response timing does not reveal which emails have passwords.
 * - The Prisma import is lazy (inside the default lookup): lib/prisma.ts
 *   throws at import time when DATABASE_URL is unset, and this module's
 *   pure helpers (validation, verification against an injected lookup)
 *   must stay importable in tests without a database.
 */

import { verifyPassword } from "@/lib/password";

export interface CredentialUserRecord {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
}

export type CredentialUserLookup = (
  email: string,
) => Promise<CredentialUserRecord | null>;

const defaultLookup: CredentialUserLookup = async (email) => {
  const { prisma } = await import("@/lib/prisma");
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
};

// Precomputed scrypt hash of a throwaway password, in lib/password.ts
// format. Verified against when the account does not exist or has no
// password, purely to keep timing uniform — it can never match.
const DUMMY_HASH =
  "scrypt:16384:8:1:JXleOgQBoHxN4eosTCv3EA==:IqHiaJVAFp9FHUkHsM46V7cowZTAOZEWo47CkY1yulPLwJX/TAZpdIKLfx9RI0ndyJ+wPgjWRvka0qpk8CFmNw==";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function verifyCredentials(
  email: string,
  password: string,
  lookup: CredentialUserLookup = defaultLookup,
): Promise<{ id: string; email: string; name: string | null } | null> {
  if (!email || !password) return null;
  const user = await lookup(normalizeEmail(email));
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !ok) return null;
  return { id: user.id, email: user.email, name: user.name };
}

export type RegistrationResult =
  | { ok: true; value: { name: string; email: string; password: string } }
  | { ok: false; error: string };

export function validateRegistration(input: {
  name?: unknown;
  email?: unknown;
  password?: unknown;
}): RegistrationResult {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email =
    typeof input.email === "string" ? normalizeEmail(input.email) : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (name.length < 2) return { ok: false, error: "Please enter your name." };
  if (name.length > 80) return { ok: false, error: "That name is too long." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (password.length > 128) {
    return { ok: false, error: "Password must be 128 characters or fewer." };
  }
  return { ok: true, value: { name, email, password } };
}
