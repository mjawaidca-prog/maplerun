/**
 * CLERK IDENTITY SEAM — implemented by the Clerk track, consumed by Wave 3.
 *
 * Nexvar is adopting Clerk as the shared identity provider (one "Nexvar"
 * application for Nexvar Pay + LedgerPro). The Clerk track owns the Clerk
 * application, the User.clerkUserId link, and all auth wiring.
 *
 * Wave 3's employee portal depends ONLY on this interface:
 *
 *   getClerkIdentity() → the verified Clerk identity for the current
 *   request, or null when there is no signed-in Clerk user.
 *
 * Contract for the implementation:
 *  - Resolve the Clerk session server-side (e.g. @clerk/nextjs `auth()` +
 *    `currentUser()`, or `clerkClient().users.getUser(userId)`).
 *  - `email` MUST be a Clerk-verified email address of that user (the
 *    portal's first-link resolution trusts it to bind an Employee record).
 *  - Never throw for a signed-out request — return null.
 *
 * The implementation below is a deliberate FAIL-CLOSED placeholder: until
 * the Clerk track lands, every portal request resolves to "signed out" and
 * the portal renders its signed-out state. Nothing is reachable without an
 * identity.
 */

export interface ClerkIdentity {
  clerkUserId: string;
  email: string;
}

export async function getClerkIdentity(): Promise<ClerkIdentity | null> {
  // TODO(Clerk track): replace with the real Clerk server-side lookup.
  return null;
}
