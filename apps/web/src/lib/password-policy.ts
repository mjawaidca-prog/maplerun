/**
 * Shared password policy constants — kept dependency-free so both server
 * code (lib/password-reset.ts) and client components can import them
 * without pulling server-only modules into the browser bundle.
 */

export const MIN_PASSWORD_LENGTH = 8;
