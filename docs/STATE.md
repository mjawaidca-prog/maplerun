# STATE — session handoff

> Update this file + commit at the end of EVERY session. Next session reads CLAUDE.md → this file → resumes. Nothing else.

## Current position
- **Phase 0 (Foundation): DONE** — 2026-06-10, commit `0ac5e56`.
- Tax engine v1 working: 20/20 tests green, typecheck clean. `npm test -w @maplerun/tax-engine` from `MapleRun/`.
- All 2026 tax tables are `verified: false` (web tools were down this session) — engine emits warnings by design.

## Next actions (in order)
1. **Phase 1 — verify 2026 tax data.** Fetch CRA T4127 121st ed. (canada.ca 403-blocks WebFetch — try search-result caches, the T4127 PDF URL, or ask user to save the page locally). Diff every constant in `packages/tax-engine/src/data/2026/`, fix, flip `meta.verified`, update TAX-COMPLIANCE.md confidence table. Priority checks: YAMPE (85,400 vs 85,300), QC EI rate (1.30%), SK/MB/NS/PE brackets+BPA, CEA (1,500), BPAF (16,452/14,829).
2. **Phase 1 — PDOC golden tests** per TAX-COMPLIANCE.md protocol (6 profiles × 12 jurisdictions → `tests/goldens.json`).
3. **Phase 1 — engine additions:** bonus-method tax, vacation pay, BC tax reduction, NS BPA supplement, MB BPA phase-out. Then start Phase 2 scaffold: `npx create-next-app@latest apps/web --ts --tailwind --eslint --app --src-dir --import-alias "@/*"` then shadcn/ui init (design tokens per BRAND.md).

## Environment facts (don't re-discover)
- Windows 11, PowerShell (no `&&`). Node v24.16.0, npm 11.13.0, git 2.54. Repo root = `MapleRun/`, branch `main`.
- WebSearch/WebFetch were failing all session with a backend model error ("deepseek-v4-flash") — retry next session; if still broken, search-engine caches won't be reachable either, so consider asking the user to download the T4127 PDF into `docs/sources/`.
- Git emits CRLF warnings on commit — harmless; add `.gitattributes` (`* text=auto eol=lf`) when convenient.

## Open decisions (non-blocking)
- Final name check (CIPO/domain) for "MapleRun" happens at Phase 7 — alternates in BRAND.md.
- Pricing finalized at Phase 6.
- User accounts needed only at Phase 7: domain, Vercel, Neon, Stripe, Resend.

## Gotchas
- Iron rules live in CLAUDE.md — especially: rates only in `data/<year>/`, engine purity, no money movement v1.
- `bracketFor` computes K cumulatively from thresholds (documented ≤2¢/period deviation from CRA's published whole-dollar K) — don't "fix" by hardcoding K.
- QC: income tax throws by design (Phase 2); QC EI reduced rate already works.
