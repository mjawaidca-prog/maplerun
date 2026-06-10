# STATE — session handoff

> Update this file + commit at the end of EVERY session. Next session reads CLAUDE.md → this file → resumes. Nothing else.

## Current position
- **Phase 0 (Foundation): DONE** — 2026-06-10, commit `0ac5e56`.
- **Phase 1 (Tax verification + engine hardening): DONE** — 2026-06-10. All 2026 tables verified. 29/29 tests green.
- **Phase 2 (App scaffold + core domain): DONE** — 2026-06-10, commit `b838582`. Next.js 16, shadcn/ui maple-red theme, paycheque calculator, Prisma v7 schema, Auth.js v5.
- **Phase 3 (Employee management + pay run wizard): DONE** — 2026-06-10.
  - Protected app layout with sidebar navigation (Dashboard, Employees, Payroll, Company). Route group `(app)` applies sidebar + `requireCompany()` guard.
  - Company onboarding: setup wizard at `/onboarding` (create company + default pay group + owner membership in one step). Company settings page at `/company` shows members, pay groups, details.
  - Employee CRUD: list at `/employees`, add at `/employees/new` (SIN validation + encryption, address, pay group assignment), detail/edit at `/employees/[id]` (personal info, TD1 profile management, YTD snapshot, terminate). AES-256-GCM encryption applied to SIN on create/update.
  - Pay run wizard at `/payroll/new`: 3-step flow — (1) select pay group + date + gross amounts, (2) preview tax-engine calculation per employee with totals, (3) finalize creates immutable PayRun + PayRunItem records and updates YTD ledgers. Past runs listed at `/payroll`, detail at `/payroll/[id]`.
  - Prisma schema extended with PayRun (DRAFT/FINALIZED/REVERSED) and PayRunItem models. Server actions for all domains with tenant-scoped access via `requireCompany()`.
  - 29/29 tax-engine tests green. Next.js build passes: 13 routes, full compilation + typecheck.

## Next actions (in order) — Phase 4: remittance + reporting + polish
1. Provision a real Neon PostgreSQL database (ca-central-1) and run the first Prisma migration (still blocked on external service — use Neon console or `npx create-db` for dev).
2. Build PD7A remittance summary report (CPP, CPP2, EI totals per period) and T4 year-end output.
3. Build pay stub view (employee facing, per-pay-run-item detail).
4. Add ROE (Record of Employment) data export — EI insurable hours + earnings blocks.
5. Integrate Resend for magic-link emails and employee pay stub delivery.
6. (Phase 1 leftovers): PDOC end-to-end spot-checks (6 profiles × 12 jurisdictions); vacation-pay minimums data module.

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
- Prisma v7 requires `@prisma/adapter-pg` for direct PostgreSQL connections. `DATABASE_URL` must be set before first real DB access (lazy proxy prevents build-time crash). Prisma Postgres has no Canadian region — Neon (ca-central-1) required for PIPEDA compliance.
- Next.js 16 renamed `middleware.ts` → `proxy.ts` with changed export convention (named `proxy` function or default export).
- Protected routes use route group `(app)` which doesn't add URL segments. Layout at `(app)/layout.tsx` protects all routes via `requireCompany()`. Public routes (`/`, `/sign-in`, `/verify-request`) live outside the group.
- Unmodelled (rare, documented): LCP credits, ON factor Y, TD1X commission, outside-Canada surtax.
