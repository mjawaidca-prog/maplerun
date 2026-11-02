/**
 * Auth provider switch — the single rollback lever for the Clerk migration.
 *
 * `APP_AUTH_PROVIDER` env var:
 *   - unset or "legacy" → Auth.js v5 (lib/auth.ts) — the live system today
 *   - "clerk"           → Clerk (@clerk/nextjs), identity linked via User.clerkUserId
 *
 * Unknown values fall back to "legacy" (fail-safe toward the system that is
 * live). Read dynamically on every call so tests and runtime flips behave.
 *
 * Consulted in exactly these places:
 *   - src/proxy.ts               (which route-protection handler runs)
 *   - src/components/providers.tsx (which client session provider renders)
 *   - src/lib/session.ts         (which identity resolver runs)
 *   - src/app/sign-in + signup pages (which form renders)
 *   - src/app/api/webhooks/clerk (webhook route self-disables in legacy mode)
 */

export type AuthMode = "legacy" | "clerk";

export function getAuthMode(): AuthMode {
  return process.env.APP_AUTH_PROVIDER === "clerk" ? "clerk" : "legacy";
}

export function isClerkAuth(): boolean {
  return getAuthMode() === "clerk";
}
