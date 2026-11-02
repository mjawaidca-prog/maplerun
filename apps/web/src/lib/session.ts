/**
 * Session + tenant helpers for server components and actions.
 *
 * Every tenant-scoped operation must call `requireCompany()` to get the
 * current user's companyId. Use `requireSession()` for endpoints that
 * don't need a company context (e.g., company creation itself).
 *
 * Identity resolution is mode-dispatched (see lib/auth-mode.ts):
 *   - legacy mode → Auth.js (`auth()` from lib/auth.ts) — original behaviour
 *   - clerk mode  → Clerk session resolved to the app User via
 *                   lib/clerk-user.ts (link-by-verified-email on first sign-in)
 * In both modes callers receive the INTERNAL User.id, and Membership rows
 * remain the only tenancy authority.
 */

import { auth } from "@/lib/auth";
import { isClerkAuth } from "@/lib/auth-mode";
import { resolveClerkUser } from "@/lib/clerk-user";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name?: string | null;
  companyId: string;
};

type Identity = {
  id: string;
  email: string;
  name?: string | null;
  /** Legacy JWT carries a default companyId hint; Clerk sessions do not. */
  companyHint?: string;
};

async function resolveIdentity(): Promise<Identity | null> {
  if (isClerkAuth()) {
    const user = await resolveClerkUser();
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name };
  }
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    companyHint: session.user.companyId,
  };
}

/**
 * The internal User.id for the current request, or null when
 * unauthenticated. For API routes (no redirects).
 */
export async function getAuthUserId(): Promise<string | null> {
  const identity = await resolveIdentity();
  return identity?.id ?? null;
}

/**
 * Require an authenticated session. Redirects to sign-in if missing.
 * Does NOT require a company — use for company creation / join flows.
 */
export async function requireSession(): Promise<{
  id: string;
  email: string;
  name?: string | null;
}> {
  const identity = await resolveIdentity();
  if (!identity) {
    redirect("/sign-in");
  }
  return {
    id: identity.id,
    email: identity.email,
    name: identity.name,
  };
}

/**
 * Shared company resolution for an authenticated identity:
 * active-company cookie → preferred hint (legacy JWT) → first membership.
 * Redirects to /onboarding when the user has no membership.
 */
async function resolveCompanyForUser(
  identity: Identity,
): Promise<AuthenticatedUser> {
  const base = {
    id: identity.id,
    email: identity.email,
    name: identity.name,
  };

  // Check for active company cookie (set by company switcher)
  const cookieStore = await cookies();
  const switchedCompanyId = cookieStore.get("maplerun-active-company")?.value;

  // If user switched companies, verify membership and use that
  if (switchedCompanyId) {
    const membership = await prisma.membership.findFirst({
      where: { userId: identity.id, companyId: switchedCompanyId },
      select: { companyId: true },
    });
    if (membership) {
      return { ...base, companyId: membership.companyId };
    }
  }

  // If the identity carries a company hint, verify membership and use it
  if (identity.companyHint) {
    const membership = await prisma.membership.findFirst({
      where: { userId: identity.id, companyId: identity.companyHint },
      select: { companyId: true },
    });
    if (membership) {
      return { ...base, companyId: membership.companyId };
    }
  }

  // Fallback: look up any membership
  const membership = await prisma.membership.findFirst({
    where: { userId: identity.id },
    orderBy: { createdAt: "asc" },
    select: { companyId: true },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  return { ...base, companyId: membership.companyId };
}

/**
 * Require an authenticated session AND a company membership.
 * Redirects to sign-in or company setup as appropriate.
 *
 * This is the primary guard for tenant-scoped operations.
 */
export async function requireCompany(): Promise<AuthenticatedUser> {
  const identity = await resolveIdentity();
  if (!identity) {
    redirect("/sign-in");
  }
  return resolveCompanyForUser(identity);
}

/**
 * Get the current user's companyId without redirecting.
 * Returns null if unauthenticated or no company.
 */
export async function getCompanyId(): Promise<string | null> {
  if (isClerkAuth()) {
    const identity = await resolveIdentity();
    if (!identity) return null;
    const cookieStore = await cookies();
    const switchedCompanyId = cookieStore.get("maplerun-active-company")?.value;
    if (switchedCompanyId) {
      const membership = await prisma.membership.findFirst({
        where: { userId: identity.id, companyId: switchedCompanyId },
        select: { companyId: true },
      });
      if (membership) return membership.companyId;
    }
    const membership = await prisma.membership.findFirst({
      where: { userId: identity.id },
      orderBy: { createdAt: "asc" },
      select: { companyId: true },
    });
    return membership?.companyId ?? null;
  }
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user.companyId ?? null;
}
