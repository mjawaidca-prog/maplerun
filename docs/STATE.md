# STATE — session handoff

> Update this file + commit at the end of EVERY session. Next session reads CLAUDE.md → this file → resumes. Nothing else.

## Current position
- **Phase 0 (Foundation): DONE** — 2026-06-10, commit `0ac5e56`.
- **Phase 1 (Tax verification + engine hardening): DONE** — 2026-06-10. All 2026 tables verified against CRA T4127 121st ed. (sources archived in `docs/sources/`); engine corrected (YMPE 74,600, MIE 68,900, MB freeze, NS flat BPA, ON/BC reductions, AB K5P, YT K4P) and extended with the bonus method. **29/29 tests green**, typecheck clean. `npm test -w @maplerun/tax-engine` from `MapleRun/`.
- Verified Quebec constants (QPP 6.30%, QPIP 0.43%, abatement 16.5%) parked in `data/2026/quebec.ts` for Phase 2.

## Next actions (in order) — Phase 2: app scaffold + core domain
1. Scaffold: from `MapleRun/` run `npx create-next-app@latest apps/web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm` (set `$env:CI='1'` to suppress prompts), then shadcn/ui init; apply design tokens per docs/BRAND.md (maple red accent, Inter, tabular numerals, dark mode).
2. Wire `@maplerun/tax-engine` into the app (transpilePackages) + build a public "paycheque calculator" page as the first UI proof (marketing asset + engine demo).
3. Prisma + Neon (ca-central-1): models User, Company, Membership, Employee (SIN encrypted AES-256-GCM), PayGroup, TD1Profile, YtdLedger. Auth.js v5 (magic link). Multi-tenant scoping via Prisma client extension.
4. (Phase 1 leftovers, optional, low priority): PDOC end-to-end spot-checks (6 profiles × 12 jurisdictions → tests/goldens.json); vacation-pay minimums data module (employment standards — needed by Phase 3 anyway).

## Environment facts (don't re-discover)
- Windows 11, PowerShell (no `&&`). Node v24.16.0, npm 11.13.0, git 2.54. Repo root = `MapleRun/`, branch `main`.
- **Shell cwd RESETS between turns** to `C:\Users\mjawa\Downloads\Deen o Dunya` — always `Set-Location MapleRun` first or use absolute paths.
- WebSearch/WebFetch tools were broken (backend model error) both sessions. Workaround that WORKS: `Invoke-WebRequest -UserAgent '<Chrome UA string>'` downloads canada.ca fine → save to `docs/sources/` → Read/Grep locally.
- Git CRLF warnings on commit are harmless; `.gitattributes` still TODO (optional).

## Gotchas
- Iron rules in CLAUDE.md. Engine emits warnings only for unverified tables (2026 = all verified, so warnings are empty — tests assert this).
- `bracketFor` derives K cumulatively — verified to match every CRA-published K/KP ±$0.50. Don't hardcode K.
- T4127 Jan-2026 page already includes a May-2026 PEI update; July edition check still due ~Jun 15 (calendar in TAX-COMPLIANCE.md).
- QC income tax throws by design until Phase 2; QC EI reduced rate + QPP/QPIP data already work/exist.
- Unmodelled (rare, documented): LCP credits, ON factor Y, TD1X commission, outside-Canada surtax.
