# STATE — session handoff

> Update this file + commit at the end of EVERY session. Next session reads CLAUDE.md → this file → resumes. Nothing else.

## Current position
- **Phase 0–5: DONE** — all verified, 21 routes, 137 tests.
- **Phase 6 (Quebec + polish): IN PROGRESS** — 2026-06-11.
  1. ✅ Quebec income tax — QPP, QPIP, federal abatement, TP-1015.3 provincial tax. All 13 provinces/territories now supported.
  2. ✅ PDOC cross-check — formulas verified against T4127 constants; 85 goldens as regression baseline.
  3. 🔜 AUTH_RESEND_KEY — code wired, needs Resend API key from user.
  4. 🔜 Stripe Dashboard — code wired, needs products/prices + keys from user.
  5. 🔜 Domain — getmaplerun.com available, needs registration.

## Next actions (in order)
1. **AUTH_RESEND_KEY**: Go to resend.com → sign up → create API key → paste in .env as `AUTH_RESEND_KEY="re_..."`
2. **Stripe Dashboard**: Create products/prices for Solo ($15)/Growth ($25)/Accountant ($59) in Stripe test mode → copy keys to .env
3. **Domain**: Register getmaplerun.com ($15/yr at any registrar)

## Environment facts (don't re-discover)
- Windows 11, PowerShell (no `&&`). Node v24.16.0, npm 11.13.0, git 2.54. Repo root = `MapleRun/`, branch `main`.
- **Shell cwd RESETS between turns** to `C:\Users\mjawa\Downloads\Deen o Dunya` — always `Set-Location MapleRun` first or use absolute paths.
- **Dev database**: Neon PostgreSQL at `ep-lucky-water-apddmb88.c-7.us-east-1.aws.neon.tech` (aws-us-east-1). Project `bitter-grass-02771790`. Neon account: mjawaid.ca. ca-central-1 not available on this plan — switch to Canadian region for production.
- WebSearch/WebFetch tools were broken (backend model error). Workaround: `Invoke-WebRequest -UserAgent '<Chrome UA>'` → save to `docs/sources/`.
- Git CRLF warnings on commit are harmless; `.gitattributes` still TODO.

## Gotchas
- Iron rules in CLAUDE.md. Engine emits warnings only for unverified tables (2026 = all verified).
- Prisma v7 requires `@prisma/adapter-pg` for direct PostgreSQL connections.
- Next.js 16 renamed `middleware.ts` → `proxy.ts`.
- "use server" files can only export async functions — no plain objects or constants. Use separate files for shared constants.
- Protected routes use route group `(app)` (no URL segment). Layout applies `requireCompany()` guard.
- Unmodelled: LCP credits, ON factor Y, TD1X commission, outside-Canada surtax, insurable hours per period.
