/**
 * Clerk auth track tests — mode flag, identity resolution/linking, and
 * webhook sync (lib/auth-mode.ts + lib/clerk-user.ts).
 *
 * Prisma and the Clerk server SDK are mocked; no network, no real keys.
 * The linking rules under test are the design's safety core:
 *   - link by VERIFIED email only, case-insensitive
 *   - never steal a link from a different Clerk identity
 *   - never create a duplicate for an existing email
 *   - user.deleted unlinks ONLY (records retained)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const h = vi.hoisted(() => {
  const user = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const clerk = {
    auth: vi.fn(),
    currentUser: vi.fn(),
  };
  return { user, clerk };
});

vi.mock("@/lib/prisma", () => ({ prisma: { user: h.user } }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: h.clerk.auth,
  currentUser: h.clerk.currentUser,
}));

import { getAuthMode, isClerkAuth } from "@/lib/auth-mode";
import {
  profileFromClerkUser,
  profileFromWebhookData,
  resolveClerkUser,
  syncClerkUserCreated,
  syncClerkUserDeleted,
  syncClerkUserUpdated,
  upsertUserFromClerkProfile,
} from "@/lib/clerk-user";

const EXISTING = {
  id: "usr_existing",
  email: "owner@example.com",
  name: "Owner",
  clerkUserId: null as string | null,
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.APP_AUTH_PROVIDER;
  h.user.findUnique.mockResolvedValue(null);
  h.user.findFirst.mockResolvedValue(null);
  h.user.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  delete process.env.APP_AUTH_PROVIDER;
});

// ─── auth-mode ───────────────────────────────────────────────────────────────

describe("getAuthMode", () => {
  it("defaults to legacy when unset", () => {
    expect(getAuthMode()).toBe("legacy");
    expect(isClerkAuth()).toBe(false);
  });

  it("is clerk only for the exact value 'clerk'", () => {
    process.env.APP_AUTH_PROVIDER = "clerk";
    expect(getAuthMode()).toBe("clerk");
    expect(isClerkAuth()).toBe(true);
  });

  it("falls back to legacy for unknown values (fail-safe)", () => {
    process.env.APP_AUTH_PROVIDER = "Clerk";
    expect(getAuthMode()).toBe("legacy");
    process.env.APP_AUTH_PROVIDER = "yes";
    expect(getAuthMode()).toBe("legacy");
  });
});

// ─── profile normalisation ───────────────────────────────────────────────────

describe("profile normalisation", () => {
  it("picks the primary email and reads its verification status", () => {
    const p = profileFromClerkUser({
      id: "user_1",
      primaryEmailAddressId: "em_2",
      emailAddresses: [
        { id: "em_1", emailAddress: "Other@Example.com", verification: { status: "unverified" } },
        { id: "em_2", emailAddress: "Main@Example.com", verification: { status: "verified" } },
      ],
      firstName: "Main",
      lastName: "User",
      fullName: "Main User",
    });
    expect(p).toEqual({
      clerkUserId: "user_1",
      email: "main@example.com",
      emailVerified: true,
      name: "Main User",
    });
  });

  it("normalises webhook payloads (snake_case)", () => {
    const p = profileFromWebhookData({
      id: "user_2",
      primary_email_address_id: "em_1",
      email_addresses: [
        { id: "em_1", email_address: "Hook@Example.com", verification: { status: "verified" } },
      ],
      first_name: "Hook",
      last_name: null,
    });
    expect(p?.email).toBe("hook@example.com");
    expect(p?.emailVerified).toBe(true);
    expect(p?.name).toBe("Hook");
  });

  it("returns null when there is no email address", () => {
    expect(
      profileFromClerkUser({ id: "user_3", emailAddresses: [] }),
    ).toBeNull();
  });
});

// ─── upsert / linking ────────────────────────────────────────────────────────

describe("upsertUserFromClerkProfile", () => {
  const profile = {
    clerkUserId: "user_clerk1",
    email: "owner@example.com",
    emailVerified: true,
    name: "Owner",
  };

  it("returns the already-linked user without writes", async () => {
    h.user.findUnique.mockResolvedValue({ ...EXISTING, clerkUserId: "user_clerk1" });
    const u = await upsertUserFromClerkProfile(profile);
    expect(u?.id).toBe("usr_existing");
    expect(h.user.update).not.toHaveBeenCalled();
    expect(h.user.create).not.toHaveBeenCalled();
  });

  it("links an existing user by verified email (case-insensitive match path)", async () => {
    h.user.findFirst.mockResolvedValue({ ...EXISTING });
    h.user.update.mockResolvedValue({ ...EXISTING, clerkUserId: "user_clerk1" });
    const u = await upsertUserFromClerkProfile(profile);
    expect(h.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: "owner@example.com", mode: "insensitive" } },
      }),
    );
    expect(h.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "usr_existing" },
        data: { clerkUserId: "user_clerk1" },
      }),
    );
    expect(u?.clerkUserId).toBe("user_clerk1");
  });

  it("refuses to link an UNVERIFIED email to an existing account", async () => {
    h.user.findFirst.mockResolvedValue({ ...EXISTING });
    const u = await upsertUserFromClerkProfile({ ...profile, emailVerified: false });
    expect(u).toBeNull();
    expect(h.user.update).not.toHaveBeenCalled();
    expect(h.user.create).not.toHaveBeenCalled();
  });

  it("never steals a link from a different Clerk identity", async () => {
    h.user.findFirst.mockResolvedValue({ ...EXISTING, clerkUserId: "user_someoneelse" });
    const u = await upsertUserFromClerkProfile(profile);
    expect(u).toBeNull();
    expect(h.user.update).not.toHaveBeenCalled();
    expect(h.user.create).not.toHaveBeenCalled();
  });

  it("creates a new user when nothing matches", async () => {
    h.user.create.mockResolvedValue({ ...EXISTING, id: "usr_new", clerkUserId: "user_clerk1" });
    const u = await upsertUserFromClerkProfile(profile);
    expect(h.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "owner@example.com",
          clerkUserId: "user_clerk1",
        }),
      }),
    );
    // Verified Clerk email stamps emailVerified.
    const arg = h.user.create.mock.calls[0][0];
    expect(arg.data.emailVerified).toBeInstanceOf(Date);
    expect(u?.id).toBe("usr_new");
  });
});

// ─── session resolution ──────────────────────────────────────────────────────

describe("resolveClerkUser", () => {
  it("returns null when signed out", async () => {
    h.clerk.auth.mockResolvedValue({ userId: null });
    expect(await resolveClerkUser()).toBeNull();
    expect(h.clerk.currentUser).not.toHaveBeenCalled();
  });

  it("returns the linked user without calling currentUser", async () => {
    h.clerk.auth.mockResolvedValue({ userId: "user_clerk1" });
    h.user.findUnique.mockResolvedValue({ ...EXISTING, clerkUserId: "user_clerk1" });
    const u = await resolveClerkUser();
    expect(u?.id).toBe("usr_existing");
    expect(h.clerk.currentUser).not.toHaveBeenCalled();
  });

  it("links on first sign-in via currentUser profile", async () => {
    h.clerk.auth.mockResolvedValue({ userId: "user_clerk1" });
    h.clerk.currentUser.mockResolvedValue({
      id: "user_clerk1",
      primaryEmailAddressId: "em_1",
      emailAddresses: [
        { id: "em_1", emailAddress: "owner@example.com", verification: { status: "verified" } },
      ],
      firstName: "Owner",
      lastName: null,
      fullName: "Owner",
    });
    h.user.findFirst.mockResolvedValue({ ...EXISTING });
    h.user.update.mockResolvedValue({ ...EXISTING, clerkUserId: "user_clerk1" });
    const u = await resolveClerkUser();
    expect(u?.id).toBe("usr_existing");
    expect(h.user.update).toHaveBeenCalled();
  });
});

// ─── webhook sync ────────────────────────────────────────────────────────────

describe("webhook sync", () => {
  const profile = {
    clerkUserId: "user_clerk1",
    email: "owner@example.com",
    emailVerified: true,
    name: "Owner",
  };

  it("user.created runs the same upsert (links existing by email)", async () => {
    h.user.findFirst.mockResolvedValue({ ...EXISTING });
    h.user.update.mockResolvedValue({ ...EXISTING, clerkUserId: "user_clerk1" });
    await syncClerkUserCreated(profile);
    expect(h.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { clerkUserId: "user_clerk1" } }),
    );
  });

  it("user.updated syncs email + name for the linked user", async () => {
    h.user.findUnique.mockResolvedValue({
      ...EXISTING,
      email: "old@example.com",
      clerkUserId: "user_clerk1",
    });
    h.user.findFirst.mockResolvedValue(null); // no collision
    h.user.update.mockResolvedValue({});
    await syncClerkUserUpdated(profile);
    expect(h.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "usr_existing" },
        data: { email: "owner@example.com", name: "Owner" },
      }),
    );
  });

  it("user.updated with an email collision does NOT merge (no write)", async () => {
    h.user.findUnique.mockResolvedValue({
      ...EXISTING,
      email: "old@example.com",
      clerkUserId: "user_clerk1",
    });
    h.user.findFirst.mockResolvedValue({ id: "usr_other" }); // collision
    await syncClerkUserUpdated(profile);
    expect(h.user.update).not.toHaveBeenCalled();
  });

  it("user.deleted unlinks only — never deletes the user", async () => {
    await syncClerkUserDeleted("user_clerk1");
    expect(h.user.updateMany).toHaveBeenCalledWith({
      where: { clerkUserId: "user_clerk1" },
      data: { clerkUserId: null },
    });
  });
});
