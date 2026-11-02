/**
 * Clerk identity ⇄ app User resolution and webhook sync.
 *
 * Clerk holds IDENTITY ONLY. The app's User / Membership / Company rows stay
 * authoritative for tenancy; the link is `User.clerkUserId` (nullable, unique).
 *
 * Two entry points converge on the same idempotent upsert:
 *   1. `resolveClerkUser()` — lazy, at first Clerk sign-in (session seam).
 *   2. `syncClerkUserCreated/Updated/Deleted()` — Clerk webhooks.
 *
 * Linking rule (see clerk-migration-design.md §8): an existing User is linked
 * by VERIFIED primary email only, case-insensitive. An unverified email never
 * links, never creates a duplicate (email is unique), and resolves to null —
 * Clerk's email flows verify before sign-in, so this is a defence-in-depth
 * path, not an expected one.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export type ClerkProfile = {
  clerkUserId: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
};

type DbUser = {
  id: string;
  email: string;
  name: string | null;
  clerkUserId: string | null;
};

const userSelect = {
  id: true,
  email: true,
  name: true,
  clerkUserId: true,
} as const;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Extract the normalised profile from a Clerk backend User object. */
export function profileFromClerkUser(user: {
  id: string;
  primaryEmailAddressId?: string | null;
  emailAddresses: Array<{
    id: string;
    emailAddress: string;
    verification?: { status?: string } | null;
  }>;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}): ClerkProfile | null {
  const primary =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ??
    user.emailAddresses[0];
  if (!primary) return null;
  const name =
    user.fullName ??
    ([user.firstName, user.lastName].filter(Boolean).join(" ") || null);
  return {
    clerkUserId: user.id,
    email: normalizeEmail(primary.emailAddress),
    emailVerified: primary.verification?.status === "verified",
    name,
  };
}

/** Extract the normalised profile from a Clerk webhook event payload. */
export function profileFromWebhookData(data: {
  id: string;
  primary_email_address_id?: string | null;
  email_addresses: Array<{
    id: string;
    email_address: string;
    verification?: { status?: string } | null;
  }>;
  first_name?: string | null;
  last_name?: string | null;
}): ClerkProfile | null {
  const primary =
    data.email_addresses.find((e) => e.id === data.primary_email_address_id) ??
    data.email_addresses[0];
  if (!primary) return null;
  const name =
    [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
  return {
    clerkUserId: data.id,
    email: normalizeEmail(primary.email_address),
    emailVerified: primary.verification?.status === "verified",
    name,
  };
}

/**
 * The shared upsert: by clerkUserId → by verified email (link) → create.
 * Returns the app User, or null when the profile cannot be resolved safely
 * (unverified email that matches an existing account).
 */
export async function upsertUserFromClerkProfile(
  profile: ClerkProfile,
): Promise<DbUser | null> {
  // 1. Already linked?
  const byClerkId = await prisma.user.findUnique({
    where: { clerkUserId: profile.clerkUserId },
    select: userSelect,
  });
  if (byClerkId) return byClerkId;

  // 2. Existing account with this email?
  const byEmail = await prisma.user.findFirst({
    where: { email: { equals: profile.email, mode: "insensitive" } },
    select: userSelect,
  });
  if (byEmail) {
    if (byEmail.clerkUserId === profile.clerkUserId) return byEmail;
    if (byEmail.clerkUserId) {
      // Account already linked to a DIFFERENT Clerk identity. Never steal
      // the link silently — surface as unresolved (support case).
      console.error(
        `[clerk] email ${profile.email} is already linked to another Clerk identity`,
      );
      return null;
    }
    if (!profile.emailVerified) {
      // Unverified email must never capture an existing account.
      console.error(
        `[clerk] refusing to link unverified email ${profile.email} to an existing user`,
      );
      return null;
    }
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { clerkUserId: profile.clerkUserId },
      select: userSelect,
    });
  }

  // 3. Brand-new user (mirrors what the Auth.js adapter created implicitly).
  return prisma.user.create({
    data: {
      email: profile.email,
      name: profile.name ?? null,
      emailVerified: profile.emailVerified ? new Date() : null,
      clerkUserId: profile.clerkUserId,
    },
    select: userSelect,
  });
}

/**
 * Resolve the current Clerk session to the app User (linking/creating on
 * first sign-in). Returns null when signed out or unresolvable.
 */
export async function resolveClerkUser(): Promise<DbUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const linked = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: userSelect,
  });
  if (linked) return linked;

  const clerkAccount = await currentUser();
  if (!clerkAccount) return null;
  const profile = profileFromClerkUser(clerkAccount);
  if (!profile) return null;
  return upsertUserFromClerkProfile(profile);
}

// ─── Webhook sync ────────────────────────────────────────────────────────────

export async function syncClerkUserCreated(
  profile: ClerkProfile,
): Promise<DbUser | null> {
  return upsertUserFromClerkProfile(profile);
}

export async function syncClerkUserUpdated(
  profile: ClerkProfile,
): Promise<void> {
  const linked = await prisma.user.findUnique({
    where: { clerkUserId: profile.clerkUserId },
    select: userSelect,
  });
  if (!linked) {
    // Update arrived before create (or the user was never synced) — the
    // create path is the same upsert, so just run it.
    await upsertUserFromClerkProfile(profile);
    return;
  }
  if (linked.email !== profile.email) {
    const collision = await prisma.user.findFirst({
      where: {
        email: { equals: profile.email, mode: "insensitive" },
        NOT: { id: linked.id },
      },
      select: { id: true },
    });
    if (collision) {
      // Do NOT merge accounts automatically — payroll identity data.
      console.error(
        `[clerk] user.updated email collision for user ${linked.id}: ${profile.email} belongs to another user`,
      );
      return;
    }
  }
  await prisma.user.update({
    where: { id: linked.id },
    data: { email: profile.email, name: profile.name ?? linked.name },
  });
}

export async function syncClerkUserDeleted(clerkUserId: string): Promise<void> {
  // Unlink ONLY. The User, memberships and payroll history are compliance
  // records and are retained (design §7).
  await prisma.user.updateMany({
    where: { clerkUserId },
    data: { clerkUserId: null },
  });
}
