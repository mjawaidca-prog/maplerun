/**
 * Employee portal — session/link resolution (Wave 3, A4).
 *
 * The portal does NOT run its own auth. It consumes the Clerk identity seam
 * (lib/clerk-identity.ts) and resolves which Employee record(s) that
 * identity may see:
 *
 *   1. Employees already linked by clerkUserId.
 *   2. First-link: employees the employer invited (portalInvitedAt set,
 *      clerkUserId still null) whose email equals the Clerk-verified email.
 *      The match persists clerkUserId onto the record. An email matching a
 *      record already linked to a DIFFERENT clerkUserId is never re-linked.
 *
 * Every portal read must go through `getActivePortalEmployee()` (or scope
 * its queries by an employment returned here) — employeeId/companyId come
 * from this resolution, never from client input. The
 * `nexvar-portal-company` cookie only SELECTS among the resolved
 * employments; it is re-validated on every request and grants nothing.
 */

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getClerkIdentity, type ClerkIdentity } from "@/lib/clerk-identity";

export const PORTAL_COMPANY_COOKIE = "nexvar-portal-company";

export interface PortalEmployment {
  employeeId: string;
  companyId: string;
  companyName: string;
  firstName: string;
  lastName: string;
}

async function toEmployment(e: {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  company: { name: string };
}): Promise<PortalEmployment> {
  return {
    employeeId: e.id,
    companyId: e.companyId,
    companyName: e.company.name,
    firstName: e.firstName,
    lastName: e.lastName,
  };
}

/** All employments the current Clerk identity may access (possibly empty). */
export async function resolvePortalEmployments(): Promise<{
  identity: ClerkIdentity | null;
  employments: PortalEmployment[];
}> {
  const identity = await getClerkIdentity();
  if (!identity) return { identity: null, employments: [] };

  const linked = await prisma.employee.findMany({
    where: { clerkUserId: identity.clerkUserId },
    include: { company: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const employments: PortalEmployment[] = [];
  for (const e of linked) employments.push(await toEmployment(e));

  // First-link by verified email for invited, not-yet-linked employees.
  const email = identity.email.trim().toLowerCase();
  if (email) {
    const candidates = await prisma.employee.findMany({
      where: {
        clerkUserId: null,
        portalInvitedAt: { not: null },
        email: { equals: email, mode: "insensitive" },
      },
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    for (const candidate of candidates) {
      // Conditional update: link only if still unlinked (race-safe).
      const res = await prisma.employee.updateMany({
        where: { id: candidate.id, clerkUserId: null },
        data: { clerkUserId: identity.clerkUserId },
      });
      if (res.count === 1) employments.push(await toEmployment(candidate));
    }
  }

  return { identity, employments };
}

/**
 * The employment the portal should act on for this request: the
 * cookie-selected one when it is within the resolved set, else the first
 * resolved employment. Null when the identity resolves to nothing.
 */
export async function getActivePortalEmployee(): Promise<{
  identity: ClerkIdentity;
  employments: PortalEmployment[];
  active: PortalEmployment;
} | null> {
  const { identity, employments } = await resolvePortalEmployments();
  if (!identity || employments.length === 0) return null;

  const cookieStore = await cookies();
  const selected = cookieStore.get(PORTAL_COMPANY_COOKIE)?.value;
  const active =
    employments.find((e) => e.employeeId === selected) ?? (employments[0] as PortalEmployment);
  return { identity, employments, active };
}
