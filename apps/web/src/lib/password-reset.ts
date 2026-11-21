/**
 * Password reset for the legacy Auth.js credential track.
 *
 * Flow: /forgot-password → email with a single-use link → /reset-password.
 *
 * Token storage reuses the Auth.js adapter's VerificationToken table — the
 * same store the Resend magic-link flow uses — with a namespaced identifier
 * ("password-reset:<email>") so reset tokens can never collide with
 * magic-link tokens. Following the Auth.js pattern, only a SHA-256 hash of
 * the token is stored; the raw token exists only in the emailed link.
 *
 * Security properties:
 *   - Single-use: a successful reset deletes every outstanding reset token
 *     for the account, and requesting a new link invalidates the old ones.
 *   - Time-limited: tokens expire after 1 hour.
 *   - No account enumeration: requestPasswordReset returns the same result
 *     whether the email is unknown or a reset email was actually sent.
 *   - First password: an existing account whose passwordHash is still null
 *     (signed up via magic link / Google) also receives a link — controlling
 *     the email inbox is the proof of identity, the same strength as the
 *     magic-link sign-in itself — and uses it to set its first password.
 */

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { sendPasswordResetEmail } from "@/lib/email";
import { PAY_URL } from "@/lib/seo";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

export { MIN_PASSWORD_LENGTH };
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const IDENTIFIER_PREFIX = "password-reset:";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function identifierFor(email: string): string {
  return `${IDENTIFIER_PREFIX}${normalizeEmail(email)}`;
}

/**
 * Hash a raw reset token for storage, mirroring how Auth.js hashes its
 * verification tokens (SHA-256 of token + secret). With no secret set the
 * token is still a 256-bit random value hashed at rest.
 */
export function hashResetToken(rawToken: string): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  return createHash("sha256").update(`${rawToken}${secret}`).digest("hex");
}

function resetUrl(email: string, rawToken: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? PAY_URL;
  const url = new URL("/reset-password", base);
  url.searchParams.set("token", rawToken);
  url.searchParams.set("email", normalizeEmail(email));
  return url.toString();
}

export type RequestResetResult = { ok: true };

/**
 * Ask for a reset link. ALWAYS resolves to the same neutral result — the
 * caller shows one confirmation message for every outcome, so the endpoint
 * cannot be used to probe which emails have accounts.
 *
 * A token + email are produced whenever the account exists — including
 * passwordless accounts (passwordHash = null), which use the link to set
 * their FIRST password. Only an unknown email produces nothing, and that
 * is invisible from the outside.
 */
export async function requestPasswordReset(
  rawEmail: string,
): Promise<RequestResetResult> {
  const email = normalizeEmail(rawEmail ?? "");
  if (!email || !email.includes("@")) return { ok: true };

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!user) return { ok: true };

  const identifier = identifierFor(user.email);

  // Only the newest link stays valid: drop any outstanding reset tokens.
  await prisma.verificationToken.deleteMany({ where: { identifier } });

  const rawToken = randomBytes(32).toString("base64url");
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: hashResetToken(rawToken),
      expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  try {
    await sendPasswordResetEmail({
      to: user.email,
      resetUrl: resetUrl(user.email, rawToken),
    });
  } catch (error) {
    // Delivery failure must not leak account existence either — the token
    // simply expires unused and the user can request another.
    console.error("Failed to send password reset email:", error);
  }

  return { ok: true };
}

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; error: string };

const INVALID_LINK_ERROR =
  "This reset link is invalid or has already been used. Request a new one.";
const EXPIRED_LINK_ERROR =
  "This reset link has expired. Request a new one.";

/**
 * Consume a reset token and set a new password.
 *
 * On success the user's passwordHash is set (scrypt, lib/password.ts) —
 * replacing the old hash, or creating the account's first password when
 * passwordHash was null —
 * and every reset token for the account is deleted, so the link cannot be
 * replayed. On any failure nothing is written except removal of an expired
 * token — no partial state.
 */
export async function resetPasswordWithToken(params: {
  email: string;
  token: string;
  newPassword: string;
}): Promise<ResetPasswordResult> {
  const email = normalizeEmail(params.email ?? "");
  const rawToken = (params.token ?? "").trim();
  const newPassword = params.newPassword ?? "";

  // Validate the new password BEFORE touching the token, so a typo at this
  // step doesn't burn the link.
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (!email || !rawToken) return { ok: false, error: INVALID_LINK_ERROR };

  const identifier = identifierFor(email);
  const stored = await prisma.verificationToken.findFirst({
    where: { identifier, token: hashResetToken(rawToken) },
  });
  if (!stored) return { ok: false, error: INVALID_LINK_ERROR };

  if (stored.expires.getTime() <= Date.now()) {
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    return { ok: false, error: EXPIRED_LINK_ERROR };
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (!user) {
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    return { ok: false, error: INVALID_LINK_ERROR };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  // Single-use: consume this token and any siblings.
  await prisma.verificationToken.deleteMany({ where: { identifier } });

  return { ok: true };
}
