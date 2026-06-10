# STATE — session handoff

> Update this file + commit at the end of EVERY session. Next session reads CLAUDE.md → this file → resumes. Nothing else.

## Current position
- **Phase 0 (Foundation): DONE** — 2026-06-10, commit `0ac5e56`.
- **Phase 1 (Tax verification + engine hardening): DONE** — 2026-06-10. All 2026 tables verified. 29/29 tests green.
- **Phase 2 (App scaffold + core domain): DONE** — 2026-06-10.
  - Scaffolded Next.js 16 app in `apps/web` (TS, Tailwind, App Router, src dir).
  - shadcn/ui initialized with stone/maple-red brand theme (Inter font, tabular numerals, dark mode from day 1, accent #B3261E).
  - `@maplerun/tax-engine` wired via `transpilePackages` — paycheque calculator public page with province/frequency/income inputs, full deduction breakdown, employer costs, and warnings. Builds and typechecks clean.
  - Prisma v7 + PostgreSQL (Neon ca-central-1): schema with Auth.js v5 adapter models (User, Account, Session, VerificationToken) + application models (Company, Membership, Employee, TD1Profile, YtdLedger, PayGroup). `MembershipRole` enum (OWNER/ADMIN/VIEWER). AES-256-GCM encryption utility for SIN/bank details. Lazy PrismaClient singleton with `@prisma/adapter-pg`.
  - Auth.js v5 (next-auth@5.0.0-beta.31): Resend magic-link provider + Google OAuth. JWT sessions with companyId attachment from Membership. Sign-in page, verify-request page, protected `/app` dashboard placeholder, proxy-based route protection.
  - 29/29 tax-engine tests green; Next.js build passes (7 routes: `/`, `/sign-in`, `/verify-request`, `/app`, `/api/auth/[...nextauth]`, proxy).

## Next actions (in order) — Phase 3: employee management + pay run wizard
1. Provision a real Neon PostgreSQL database (ca-central-1) and run the first Prisma migration.
2. Build company onboarding flow: create company → invite members → set up pay groups.
3. Build employee CRUD: list/add/edit/terminate employees, TD1 profile management, SIN encryption integration.
4. Build the pay run wizard: select pay group → load employees with YTD → calculate via tax engine → preview → finalize (immutable runs).
5. (Optional, from Phase 1 leftovers): PDOC end-to-end spot-checks; vacation-pay minimums data module.

## Environment facts (don't re-discover)
- Windows 11, PowerShell (no `&&`). Node v24.16.0, npm 11.13.0, git 2.54. Repo root = `MapleRun/`, branch `main`.
- **Shell cwd RESETS between turns** to `C:\Users\mjawa\Downloads\Deen o Dunya` — always `Set-Location MapleRun` first or use absolute paths.
- WebSearch/WebFetch tools were broken (backend model error). Workaround that WORKS: `Invoke-WebRequest -UserAgent '<Chrome UA string>'` downloads canada.ca fine → save to `docs/sources/` → Read/Grep locally.
- Git CRLF warnings on commit are harmless; `.gitattributes` still TODO (optional).
- `C:\Users\mjawa\package-lock.json` exists (outside project) → causes turbopack.root warning during Next.js build; harmless, just ignore.

## Gotchas
- Iron rules in CLAUDE.md. Engine emits warnings only for unverified tables (2026 = all verified, so warnings are empty — tests assert this).
- `bracketFor` derives K cumulatively — verified to match every CRA-published K/KP ±$0.50. Don't hardcode K.
- T4127 Jan-2026 page already includes a May-2026 PEI update; July edition check still due ~Jun 15 (calendar in TAX-COMPLIANCE.md).
- QC income tax throws by design until Phase 2; QC EI reduced rate + QPP/QPIP data already work/exist. Calculator handles QC error gracefully (shows coming-soon message).
- Prisma v7 requires `@prisma/adapter-pg` for direct PostgreSQL connections. `DATABASE_URL` must be set before first real DB access (lazy proxy prevents build-time crash).
- Next.js 16 renamed `middleware.ts` → `proxy.ts` with changed export convention (named `proxy` function or default export).
- Unmodelled (rare, documented): LCP credits, ON factor Y, TD1X commission, outside-Canada surtax.
