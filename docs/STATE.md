# STATE — session handoff

> Update this file + commit at the end of EVERY session. Next session reads CLAUDE.md → this file → resumes. Nothing else.

## Current position
- **Phase 0–5: DONE** — all verified, 26 routes, 137 tests.
- **Phase 6 (Quebec + polish): DONE** — 2026-06-11.
- **Full redesign (June 12–14): DONE** — 24 screens pixel-matched to designer HTML.
- **Plan tiering architecture (June 14): DONE** — Steps 0-4 implemented.
  - ✅ Step 0: plan flag on Company, can() capability map, TIERS system
  - ✅ Step 1: UpgradePrompt + UpgradeBanner shared components
  - ✅ Step 2: Adaptive sidebar — 5/8/9 items per plan with colored dot badge
  - ✅ Step 3: Payroll Summary report + plan-aware dashboard widgets (4/6 stats)
  - ✅ Step 4: Wizard progressive disclosure (Solo simple / Growth expander / Accountant grid)
  - ✅ P1: ROE plan gate + Stripe checkout wiring
  - ✅ P2: ROE pages redesigned (list + detail with Service Canada layout)

## Next actions
1. **Cloudflare DNS**: Migrate from Namecheap DNS → switch to Resend live key
2. **Stripe Dashboard**: Create products/prices in Stripe, copy keys to .env
3. **Timesheet screens**: Build entry + CSV import per designer HTML
4. **Year-End Centre**: Build wizard for T4/RL-1 filing season
5. **Deploy**: Push to GitHub → Vercel → live at nexvarlab.com

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
