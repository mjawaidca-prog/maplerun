# MapleRun — Development Session Summary
# June 10–22, 2026

## Live URL
https://app.nexvarlab.com

## What was built

### Tax Engine (137 tests)
- CPP/CPP2/EI/Income Tax — all 13 provinces + territories
- Quebec: QPP (6.30%), QPIP (0.43%), federal abatement (16.5%)
- 2026 Jan + July editions (BC prorated, NL BPA, PE bracket)
- Vacation pay minimums: 14 jurisdictions
- PDOC golden tests: 85 entries

### UI (31 routes, 27 screens)
- Landing page, Sign-in, Onboarding, Dashboard
- Employee list, detail, edit, create
- Payroll history, detail, wizard (3 steps)
- Pay stub (screen + PDF)
- T4 slips + summary
- Remittance report (4 tabs)
- ROE (list + detail)
- GL Journal (debit/credit)
- Payroll Summary
- Direct Deposit (CPA-005 EFT)
- Company settings (3 tabs)
- Help & FAQ
- Timesheet entry + CSV import
- Upgrade modal

### Plan Tiers
- Solo (5 sidebar items, 4 dashboard widgets)
- Growth (12 items, 6 widgets + remittance)
- Accountant (15 items, 8 widgets + compliance panel)
- Free trial: 2 pay runs, blocks after limit
- Promo code MAPLE2026: Accountant + 999 runs
- Plan switcher: instant change on Company Profile

### Employee Management
- Create with: personal, address, employment (salary/hourly + rate), bank details (20 Canadian banks), pay group
- Edit: full form with pre-filled data
- Delete: trash icon with confirmation
- Bank selector: auto-fills institution number

### Payroll
- Per-employee hours + gross + vacation pay
- Vacation pay: flexible % per employee
- SessionStorage persistence
- Finalize warning banner

### Reports
- PD7A remittance: 4 tabs, due 15th of month
- T4: all CRA boxes, printable
- GL Journal: balanced debit/credit entries
- CPA-005 EFT: Canadian standard format

### Stripe
- Live keys configured
- Checkout creates prices on-the-fly
- After payment → plan auto-upgrades

### Resend Email
- Domain verified: nexvarlab.com
- Live key: any email can sign in
- From: payroll@nexvarlab.com

### Infrastructure
- Frontend: Next.js 16 + Tailwind 4 + shadcn/ui
- Database: Neon PostgreSQL (us-east-1)
- Auth: Auth.js v5 (magic link via Resend)
- Hosting: Vercel
- DNS: Cloudflare
- Domain: nexvarlab.com (Namecheap)

## Known issues (not blockers)
- Audit log is placeholder
- Company switcher needs refresh after switch
- Old test data may have orphaned pay runs (delete them)
- EFT needs fresh pay runs with bank details
- Timesheet import CSV parsing works but data isn't auto-saved to DB
