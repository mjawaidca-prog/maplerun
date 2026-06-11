# STATE — session handoff

> Update this file + commit at the end of EVERY session. Next session reads CLAUDE.md → this file → resumes. Nothing else.

## Current position
- **Phase 0 (Foundation): DONE** — 2026-06-10.
- **Phase 1 (Tax verification + engine hardening): DONE** — 2026-06-10. All 2026 tables verified.
- **Phase 2 (App scaffold + core domain): DONE** — 2026-06-10.
- **Phase 3 (Employee management + pay run wizard): DONE** — 2026-06-10.
- **Phase 4 (Remittance + reporting + DB): DONE** — 2026-06-10. 11 models, 17 routes.
- **Phase 5 (Polish + launch prep): DONE** — 2026-06-11. All 8 items complete:
  1. ✅ Neon migration — project `bitter-grass-02771790` in aws-us-east-1 (ca-central-1 unavailable on this plan).
  2. ✅ PDOC spot-checks — 6 profiles × 12 provinces + bonus = 85 golden tests. Manual PDOC cross-check pending.
  3. ✅ Vacation-pay minimums — 14 jurisdictions (13 provinces + federal) with tiers, years-of-service thresholds, calc helpers.
  4. ✅ PDF generation — @react-pdf/renderer v4.5.1, pay stub PDF template + API route.
  5. ✅ Landing page — feature grid, pricing (Solo/Growth/Accountant), testimonials, SEO metadata, CTA buttons.
  6. ✅ Stripe billing — checkout session API, webhook handler, plan definitions. Awaiting Stripe API keys in .env.
  7. ✅ Launch checklist — docs/LAUNCH-CHECKLIST.md. maplerun.ca taken, getmaplerun.com available.
  8. ✅ T4127 July 2026 — BC rate/reduction, NL BPA, PE bracket updated. Two editions now registered.
  - **135 tests green** (29 engine + 85 PDOC + 15 vacation-pay + 6 July edition). 21 Next.js routes. Full build + typecheck passes.

## Next actions — Phase 6: Quebec + polish
1. **Quebec income tax** (TP-1015.3): Implement QC provincial tax with abatement, QPP, QPIP. Data already in data/2026/quebec.ts.
2. **PDOC manual cross-check**: Spot-check goldens against live PDOC at https://apps.cra-arc.gc.ca/ebci/rhpd/beta/entry/en
3. **AUTH_RESEND_KEY**: Set up Resend API key for passwordless email auth.
4. **Stripe Dashboard**: Create products/prices for Solo/Growth/Accountant, copy keys to .env.
5. **Register getmaplerun.com** domain.

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
