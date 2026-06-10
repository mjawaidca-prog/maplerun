# MapleRun Roadmap

Build order is strictly sequential — each phase produces something testable and never requires reworking a previous phase. Estimated effort is in working sessions (one focused Claude Code session each).

## Phase 0 — Foundation (DONE — 2026-06-10)
Project structure, git, planning docs, session-transition system, tax engine v1 (federal + 12 non-QC jurisdictions, CPP/CPP2/EI), unit tests.

## Phase 1 — Tax data verification & engine hardening (1–2 sessions)
- Verify every 2026 constant against CRA T4127 121st ed. + provincial sources; flip `meta.verified` flags. (Web tools were down during Phase 0 — tables are seeded from model knowledge and so marked unverified.)
- Golden tests: 6 employee profiles × 12 jurisdictions cross-checked against CRA PDOC; tolerance ≤ $0.05 on period tax.
- Add: bonus/retro tax method, vacation pay %, BC tax reduction (S factor), NS low-income BPA supplement, MB BPA phase-out.
- Acceptance: all goldens pass; `verified: true` everywhere except QC.

## Phase 2 — App scaffold + core domain (2–3 sessions)
- `apps/web`: Next.js 15 + TS + Tailwind + shadcn/ui; design system (tokens, layout shell, nav) per docs/BRAND.md.
- Neon Postgres (ca-central-1) + Prisma. Auth.js v5 (email magic link + Google).
- Models: User, Company (tenant), Membership(role), Employee (SIN encrypted), PayGroup(frequency), TD1Profile, YtdLedger.
- Employee CRUD with TD1 wizard; company onboarding wizard (CRA payroll account/BN, remitter type, province).
- Quebec engine support (QC income tax via TP-1015.3 formulas, QPP, QPIP) if Phase 1 left it pending.
- Acceptance: sign up → create company → add employees with TD1 → data persists, multi-tenant isolated.

## Phase 3 — Pay runs (2–3 sessions)
- Pay-run wizard: select period → enter/confirm hours & one-off earnings/deductions → preview (engine) → approve → finalize (immutable, ledger updated).
- Earning/deduction types: salary, hourly, overtime, bonus (bonus method), vacation pay (accrue or pay-out), RRSP, union dues, taxable benefits.
- Pay stubs: PDF (per province stub requirements), employee email delivery (Resend).
- Acceptance: full biweekly run for a 5-employee ON company matches PDOC within $0.05/employee; stubs render correctly; YTD rolls forward.

## Phase 4 — Reporting & remittance (1–2 sessions)
- PD7A-style remittance report per period with due dates by remitter type (regular/quarterly/accelerated).
- Dashboards: payroll cost trend, upcoming remittances, employee count (Recharts).
- Exports: payroll journal CSV + QuickBooks/Xero-compatible format; CPA-005 EFT file (export-only direct deposit).
- Acceptance: remittance totals reconcile to sum of finalized runs.

## Phase 5 — Year-end & compliance docs (2 sessions)
- T4 slips + T4 Summary, XML for CRA Internet File Transfer; RL-1 for QC.
- ROE generation (ROE Web XML) on termination.
- Acceptance: T4 XML validates against CRA schema; ROE fields complete for standard termination.

## Phase 6 — Subscriptions & polish (1–2 sessions)
- Stripe: plans (see BRAND.md pricing), trial, billing portal, plan gates.
- Marketing site (landing, pricing, security page), in-app onboarding checklist, empty states.
- Acceptance: card → subscription → feature gates work in Stripe test mode.

## Phase 7 — Launch (1 session + user actions)
- USER one-time actions (guided): register domain, create Vercel/Neon/Stripe/Resend accounts, CIPO trademark search for "MapleRun", business registration/insurance decision.
- Security pass (OWASP top-10 review, rate limiting, audit log), PIPEDA privacy policy + ToS, backups/PITR check, error monitoring (Sentry free tier).
- Deploy production, smoke-test with a real pilot company (founder's own or a friendly SMB), soft launch.

## Standing maintenance (post-launch, recurring)
- Jan + Jul: new T4127 edition → new `data/<year>[-jul]` tables + golden re-verification (≈1 session each).
- Nov: CPP/EI next-year announcement; Feb–Apr: provincial budgets — log changes in TAX-COMPLIANCE.md.

## Out of scope until explicitly decided
Money movement (holding/remitting funds), workers' comp filings, employer health taxes (ON EHT/BC EHT/MB/NL/QC HSF — most target SMBs are under exemption thresholds; revisit at Phase 5), time tracking, HR features beyond payroll.
