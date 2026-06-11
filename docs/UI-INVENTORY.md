# MapleRun — UI Inventory & Design Handoff

> Hand this document + the source files to your designer. Each screen is listed with its file path, purpose, and current component breakdown. Designer: propose changes via screenshots/mockups/Figma — Claude will implement exactly what you design.

---

## Public pages (no login)

### 1. Landing / Home
**URL:** `/`  
**File:** `apps/web/src/app/page.tsx`  
**Purpose:** Marketing page — first thing visitors see

**Sections (top to bottom):**
- Hero — logo "🍁 MapleRun", tagline, 2 CTAs (Try it free / Quick calculator)
- Feature grid (6 cards) — Calculator, FileText, Shield, Zap, TrendingUp, Users icons
- Pricing (3 cards) — Solo $15, Growth $25 (highlighted), Accountant $59
- Testimonials (3 cards) — placeholder avatars + quotes
- Calculator section — PaychequeCalculator component
- Footer — copyright, CRA disclaimer

**Designer notes:** This is the conversion page. Hero gradient goes from background to `maple/5`. Pricing card highlight uses `ring-2 ring-maple`. Testimonials are placeholders.

---

### 2. Sign In
**URL:** `/sign-in`  
**File:** `apps/web/src/app/sign-in/page.tsx`  
**Purpose:** Email magic-link sign-in

**Components:**
- MapleRun logo + "Sign in to your payroll account"
- Card: "Sign in" — email input + "Send magic link" button
- After sending: "Check your email" message + "Use different email" button
- (Hidden) Google OAuth section — only shows if `NEXT_PUBLIC_GOOGLE_ENABLED=true`
- Footer: Terms/Privacy text

**States:** Initial → Loading → Sent → Error  
**Designer notes:** Simple one-field form. The sent state shows a green-tinted info card.

---

### 3. Verify Request
**URL:** `/verify-request`  
**File:** `apps/web/src/app/verify-request/page.tsx`  
**Purpose:** Confirmation after magic link is sent (server-rendered fallback)

---

## Authenticated pages (require login + company)

All pages in this section are wrapped by the app layout:  
**Layout file:** `apps/web/src/app/(app)/layout.tsx`

**Layout structure:**
- Left sidebar (56 cols) — MapleRun logo, 5 nav links (Dashboard/Employees/Payroll/Reports/Company), user footer with sign-out
- Right main area — page content

---

### 4. Dashboard
**URL:** `/app`  
**File:** `apps/web/src/app/(app)/app/page.tsx`  
**Purpose:** Home base after login

**Components:**
- Header: "Dashboard" + welcome message
- Stats cards: Active Employees count, Pay Groups count
- Quick actions: "Add an employee", "Run payroll" — icon + label + description
- Getting started card (only when 0 employees): welcome message + "Add your first employee" link

---

### 5. Onboarding (Company Setup)
**URL:** `/onboarding`  
**File:** `apps/web/src/app/onboarding/page.tsx`  
**API:** `apps/web/src/app/api/onboarding/route.ts`  
**Purpose:** First-time company creation wizard

**Fields:**
- Company name (text)
- URL slug (text, pattern `[a-zA-Z0-9-]+`)
- Default province (dropdown — all 13 provinces)
- Pay frequency (dropdown — Weekly/Biweekly/Semi-monthly/Monthly)
- "Create company" submit button

**States:** Loading → Error → Success (redirects to /app)

---

### 6. Employees — List
**URL:** `/employees`  
**File:** `apps/web/src/app/(app)/employees/page.tsx`  
**Purpose:** Employee directory

**Components:**
- Header: "Employees" + "Add employee" button
- Table/card list: Name, province, YTD ledger summary
- Empty state: "No employees yet" + CTA
- Search/filter: (not yet implemented)

---

### 7. Employees — Add New
**URL:** `/employees/new`  
**File (server):** `apps/web/src/app/(app)/employees/new/page.tsx`  
**File (client):** `apps/web/src/components/employee-form.tsx`  
**Purpose:** Add employee form

**Cards/fields:**
- Personal Information: First name*, Last name*, SIN*, Date of birth, Email, Phone
- Address: Line 1, City, Province dropdown, Postal code
- Payroll Settings: Pay group dropdown, auto-creates TD1 + YTD ledger
- Submit: "Create employee" button (disables on click)

**States:** Normal → Submitting → Error

---

### 8. Employees — Detail/Edit
**URL:** `/employees/[id]`  
**File:** `apps/web/src/app/(app)/employees/[id]/page.tsx`  
**Purpose:** View/edit employee details + TD1

**Designer notes:** Check file for current state. May need edit form design.

---

### 9. Payroll — History
**URL:** `/payroll`  
**File:** `apps/web/src/app/(app)/payroll/page.tsx`  
**Purpose:** Pay run history list

**Components:**
- Header: "Payroll" + "Run payroll" button
- List of past pay runs: pay date, pay group, status badge (DRAFT/FINALIZED), totals
- Empty state: "No pay runs yet"

---

### 10. Payroll — New Pay Run Wizard
**URL:** `/payroll/new`  
**File:** `apps/web/src/app/(app)/payroll/new/page.tsx`  
**File (client):** `apps/web/src/app/(app)/payroll/new/wizard.tsx`  
**Purpose:** 3-step pay run flow

**Step 1 — Input:**
- Pay group dropdown + pay period date picker
- Employee list with $ amount inputs
- "Calculate deductions" button (disabled when pending)

**Step 2 — Preview:**
- Summary card: Gross, CPP, CPP2, EI, Federal/Provincial tax, Net pay, Employer cost
- Per-employee breakdown cards with warning alerts
- "Finalize pay run" + "Back to edit" buttons

**Step 3 — Finalizing:**
- Loading state: "Finalizing pay run…"
- Auto-redirects to payroll history on success

**States:** Input → Preview → Finalizing → Redirect

---

### 11. Payroll — Pay Run Detail
**URL:** `/payroll/[id]`  
**File:** `apps/web/src/app/(app)/payroll/[id]/page.tsx`  
**Purpose:** View finalized pay run with employee breakdown

**Components:**
- Header: Pay date, pay group, status badge
- Totals card: Gross, deductions, net, employer cost
- Employee list: click to view individual pay stub

---

### 12. Pay Stub (Individual Employee)
**URL:** `/payroll/[id]/stub/[itemId]`  
**File:** `apps/web/src/app/(app)/payroll/[id]/stub/[itemId]/page.tsx`  
**PDF API:** `apps/web/src/app/(app)/payroll/[id]/stub/[itemId]/pdf/route.tsx`  
**PDF Template:** `apps/web/src/lib/pdf/pay-stub.tsx`  
**Purpose:** Printable employee pay stub → **HIGH PRIORITY for design polish**

**Sections (top to bottom):**
- Header: Maple logo + company name + "PAY STUB" label, employee name, pay period, frequency
- Earnings column: Gross pay (green tinted card)
- Deductions column: CPP, CPP2, EI, Federal tax, Provincial tax, Total deductions
- Net pay hero: large red text on gradient background
- Employer Costs: CPP match, CPP2, EI (1.4×), Total
- YTD section (2026): Pensionable, Insurable, CPP, EI, CPP2
- Warning section (amber, only if engine warnings)
- Footer: "Generated by MapleRun" + CRA disclaimer

**Designer notes:** This is THE most important page for polish. It gets printed, downloaded as PDF, and emailed to employees. It's the product's physical manifestation. Make it look professional — think bank statement quality.

---

### 13. Reports — Dashboard
**URL:** `/reports`  
**File:** `apps/web/src/app/(app)/reports/page.tsx`  
**Purpose:** Reports index

**Components:**
- Page header: "Reports"
- 4 cards: T4 Slips, PD7A Remittance (with YTD total), ROE, Payroll Journal
- Each card has icon + title + description + link

---

### 14. T4 Report — Summary
**URL:** `/reports/t4`  
**File:** `apps/web/src/app/(app)/reports/t4/page.tsx`  
**Purpose:** Annual T4 summary — all employees

**Components:**
- Header with back arrow
- Employee list: name, income, CPP, EI, tax, pay periods — click to see detail
- T4 Summary card: company name, totals for all boxes
- CRA filing note

---

### 15. T4 Slip — Individual
**URL:** `/reports/t4/[employeeId]`  
**File:** `apps/web/src/app/(app)/reports/t4/[employeeId]/page.tsx`  
**Purpose:** Printable T4 slip — **HIGH PRIORITY for CRA compliance look**

**Sections:**
- Header: "Statement of Remuneration Paid — T4 — 2026", employer name
- Employee info: name, province
- 8 T4 boxes (2×4 grid): 14 (income), 22 (tax), 16 (CPP), 16A (CPP2), 18 (EI), 24 (EI earnings), 26 (pensionable), 28 (exempt)
- Footer: filing deadline, CRA disclaimer

---

### 16. ROE — List
**URL:** `/reports/roe`  
**File:** `apps/web/src/app/(app)/reports/roe/page.tsx`  

### 17. ROE — Detail
**URL:** `/reports/roe/[id]`  
**File:** `apps/web/src/app/(app)/reports/roe/[id]/page.tsx`  

---

### 18. Company Settings
**URL:** `/company`  
**File:** `apps/web/src/app/(app)/company/page.tsx`  
**Purpose:** Company profile/settings

---

## Shared Components

All in `apps/web/src/components/ui/` — shadcn/ui v4 (Base UI primitives):
- `button.tsx` — 6 variants (default, outline, secondary, ghost, destructive, link) + 5 sizes
- `input.tsx` — text/number/date/email inputs
- `select.tsx` — dropdown with SelectTrigger/SelectContent/SelectItem
- `card.tsx` — Card/CardHeader/CardTitle/CardDescription/CardContent
- `badge.tsx` — inline badge/chip
- `separator.tsx` — horizontal divider
- `label.tsx` — form label

**Custom components:**
- `components/paycheque-calculator.tsx` — embedded tax calculator (landing page)
- `components/employee-form.tsx` — new employee form (client-side)
- `components/providers.tsx` — Auth.js SessionProvider wrapper

---

## Design Tokens

From `apps/web/src/app/globals.css`:

```css
/* Brand accent */
--maple: #B3261E          /* Deep maple red */
--maple-foreground: #FFFFFF

/* Dark mode */
--maple: #E56A5C          /* Lighter red for dark bg */
--maple-foreground: #1A0A08

/* Base palette */
--background: white (light) / stone-950 (dark)
--foreground: stone-900 / stone-50
--muted: stone-100 / stone-800
--border: stone-200 / stone-800
--primary: stone-900 / stone-50
```

**Typography:** Inter (UI), Geist Mono (tabular numbers). Money always right-aligned with `tabular-nums`.

---

## Design Handoff Checklist

For each page, the designer should provide:
- [ ] Desktop mockup (1440px wide)
- [ ] Mobile mockup (375px wide) — if layout changes significantly
- [ ] Dark mode variant (if different from auto-inverted)
- [ ] Print layout (for pay stub, T4 slip)
- [ ] Empty state design
- [ ] Error state design
- [ ] Loading state design

**Priority pages for design polish:**
1. 🥇 Pay Stub (employee-facing, gets printed/emailed)
2. 🥇 T4 Slip (CRA-facing, needs compliance look)
3. 🥈 Landing page (conversion)
4. 🥈 Pay Run Wizard (core workflow)
5. 🥉 Reports Dashboard
6. 🥉 Employee List

---

## How this works

1. **Designer** creates mockups/Figma designs for the pages above
2. **You** review and approve the designs
3. **Claude** reads the mockups and implements them exactly — matching colors, spacing, typography, layout
4. If the designer provides a Figma link, Claude can extract specs from it
5. If the designer provides screenshots, Claude matches them pixel-by-pixel

**Important:** Claude doesn't do creative design. But Claude can implement ANY design with extreme fidelity. The designer provides the vision; Claude codes it.
