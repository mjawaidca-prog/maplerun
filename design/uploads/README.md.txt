# MapleRun — Design System & Handoff

Premium Canadian payroll product. Should feel like a bank dashboard (clean, trustworthy)
crossed with modern SaaS (friendly, fast). Audience: business owners, accountants, employees.

## Principles
- **Bank-statement quality** for Pay Stubs and T4s — these get printed, emailed, filed.
- **Plain English** labels; group complex payroll info into cards; progressive disclosure.
- **Guided & safe**: confirm before finalizing payroll; preview everything first.
- **Money is sacred**: always Geist Mono, tabular-nums, right-aligned.
- Support light + dark, desktop (1440) + mobile (375), and empty/loading/error/print states.

## Brand
- Accent: maple red `#B3261E` (dark mode `#E56A5C`)
- Type: Inter (UI), Geist Mono (money/figures)

## Folder index
- `tokens.md` — colors, type, spacing, radius, shadows
- `components.md` — component specs (button, input, card, table, badge, modal, etc.)
- `screens/` — desktop/mobile/dark/print mockups
- `states/` — empty, loading, error

## Screens delivered
Pay Stub (light + dark) · T4 Slip · Landing (desktop + mobile) · Pay Run Wizard (3 steps) ·
Dashboard · Employee List · Add/Edit Employee · Reports Dashboard · Upgrade Modal ·
Sign In · Onboarding · Payroll History · Pay Run Detail · T4 Summary · Company Settings
(+ Tax Rates) · Empty/Loading/Error states.

## IMPORTANT — yearly tax rates
CPP/CPP2/EI/tax values are NOT design constants. Store them as **per-year data**
(e.g. `rates/2026.ts`, `rates/2027.ts`) keyed by tax year. The engine reads
`rates[payDate.year]`. Past pay runs keep their original year's rates. The
"Tax rates & limits" card (Company → Payroll) surfaces the active year to users.