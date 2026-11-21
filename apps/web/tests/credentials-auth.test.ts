/**
 * Credentials sign-in tests — lib/credentials-auth.ts (the authorize logic
 * behind the Auth.js Credentials provider in lib/auth.ts) plus its
 * composition with the password-reset flow.
 *
 * Prisma and the mailer are mocked with the same stateful-fake pattern as
 * tests/password-reset.test.ts. The properties under test:
 *   - correct password against a stored scrypt hash signs in
 *   - wrong password, passwordless account and unknown email ALL fail
 *     with the same outward result (null → one generic form error)
 *   - a passwordless account sets a FIRST password via the emailed reset
 *     link and can then sign in with it (end to end, module level)
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
import { authenticateWithPassword } from "@/lib/credentials-auth";
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from "@/lib/password-reset";

// ─── Stateful fakes ──────────────────────────────────────────────────────────

type TokenRow = { identifier: string; token: string; expires: Date };
type FakeUser = {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
};

let tokenRows: TokenRow[];
let currentUser: FakeUser | null;

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
  h.user.findFirst.mockImplementation(async () => currentUser);
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
  const token = new URL(resetUrl).searchParams.get("token");
  expect(token).toBeTruthy();
  return token as string;
}

beforeEach(async () => {
  vi.clearAllMocks();
  tokenRows = [];
  currentUser = {
    id: "usr_1",
    email: "owner@example.com",
    name: "Olivia Owner",
    passwordHash: await hashPassword("CorrectPassword1"),
  };
  h.sendPasswordResetEmail.mockResolvedValue({ success: true });
  wireStores();
});

// ─── authorize ───────────────────────────────────────────────────────────────

describe("authenticateWithPassword", () => {
  it("signs in with the correct password and returns the session user", async () => {
    const result = await authenticateWithPassword(
      "owner@example.com",
      "CorrectPassword1",
    );
    expect(result).toEqual({
      id: "usr_1",
      email: "owner@example.com",
      name: "Olivia Owner",
    });
  });

  it("matches the email case-insensitively after normalization", async () => {
    const result = await authenticateWithPassword(
      "  Owner@Example.COM ",
      "CorrectPassword1",
    );
    expect(result?.id).toBe("usr_1");
    const where = h.user.findFirst.mock.calls[0][0].where;
    expect(where.email).toEqual({
      equals: "owner@example.com",
      mode: "insensitive",
    });
  });

  it("fails with a wrong password — same outward result as every failure", async () => {
    expect(
      await authenticateWithPassword("owner@example.com", "WrongPassword9"),
    ).toBeNull();
  });

  it("fails for a passwordless account (passwordHash = null)", async () => {
    currentUser = { ...currentUser!, passwordHash: null };
    wireStores();
    expect(
      await authenticateWithPassword("owner@example.com", "CorrectPassword1"),
    ).toBeNull();
    expect(
      await authenticateWithPassword("owner@example.com", "anything-else"),
    ).toBeNull();
  });

  it("fails for an unknown email", async () => {
    currentUser = null;
    wireStores();
    expect(
      await authenticateWithPassword("ghost@example.com", "CorrectPassword1"),
    ).toBeNull();
  });

  it("fails fast on empty inputs without a database lookup", async () => {
    expect(await authenticateWithPassword("", "CorrectPassword1")).toBeNull();
    expect(await authenticateWithPassword("owner@example.com", "")).toBeNull();
    expect(h.user.findFirst).not.toHaveBeenCalled();
  });
});

// ─── first password via the reset link, then sign in ─────────────────────────

describe("passwordless account → reset link → password sign-in", () => {
  it("walks the whole path at module level", async () => {
    currentUser = {
      id: "usr_2",
      email: "owner@example.com",
      name: "Olivia Owner",
      passwordHash: null,
    };
    wireStores();

    // No password yet: credentials sign-in cannot work.
    expect(
      await authenticateWithPassword("owner@example.com", "FirstPassword5"),
    ).toBeNull();

    // Forgot-password request issues a first-password link.
    await requestPasswordReset("owner@example.com");
    const raw = emailedRawToken();

    const reset = await resetPasswordWithToken({
      email: "owner@example.com",
      token: raw,
      newPassword: "FirstPassword5",
    });
    expect(reset).toEqual({ ok: true });
    expect(
      await verifyPassword("FirstPassword5", currentUser?.passwordHash),
    ).toBe(true);

    // Now the same credentials sign in — and a wrong guess still fails.
    expect(
      await authenticateWithPassword("owner@example.com", "FirstPassword5"),
    ).toEqual({ id: "usr_2", email: "owner@example.com", name: "Olivia Owner" });
    expect(
      await authenticateWithPassword("owner@example.com", "WrongPassword9"),
    ).toBeNull();
  });
});
