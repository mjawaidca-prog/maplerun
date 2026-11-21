/**
 * Password reset tests — lib/password.ts (scrypt) + lib/password-reset.ts.
 *
 * Prisma and the mailer are mocked; the token store is a stateful in-memory
 * fake so single-use and invalidation are proven end-to-end rather than by
 * call assertions alone. The properties under test:
 *   - tokens are stored HASHED (never the raw value from the emailed link)
 *   - tokens expire after 1 hour and are single-use
 *   - requesting a reset is enumeration-neutral: every case returns the
 *     same result; unknown emails produce no token and no email
 *   - passwordless accounts (passwordHash = null) receive a link too and
 *     use it to set their FIRST password
 *   - a successful reset replaces the hash (new password verifies, old fails)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const h = vi.hoisted(() => {
  const user = { findFirst: vi.fn(), update: vi.fn() };
  const verificationToken = {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
  };
  const sendPasswordResetEmail = vi.fn();
  return { user, verificationToken, sendPasswordResetEmail };
});

vi.mock("@/lib/prisma", () => ({
  prisma: { user: h.user, verificationToken: h.verificationToken },
}));
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: h.sendPasswordResetEmail,
}));

import { hashPassword, verifyPassword } from "@/lib/password";
import {
  requestPasswordReset,
  resetPasswordWithToken,
  hashResetToken,
  RESET_TOKEN_TTL_MS,
} from "@/lib/password-reset";

// ─── Stateful fakes ──────────────────────────────────────────────────────────

type TokenRow = { identifier: string; token: string; expires: Date };

let tokenRows: TokenRow[];
let currentUser: { id: string; email: string; passwordHash: string | null } | null;

function wireStores() {
  h.verificationToken.create.mockImplementation(
    async ({ data }: { data: TokenRow }) => {
      tokenRows.push({ ...data });
      return data;
    },
  );
  h.verificationToken.deleteMany.mockImplementation(
    async ({ where }: { where: { identifier: string } }) => {
      const before = tokenRows.length;
      tokenRows = tokenRows.filter((r) => r.identifier !== where.identifier);
      return { count: before - tokenRows.length };
    },
  );
  h.verificationToken.findFirst.mockImplementation(
    async ({
      where,
    }: {
      where: { identifier: string; token: string };
    }) =>
      tokenRows.find(
        (r) => r.identifier === where.identifier && r.token === where.token,
      ) ?? null,
  );
  h.user.findFirst.mockResolvedValue(currentUser);
  h.user.update.mockImplementation(
    async ({ data }: { data: { passwordHash: string } }) => {
      if (currentUser) currentUser.passwordHash = data.passwordHash;
      return currentUser;
    },
  );
}

function emailedRawToken(): string {
  expect(h.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  const { resetUrl } = h.sendPasswordResetEmail.mock.calls[0][0];
  const url = new URL(resetUrl);
  expect(url.pathname).toBe("/reset-password");
  const token = url.searchParams.get("token");
  expect(token).toBeTruthy();
  return token as string;
}

beforeEach(async () => {
  vi.clearAllMocks();
  tokenRows = [];
  currentUser = {
    id: "usr_1",
    email: "owner@example.com",
    passwordHash: await hashPassword("OldPassword1"),
  };
  h.sendPasswordResetEmail.mockResolvedValue({ success: true });
  wireStores();
});

// ─── scrypt hashing ──────────────────────────────────────────────────────────

describe("password hashing", () => {
  it("roundtrips: the correct password verifies, a wrong one does not", async () => {
    const hash = await hashPassword("Correct Horse 9");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Correct Horse 9", hash)).toBe(true);
    expect(await verifyPassword("Wrong Horse 9", hash)).toBe(false);
  });

  it("rejects null and malformed stored hashes without throwing", async () => {
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", undefined)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(await verifyPassword("anything", "bcrypt$2b$10$abcdef")).toBe(false);
  });
});

// ─── requesting a reset ──────────────────────────────────────────────────────

describe("requestPasswordReset", () => {
  it("creates a hashed, 1-hour token and emails the raw link", async () => {
    const before = Date.now();
    const result = await requestPasswordReset("Owner@Example.com");
    const after = Date.now();

    expect(result).toEqual({ ok: true });
    expect(tokenRows).toHaveLength(1);
    const row = tokenRows[0];
    expect(row.identifier).toBe("password-reset:owner@example.com");

    // Expiry is ~1 hour out.
    expect(row.expires.getTime()).toBeGreaterThanOrEqual(before + RESET_TOKEN_TTL_MS - 1000);
    expect(row.expires.getTime()).toBeLessThanOrEqual(after + RESET_TOKEN_TTL_MS + 1000);

    // The stored value is the hash of the emailed token, never the raw token.
    const raw = emailedRawToken();
    expect(row.token).not.toBe(raw);
    expect(row.token).toBe(hashResetToken(raw));

    const { to, resetUrl } = h.sendPasswordResetEmail.mock.calls[0][0];
    expect(to).toBe("owner@example.com");
    expect(new URL(resetUrl).searchParams.get("email")).toBe("owner@example.com");
  });

  it("invalidates any earlier reset link for the account", async () => {
    tokenRows.push({
      identifier: "password-reset:owner@example.com",
      token: hashResetToken("an-older-token"),
      expires: new Date(Date.now() + 30 * 60 * 1000),
    });
    await requestPasswordReset("owner@example.com");
    expect(tokenRows).toHaveLength(1);
    expect(tokenRows[0].token).toBe(hashResetToken(emailedRawToken()));
  });

  it("is neutral for an unknown email: ok result, no token, no email", async () => {
    currentUser = null;
    wireStores();
    const result = await requestPasswordReset("ghost@example.com");
    expect(result).toEqual({ ok: true });
    expect(tokenRows).toHaveLength(0);
    expect(h.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("sends a first-password link to a passwordless (magic-link / Google) account", async () => {
    // Changed expectation (standard-login build): email control is the
    // proof of identity, so an existing passwordless account CAN set a
    // first password through the reset link. The outward result stays
    // identical to every other case — that is the enumeration-neutral part.
    currentUser = { id: "usr_2", email: "owner@example.com", passwordHash: null };
    wireStores();
    const result = await requestPasswordReset("owner@example.com");
    expect(result).toEqual({ ok: true });
    expect(tokenRows).toHaveLength(1);
    expect(tokenRows[0].identifier).toBe("password-reset:owner@example.com");
    const raw = emailedRawToken();
    expect(tokenRows[0].token).toBe(hashResetToken(raw));
  });

  it("ignores a malformed email without touching the database", async () => {
    const result = await requestPasswordReset("not-an-email");
    expect(result).toEqual({ ok: true });
    expect(h.user.findFirst).not.toHaveBeenCalled();
    expect(tokenRows).toHaveLength(0);
  });
});

// ─── consuming a reset token ─────────────────────────────────────────────────

describe("resetPasswordWithToken", () => {
  async function requestAndCapture(): Promise<string> {
    await requestPasswordReset("owner@example.com");
    return emailedRawToken();
  }

  it("sets the new password: new verifies, old fails, link is single-use", async () => {
    const raw = await requestAndCapture();
    const oldHash = currentUser?.passwordHash;

    const result = await resetPasswordWithToken({
      email: "owner@example.com",
      token: raw,
      newPassword: "NewPassword2",
    });
    expect(result).toEqual({ ok: true });

    expect(currentUser?.passwordHash).not.toBe(oldHash);
    expect(await verifyPassword("NewPassword2", currentUser?.passwordHash)).toBe(true);
    expect(await verifyPassword("OldPassword1", currentUser?.passwordHash)).toBe(false);

    // Single-use: the same link cannot be replayed.
    expect(tokenRows).toHaveLength(0);
    const replay = await resetPasswordWithToken({
      email: "owner@example.com",
      token: raw,
      newPassword: "AnotherPass3",
    });
    expect(replay.ok).toBe(false);
    expect(await verifyPassword("NewPassword2", currentUser?.passwordHash)).toBe(true);
  });

  it("sets a FIRST password for a passwordless account, end to end", async () => {
    currentUser = { id: "usr_2", email: "owner@example.com", passwordHash: null };
    wireStores();

    const raw = await requestAndCapture();
    const result = await resetPasswordWithToken({
      email: "owner@example.com",
      token: raw,
      newPassword: "FirstPassword5",
    });
    expect(result).toEqual({ ok: true });
    expect(currentUser?.passwordHash).toBeTruthy();
    expect(await verifyPassword("FirstPassword5", currentUser?.passwordHash)).toBe(true);
    expect(tokenRows).toHaveLength(0); // link consumed
  });

  it("rejects an unknown token and writes nothing", async () => {
    const result = await resetPasswordWithToken({
      email: "owner@example.com",
      token: "bogus-token",
      newPassword: "NewPassword2",
    });
    expect(result.ok).toBe(false);
    expect(h.user.update).not.toHaveBeenCalled();
    expect(await verifyPassword("OldPassword1", currentUser?.passwordHash)).toBe(true);
  });

  it("rejects an expired token, clears it, and writes nothing", async () => {
    tokenRows.push({
      identifier: "password-reset:owner@example.com",
      token: hashResetToken("expired-token"),
      expires: new Date(Date.now() - 60 * 1000),
    });
    const result = await resetPasswordWithToken({
      email: "owner@example.com",
      token: "expired-token",
      newPassword: "NewPassword2",
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("expired"),
    });
    expect(h.user.update).not.toHaveBeenCalled();
    expect(tokenRows).toHaveLength(0);
  });

  it("rejects a too-short password WITHOUT consuming the token", async () => {
    const raw = await requestAndCapture();
    const result = await resetPasswordWithToken({
      email: "owner@example.com",
      token: raw,
      newPassword: "short",
    });
    expect(result.ok).toBe(false);
    expect(h.user.update).not.toHaveBeenCalled();
    expect(tokenRows).toHaveLength(1); // link still usable

    const retry = await resetPasswordWithToken({
      email: "owner@example.com",
      token: raw,
      newPassword: "LongEnough4",
    });
    expect(retry).toEqual({ ok: true });
  });
});
