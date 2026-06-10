/**
 * Session + tenant helpers for server components and actions.
 *
 * Every tenant-scoped operation must call `requireCompany()` to get the
 * current user's companyId. Use `requireSession()` for endpoints that
 * don't need a company context (e.g., company creation itself).
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name?: string | null;
  companyId: string;
};

/**
 * Require an authenticated session. Redirects to sign-in if missing.
 * Does NOT require a company — use for company creation / join flows.
 */
export async function requireSession(): Promise<{
  id: string;
  email: string;
  name?: string | null;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
  };
}

/**
 * Require an authenticated session AND a company membership.
 * Redirects to sign-in or company setup as appropriate.
 *
 * This is the primary guard for tenant-scoped operations.
 */
export async function requireCompany(): Promise<AuthenticatedUser> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  // If the JWT already has a companyId, use it
  if (session.user.companyId) {
    // Verify the membership still exists
    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id, companyId: session.user.companyId },
      select: { companyId: true },
    });
    if (membership) {
      return {
        id: session.user.id,
        email: session.user.email ?? "",
        name: session.user.name,
        companyId: membership.companyId,
      };
    }
  }

  // Fallback: look up any membership
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { companyId: true },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    companyId: membership.companyId,
  };
}

/**
 * Get the current user's companyId without redirecting.
 * Returns null if unauthenticated or no company.
 */
export async function getCompanyId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user.companyId ?? null;
}
