/**
 * Email + password authentication for the legacy Auth.js Credentials
 * provider (wired up in lib/auth.ts).
 *
 * Kept as a standalone module so the authorize logic is unit-testable
 * without standing up the full NextAuth config.
 *
 * Every failure returns the same `null` — unknown email, passwordless
 * account (magic-link / Google / Clerk, passwordHash = null) and wrong
 * password are indistinguishable to the caller, and the sign-in form maps
 * all of them to one generic "Invalid email or password" message, so the
 * endpoint cannot be used to probe which emails have accounts or
 * passwords. A scrypt verification runs on every path (against a dummy
 * hash when there is no real one) so response timing doesn't leak the
 * distinction either.
 */

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { normalizeEmail } from "@/lib/password-reset";

export type CredentialsUser = {
  id: string;
  email: string;
  name?: string | null;
};

// A valid-format scrypt hash of a throwaway value (same cost parameters
// as lib/password.ts). Verified against when the account is missing or
// has no password, purely to keep timing uniform — it can never match a
// real sign-in because the account checks below still gate the result.
const DUMMY_PASSWORD_HASH =
  "scrypt$16384$8$1$l99yU7VhzPHGy7m7d6cBOQ==$CEMjgH0fHBbH4tj64V6clktbsaet5qGrWic1F5noq28dXj3MCSTzXkTWydxPLSVwLsaqY+Ke07s+LEEdiJ5W5w==";

export async function authenticateWithPassword(
  rawEmail: string,
  password: string,
): Promise<CredentialsUser | null> {
  const email = normalizeEmail(rawEmail ?? "");
  if (!email || !password) return null;

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true, passwordHash: true },
  });

  const passwordOk = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!user || !user.passwordHash || !passwordOk) return null;

  return { id: user.id, email: user.email, name: user.name };
}
