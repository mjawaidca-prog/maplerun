# STATE — session handoff

> Update this file + commit at the end of EVERY session. Next session reads CLAUDE.md → this file → resumes. Nothing else.

## Current position
- **Phase 0 (Foundation): DONE** — 2026-06-10, commit `0ac5e56`.
- **Phase 1 (Tax verification + engine hardening): DONE** — 2026-06-10. All 2026 tables verified. 29/29 tests green.
- **Phase 2 (App scaffold + core domain): DONE** — 2026-06-10, commit `b838582`.
- **Phase 3 (Employee management + pay run wizard): DONE** — 2026-06-10, commit `f2be154`.
- **Phase 4 (Remittance + reporting + DB): DONE** — 2026-06-10.
  - **Database provisioned**: Prisma Postgres dev database created at `db.prisma.io:5432`. Migration `20260610210039_init` applied — all 11 models materialized (User, Account, Session, VerificationToken, Company, Membership, Employee, TD1Profile, YtdLedger, PayGroup, PayRun, PayRunItem). DATABASE_URL, ENCRYPTION_KEY, and AUTH_SECRET configured in .env.
  - **PD7A remittance report** at `/reports`: monthly/quarterly aggregation of CPP, CPP2, EI (employee + employer) across finalized pay runs. Per-period breakdown + annual totals with remittance due.
  - **Pay stubs** at `/payroll/[id]/stub/[itemId]`: printable individual employee pay stub with company header, earnings/deductions split, net pay, YTD totals, and CRA disclaimer. Print-optimized layout. Linked from pay run detail page.
  - **ROE (Record of Employment)** at `/reports/roe`: employee list with finalized pay history, detail page with Block 15A/15B/15C data, reason codes per CRA, YTD at termination, link to ROE Web.
  - **Email integration**: Resend utility (`lib/email.ts`) for pay stub delivery and welcome emails. Auth.js Resend provider already wired — needs AUTH_RESEND_KEY in .env to activate.
  - 29/29 tax-engine tests green. Next.js build passes: **17 routes**, full compilation + typecheck.

## Next actions (in order) — Phase 5: polish + launch prep
1. **Neon migration**: Swap Prisma Postgres dev DB for Neon ca-central-1 (PIPEDA compliance). Export/import or fresh migration. Claim the dev DB before 2026-06-11.
2. **PDOC end-to-end spot-checks**: 6 test profiles × 12 jurisdictions against CRA PDOC → `tests/goldens.json`. Surface any deviation >$0.50.
3. **Vacation-pay minimums** data module (employment standards by province — needed for accurate pay).
4. **PDF generation**: Install `@react-pdf/renderer` for server-side PDF pay stubs and T4s. Replace browser-print with proper PDF download.
5. **Landing page polish**: Add testimonials placeholder, pricing section, feature grid. SEO metadata.
6. **Stripe billing**: Subscription plans (Solo/Growth/Accountant), checkout flow, webhook handling.
7. **Launch checklist** (per docs/BRAND.md): CIPO trademark search, domains (maplerun.ca), social handles, E&O insurance quote, provincial business registration.
8. **T4127 July 2026 edition** check (~Jun 15) — update tax tables if CRA publishes mid-year changes.

## Environment facts (don't re-discover)
- Windows 11, PowerShell (no `&&`). Node v24.16.0, npm 11.13.0, git 2.54. Repo root = `MapleRun/`, branch `main`.
- **Shell cwd RESETS between turns** to `C:\Users\mjawa\Downloads\Deen o Dunya` — always `Set-Location MapleRun` first or use absolute paths.
- **Dev database**: Prisma Postgres at db.prisma.io:5432 (us-west-1). Credentials in .env. Claim URL: https://create-db.prisma.io/claim?projectID=proj_cmq8jw6h81bi604gx4vwa5un4 (must claim before 2026-06-11 or it's deleted). Switch to Neon ca-central-1 for production.
- WebSearch/WebFetch tools were broken (backend model error). Workaround: `Invoke-WebRequest -UserAgent '<Chrome UA>'` → save to `docs/sources/`.
- Git CRLF warnings on commit are harmless; `.gitattributes` still TODO.

## Gotchas
- Iron rules in CLAUDE.md. Engine emits warnings only for unverified tables (2026 = all verified).
- Prisma v7 requires `@prisma/adapter-pg` for direct PostgreSQL connections.
- Next.js 16 renamed `middleware.ts` → `proxy.ts`.
- "use server" files can only export async functions — no plain objects or constants. Use separate files for shared constants.
- Protected routes use route group `(app)` (no URL segment). Layout applies `requireCompany()` guard.
- Unmodelled: LCP credits, ON factor Y, TD1X commission, outside-Canada surtax, insurable hours per period.
