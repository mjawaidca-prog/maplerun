# Architecture & Decisions

## Stack (chosen for cost + quality + one-person maintainability)
| Layer | Choice | Why | Cost at launch |
|---|---|---|---|
| Frontend+API | Next.js 15 (App Router, TS) on Vercel | One deployable, SSR, great DX | $0 dev / $20/mo Pro for commercial |
| UI | Tailwind + shadcn/ui + Recharts | ADP/QBO-grade polish without a designer | $0 |
| DB | Neon Postgres, region ca-central-1 | Serverless (scales to zero), Canadian data residency, PITR backups | $0 → $19/mo |
| ORM | Prisma | Type-safe, migrations | $0 |
| Auth | Auth.js v5 (magic link + Google) | Free at any scale, no per-MAU fees | $0 |
| Billing | Stripe Billing | Standard | 2.9% + 30¢ |
| Email | Resend | Stubs + magic links; 100/day free | $0 → $20/mo |
| PDF | @react-pdf/renderer (server-side) | Pay stubs, T4s | $0 |
| Errors | Sentry free tier | | $0 |
| Tax engine | Pure TypeScript workspace package, zero runtime deps | Portable, fully unit-testable, the core IP | $0 |

Total fixed infra at launch: ≈ $40–60/mo + domain (~$20/yr). Until launch: $0.

## Key decisions
1. **Tax engine = pure function library.** `calculatePay(input) → PayResult`. No I/O, no clock. Pay date selects a versioned table edition. UI/DB never compute tax.
2. **Versioned, effective-dated tax tables.** `data/2026/`, `data/2026-jul/` (if mid-year edition changes anything), `data/2027/`… Registry picks by pay date. Tables carry `meta: {verified, source, lastReviewed}`; unverified ⇒ engine warning ⇒ app blocks live runs.
3. **Money policy.** Dollars as float64 with `roundCent()` applied exactly where T4127 specifies (per-period CPP/EI, F5, final per-period tax). Annual intermediates stay unrounded. Documented deviation: bracket constants K are computed cumulatively from thresholds (CRA publishes whole-dollar K; max deviation ≤ 2¢/period — within PDOC tolerance).
4. **Multi-tenancy.** Single DB; every tenant row carries `companyId`; access via Prisma client extension that injects the scope from the session — no raw queries in app code. Roles: OWNER / ADMIN / VIEWER per membership.
5. **PII security.** SIN + bank details encrypted at rest (AES-256-GCM, per-field, key in env/KMS — never in DB or git). TLS everywhere. Audit log table for every mutation of employee/pay data. PIPEDA: data in ca-central-1, retention policy documented, right-to-access supported by export.
6. **Immutable pay runs.** Finalized runs are append-only; corrections happen via reversing/adjustment runs (matches CRA audit expectations).
7. **No money movement in v1** (calculate + report + EFT-file export only). Avoids FINTRAC MSB registration, trust accounts, and float risk. Revisit post-traction.
8. **Monorepo, npm workspaces** (no turborepo until needed). Node 24, ESM throughout.

## Pay calculation flow (T4127 option 1, annualized)
```
gross period income I
→ CPP/CPP2 (per-period, YTD-capped)        calc/cpp.ts
→ EI (per-period, YTD-capped, QC rate)     calc/ei.ts
→ F5 deduction = CPP enhancement + CPP2
→ A = P×(I − F − F5) − HD                  annualized taxable income
→ federal: T3 = R×A − K − K1 − K2 − K4     calc/income-tax.ts
→ provincial: T4 = V×A − KP − K1P − K2P (+ ON surtax + ON health premium)
→ period tax = (T1 + T2)/P, rounded
→ PayResult { employee deductions, net, employer costs (CPP match, EI×1.4), warnings }
```

## Future app structure (Phase 2)
`apps/web/src/app/(marketing)` landing · `(app)/dashboard|employees|payroll|reports|settings` · `api/` route handlers call engine + Prisma. Server components by default; client components only for interactive widgets.
