# MapleRun — Canadian Payroll SaaS

Cloud payroll for Canadian small businesses (1–100 employees). Calculates CRA-compliant payroll deductions (federal/provincial income tax, CPP/CPP2, EI; QPP/QPIP for Quebec in Phase 2), runs payroll, produces pay stubs, remittance (PD7A) and year-end (T4) outputs. Subscription product. Competes on price + simplicity with ADP / QuickBooks Payroll / Wagepoint.

## Session protocol (token discipline)
- START: read this file, then `docs/STATE.md`. Nothing else by default.
- Use the file map below instead of exploring. Read only files you will modify.
- END: update `docs/STATE.md` (phase, done, next 3 actions, gotchas), then `git add -A && git commit`.
- Long-term memory lives in Claude's memory dir (`project-maplerun-*` files) — STATE.md is the single source of truth if they disagree.

## Stack (locked — see docs/ARCHITECTURE.md for rationale)
- Monorepo: npm workspaces. `packages/tax-engine` (pure TS, zero deps), `apps/web` (Next.js 15 + TypeScript + Tailwind + shadcn/ui, Phase 2).
- DB: PostgreSQL on Neon (ca-central-1), Prisma ORM. Auth: Auth.js v5. Billing: Stripe. Email: Resend. Hosting: Vercel.
- Tests: Vitest. Run: `npm test -w @maplerun/tax-engine` (from `MapleRun/`).

## Iron rules
1. Tax rates/constants live ONLY in `packages/tax-engine/src/data/<year>/`. Never hardcode a rate in calc code.
2. Every tax table carries `meta: { verified, source, lastReviewed }`. Engine emits a warning on unverified tables; the app must block live pay runs on them.
3. Money = dollar `number`s with explicit `roundCent()` at CRA-specified steps only (T4127 method). No ad-hoc rounding.
4. Engine stays pure/deterministic: no I/O, no dates-from-clock; pay date comes in as input and selects the table edition.
5. v1 scope guardrail: calculate + report only. No money movement (no holding/remitting client funds) — keeps us out of FINTRAC MSB territory until deliberately decided.
6. Quebec income tax/QPP/QPIP = Phase 2 (engine throws a clear error for QC tax today; EI knows the QC-reduced rate already).

## File map
```
CLAUDE.md                      ← you are here
docs/STATE.md                  ← session handoff: status + next actions (ALWAYS read)
docs/ROADMAP.md                ← phases 0–7 with acceptance criteria
docs/ARCHITECTURE.md           ← stack decisions, multi-tenancy, security, rounding policy
docs/TAX-COMPLIANCE.md         ← data sources, 2026 figures + confidence, verification protocol, update calendar
docs/BRAND.md                  ← name (MapleRun), alternates, pricing draft, launch checklist
packages/tax-engine/src/
  types.ts                     ← all shared types (provinces, frequencies, tables, inputs/results)
  money.ts                     ← roundCent + clamp helpers
  data/2026/federal.ts         ← federal brackets, BPAF, CEA (verified)
  data/2026/cpp-ei.ts          ← CPP/CPP2/EI constants (verified)
  data/2026/provinces.ts       ← all 13 provincial/territorial tables (verified; QC placeholder)
  data/2026/quebec.ts          ← QPP/QPIP/abatement constants, Phase-2-ready (verified)
  data/index.ts                ← table registry; pay-date → year edition lookup
  calc/cpp.ts                  ← CPP + CPP2 per-period with YTD caps
  calc/ei.ts                   ← EI premium with YTD cap, QC-reduced rate
  calc/income-tax.ts           ← annual T3/T2 helpers + per-period tax (K1–K5P, surtax, reductions, health premium)
  calc/bonus.ts                ← T4127 bonus/non-periodic payment method
  calc/pay-run.ts              ← orchestrator → PayResult (employee + employer sides, warnings)
  index.ts                     ← public API: calculatePay(), calculateBonus()
docs/sources/                  ← downloaded CRA pages (audit trail; canada.ca needs browser UA)
packages/tax-engine/tests/engine.test.ts
```

## Domain cheat-sheet (2026 VERIFIED vs T4127 121st ed. — sources in docs/sources/)
- T4127 = CRA "Payroll Deductions Formulas", new editions every Jan + Jul.
- CPP: `0.0595 × (pensionable − 3500/P)`, max $4,230.45 (YMPE 74,600). CPP2: 4% between YMPE and YAMPE 85,000 (max $416), cumulative. QPP 2026: 6.30% (data/2026/quebec.ts).
- EI: `1.63% × insurable`, MIE 68,900, max $1,123.07 (QC 1.30%/$895.70). Employer = 1.4×.
- Income tax: annualize `A = P×(I − F − F5) − HD`; F5 = CPP enhancement (C×1/5.95) + all CPP2 (deduction, not credit). Credits at lowest rate: K1 (TD1 claim; BPAF/BPAMB/BPAYT are income-tested on NI=A+HD), K2 (base CPP 4.95/5.95 share + EI), K4 (CEA 1,501, federal + YT only). Province extras: ON surtax (20% > 5,818 / 36% > 7,446) + health premium + tax reduction (S, 2×300); BC reduction (575 → 0 across A 25,570–41,722); AB K5P top-up. Final: annual ÷ P, round to cent.
- Bonus method (calc/bonus.ts): tax = annualTax(A+B−F5b) − annualTax(A), withheld in full; CPP on bonus has no period exemption.
- Engine derives K/KP cumulatively from thresholds — verified ≡ CRA's published constants ±$0.50. Never hardcode K.
