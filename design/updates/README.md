# Handoff: MapleRun — Remittance Report

## Overview
The Remittance Report is a compliance screen inside MapleRun payroll. It shows a Canadian employer their CRA payroll deductions for a given period — CPP, EI, and income tax — split by employee and employer shares. It drives the "Submit to CRA" workflow and provides an audit trail via remittance history.

## About the Design Files
`MapleRun Remittance Report.html` is a **high-fidelity HTML prototype** — a pixel-accurate reference showing final colors, typography, layout, interactions, and copy. It is NOT production code. Recreate it in the target stack (React + existing component library, or equivalent) following established codebase patterns. Do not ship the HTML directly.

## Fidelity
**High-fidelity.** Recreate pixel-accurately: exact hex colors, spacing, font sizes, weights, component shapes, and interaction states are all final.

---

## Layout Architecture

```
<body> — flex row, full viewport height, background #f5f5f4
  <aside.sidebar>       220px fixed, sticky, full height, bg #1c1917
  <main.main>           flex: 1, padding 34px 44px 80px
```

### Sidebar — 220px, bg `#1c1917`
- Logo row: maple leaf emoji 22px + "MapleRun" text 17px/800w white
- Nav items: 13.5px/500w, padding 9px 12px, border-radius 9px, color `#a8a29e`
  - Hover: bg `#292524`, color `#e7e5e4`
  - Active: bg `#3f1413`, color `#fff`
- Section labels: 10px/700w, uppercase, letter-spacing .08em, color `#57534e`
- Footer: plan badge (`#292524` bg, green dot `#16a34a`), user avatar (30px circle, gradient `#B3261E → #e56a5c`)

### Main content — 34px 44px padding
Stack (top to bottom):
1. Breadcrumb
2. Page header row (title + export buttons)
3. Alert banner (conditional)
4. Filter bar
5. Summary cards (4-col grid)
6. Account info strip
7. Tab bar
8. Active tab panel

---

## Components

### 1. Breadcrumb
```
font-size: 13px, color: #a8a29e
"Compliance › Remittances"
```

### 2. Page Header
- Title: 26px / 800w / letter-spacing -.02em / `#1c1917`
- Subtitle: 14px / `#78716c`
- Right side buttons: PDF ⬇︎, CSV ⬇︎, Print 🖨, **Submit to CRA** (primary)

#### Button styles
| Variant | bg | color | border | radius | padding |
|---|---|---|---|---|---|
| Outline | `#fff` | `#1c1917` | 1px `#d6d3d1` | 9px | 9px 15px |
| Outline hover | `#fff` | `#B3261E` | 1px `#B3261E` | — | — |
| Primary | `#B3261E` | `#fff` | none | 9px | 9px 16px |
| Primary hover | `#9b1c18` | — | — | — | — |
All buttons: 13px / 600w / font Inter / inline-flex / gap 7px

### 3. Alert Banner (conditional — show when remittance is unpaid and due ≤ 14 days)
```
bg: #fef2f2, border: 1px #fecaca, border-radius: 11px, padding: 14px 18px
flex row, gap 12px
```
- Icon: ⚠️ 18px, flex-shrink 0
- Title: 13.5px / 700w / `#991b1b`
- Body text: 12.5px / `#b91c1c` / line-height 1.5
- Right: small "Review & Submit" primary button (12px / 7px 13px padding)
- Content: "Remittance due in {N} days — {Date}" + amount + business number

### 4. Filter Bar
```
bg: #fff, border: 1px #e7e5e4, border-radius: 12px, padding: 14px 18px
flex row, gap 14px, flex-wrap, shadow: 0 1px 3px rgba(0,0,0,.04)
```
Three filter groups (label + control):
- **Period** — segmented control: "Current month | Jan 2026 | Q4 2025 | Year to date | Custom"
- **Remittance type** — `<select>`: All types / CRA Federal / Provincial – ON / Workers' Comp
- **Pay group** — `<select>`: All staff (Biweekly) / Office / Field crew
- Apply button (outline style)

#### Segmented control
```
bg: #f5f5f4, border: 1px #e7e5e4, border-radius: 9px, padding: 3px, inline-flex, gap: 2px
Button: 12px/600w, color #78716c, padding 6px 11px, radius 6px
Active button: bg #fff, color #1c1917, shadow 0 1px 2px rgba(0,0,0,.08)
```

### 5. Summary Cards — 4-column grid, gap 14px
```
Each card: bg #fff, border: 1px #e7e5e4, border-radius: 14px, padding: 20px 22px
shadow: 0 1px 3px rgba(0,0,0,.04)
```
First card is **dark highlighted**: bg `#1c1917`, border same

| Card | Label | Value | Subtext |
|---|---|---|---|
| Total owing (dark) | "Total owing to CRA" | `$15,126.32` | "January 2026 · 14 employees" + due chip |
| CPP | "CPP contributions" | `$6,149.28` | "Employee $3,074.64 + Employer $3,074.64" |
| EI | "EI premiums" | `$2,083.84` | "Employee $867.24 + Employer $1,216.60" |
| Tax | "Income tax withheld" | `$6,893.20` | "Federal $5,293.20 + Provincial $1,600.00" |

- Label: 11px / 700w / uppercase / letter-spacing .06em / `#a8a29e`
- Value: 28px / 800w / letter-spacing -.02em / monospace font
- Sub: 12px / `#78716c`
- Due chip on first card: `bg #fef2f2, color #B3261E` / "Due Feb 15, 2026 · 7 days" / 11px / 700w / radius 20px / padding 4px 10px

### 6. Account Info Strip
```
bg: #fff, border: 1px #e7e5e4, border-radius: 12px, overflow hidden
flex row — 6 equal cells, each with right border (last none)
Each cell: padding 14px 20px
Label: 10.5px / 700w / uppercase / #a8a29e
Value: 13.5px / 600w / #1c1917
```

| Cell | Label | Value |
|---|---|---|
| 1 | Business number | `123456789 RP 0001` (monospace) |
| 2 | Remitter type | Regular remitter |
| 3 | Pay period | Jan 1 – Jan 31, 2026 |
| 4 | Pay runs included | 2 (Jan 10 & Jan 24) |
| 5 | Filing status | Status chip: amber "Pending review" |
| 6 | Prior month status | Status chip: green "Submitted Dec 15" |

#### Status chips
```
display: inline-flex, align-items: center, gap: 5px
font-size: 11px, font-weight: 700, letter-spacing: .04em
padding: 3px 10px, border-radius: 20px
```
| Variant | bg | color | border |
|---|---|---|---|
| Green | `#f0fdf4` | `#16a34a` | `#bbf7d0` |
| Amber | `#fffbeb` | `#d97706` | `#fde68a` |
| Red | `#fef2f2` | `#B3261E` | `#fecaca` |
| Blue | `#eff6ff` | `#2563eb` | `#bfdbfe` |
| Stone | `#f5f5f4` | `#78716c` | `#e7e5e4` |

### 7. Tab Bar
```
display: flex, gap: 2px, bg: #f5f5f4, border: 1px #e7e5e4
border-radius: 10px, padding: 3px, width: fit-content
```
Tabs: "Deduction breakdown | By employee | Remittance history | Schedule & rates"
- Inactive: 13px / 600w / `#78716c`
- Active: bg `#fff`, color `#1c1917`, shadow `0 1px 3px rgba(0,0,0,.08)`, radius 7px, padding 7px 15px

---

## Tab Panels

### Panel A — Deduction Breakdown

Section title: 13px / 700w / `#78716c` / uppercase / letter-spacing .06em

#### Table
```
bg: #fff, border: 1px #e7e5e4, border-radius: 14px, overflow hidden
Thead: bg #fafaf9, 11px/700w/#78716c, uppercase, padding 11px 16px
Tbody row: padding 13px 16px, 13px, border-bottom 1px #f0efed
Tbody row hover: bg #fafaf9
Tfoot: bg #1c1917, color #fff, 13px/700w
Row group header (category): bg #fafaf9, 11px/700w/#a8a29e, uppercase, letter-spacing .06em
```

Columns: Component | Description | Rate/basis | Employee share | Employer share | Total | % of remittance

Rows (grouped):
**CPP group**
1. CPP Employee — 5.95% — `$3,074.64` ee / — er / `$3,074.64` total / 20.3%
2. CPP Employer — 5.95% — — ee / `$3,074.64` er / `$3,074.64` total / 20.3%

**EI group**
3. EI Employee — 1.66% — `$867.24` ee / — er / `$867.24` total / 5.7%
4. EI Employer — 2.324% — — ee / `$1,216.60` er / `$1,216.60` total / 8.1%

**Income Tax group**
5. Federal income tax — Varies — `$5,293.20` ee / — er / `$5,293.20` total / 35.0%
6. Provincial income tax — Varies — `$1,600.00` ee / — er / `$1,600.00` total / 10.6%

**Tfoot total row:**
"Total remittance to CRA — January 2026" | — | `$10,835.08` | `$4,291.24` | `$15,126.32` | —

#### Category dot colors
| Row | Dot color |
|---|---|
| CPP Employee | `#B3261E` |
| CPP Employer | `#e56a5c` |
| EI Employee | `#2563eb` |
| EI Employer | `#60a5fa` |
| Federal tax | `#16a34a` |
| Provincial tax | `#4ade80` |

#### % bar
```
Inline bar: width 120px container, bg #f0efed, height 6px, radius 4px
Fill: bar-fill div with matching dot color, width = percentage of column max
```

#### Footnote (bottom of panel)
```
bg: #eff6ff, border: 1px #bfdbfe, border-radius: 10px, padding: 13px 16px
flex row, gap 11px, 12.5px/#1e40af, line-height 1.5
```
Content: "💡 How the CRA remittance is calculated. CPP = (employee CPP withheld) × 2 (employer matches 1:1). EI = (employee EI withheld) + (employee EI × 1.4). Income tax = federal + provincial withheld. All three are remitted together to CRA by the 15th of the following month for regular remitters."

---

### Panel B — By Employee

Same table shell. Columns: Employee | Gross pay | CPP (ee) | CPP (er) | EI (ee) | EI (er) | Fed. tax | Prov. tax | Total CRA

#### Employee cell
```
flex row, gap 10px
Avatar: 30px circle, initials, gradient varies by employee
Name: 13px/600w
Sub: 11px/#a8a29e (department · pay type)
```

Avatar gradient variants:
| Color | Gradient |
|---|---|
| Default (red) | `#B3261E → #e56a5c` |
| Blue | `#1d4ed8 → #60a5fa` |
| Green | `#15803d → #4ade80` |
| Amber | `#b45309 → #fbbf24` |
| Violet | `#6d28d9 → #a78bfa` |

**Total CRA column**: 700w, color `#B3261E`

Sample employees (7 shown, "+7 more" row at bottom):
| Name | Dept | Gross | CPP ee | EI ee | Fed tax | Prov tax |
|---|---|---|---|---|---|---|
| Sarah Tremblay | Office · Salaried | $5,769.24 | $332.72 | $93.86 | $572.82 | $156.20 |
| David Chen | Field crew · Hourly | $6,200.00 | $357.68 | $100.88 | $625.80 | $190.40 |
| Amara Okonkwo | Field crew · Hourly | $5,800.00 | $334.48 | $94.34 | $577.80 | $171.20 |
| Liam Gauthier | Office · Salaried | $4,615.38 | $266.16 | $75.08 | $412.40 | $118.40 |
| Priya Sharma | Office · Salaried | $5,000.00 | $288.40 | $81.34 | $461.20 | $132.80 |
| Daniel Okafor | Field crew · Hourly | $4,920.00 | $283.76 | $80.04 | $448.60 | $129.00 |
| Emma Bouchard | Office · Salaried | $4,038.46 | $232.92 | $65.70 | $342.60 | $98.60 |

CPP (er) = CPP (ee) (employer matches 1:1)
EI (er) = EI (ee) × 1.4
Total CRA = (CPP ee × 2) + (EI ee × 2.4) + fed tax + prov tax

Footer totals row (dark bg): 14 employees | $53,307.72 gross | $3,074.64 | $3,074.64 | $867.24 | $1,216.60 | $5,293.20 | $1,600.00 | $15,126.32

---

### Panel C — Remittance History

Columns: Period | Due date | Submitted | CPP total | EI total | Tax withheld | Total remitted | Status | Reference

Status chips: same chip system as above (green = Submitted, amber = Pending, red = Late)

History data (8 months):
| Period | Due | Submitted | CPP | EI | Tax | Total | Status | Ref |
|---|---|---|---|---|---|---|---|---|
| Jan 2026 | Feb 15, 2026 | Pending | $6,149.28 | $2,083.84 | $6,893.20 | $15,126.32 | amber | — |
| Dec 2025 | Jan 15, 2026 | Jan 14, 2026 | $6,002.40 | $2,034.80 | $6,765.28 | $14,802.48 | green | CRA-2026-00412 |
| Nov 2025 | Dec 15, 2025 | Dec 12, 2025 | $5,980.16 | $2,026.30 | $6,711.04 | $14,717.50 | green | CRA-2025-09887 |
| Oct 2025 | Nov 15, 2025 | Nov 14, 2025 | $5,960.00 | $2,019.20 | $6,692.40 | $14,671.60 | green | CRA-2025-09201 |
| Sep 2025 | Oct 15, 2025 | Oct 17, 2025 | $5,810.20 | $1,967.80 | $6,530.80 | $14,308.80 | red (Late) | CRA-2025-08564 |
| Aug 2025 | Sep 15, 2025 | Sep 13, 2025 | $5,640.00 | $1,909.80 | $6,312.40 | $13,862.20 | green | CRA-2025-07912 |
| Jul 2025 | Aug 15, 2025 | Aug 14, 2025 | $5,510.40 | $1,866.00 | $6,152.60 | $13,529.00 | green | CRA-2025-07243 |
| Jun 2025 | Jul 15, 2025 | Jul 14, 2025 | $5,490.20 | $1,859.20 | $6,104.40 | $13,453.80 | green | CRA-2025-06580 |

---

### Panel D — Schedule & Rates

Two-column grid, gap 20px.

#### Left: Upcoming schedule card
```
bg: #fff, border: 1px #e7e5e4, border-radius: 14px, overflow hidden
```
Each row: flex, gap 14px, padding 14px 18px, border-bottom 1px #f0efed, hover bg #fafaf9

Date block (46×46px, radius 10px):
- Default: bg `#f5f5f4`, border `#e7e5e4`
- Urgent (upcoming): bg `#fef2f2`, border `#fecaca`, text `#B3261E`
- Past (submitted): bg `#f0fdf4`, border `#bbf7d0`, day number `#16a34a`

Month label: 9px / 700w / uppercase / `#a8a29e`
Day number: 18px / 800w / letter-spacing -.02em

Schedule entries:
| Date | Type | Title | Subtext | Amount |
|---|---|---|---|---|
| Feb 15 (urgent) | Upcoming | January 2026 remittance | CRA · Regular remitter · 7 days remaining | $15,126.32 (red) |
| Mar 15 | Upcoming | February 2026 remittance | CRA · Regular remitter · Estimated | ~$15,200 (muted) |
| Apr 15 | Upcoming | March 2026 remittance | CRA · Regular remitter · Estimated | ~$15,200 (muted) |
| Apr 30 | Upcoming | T4 summary & T4 slips deadline | CRA annual filing · Employer copy due | "Filing" (muted) |
| Jan 15 (past) | Past | December 2025 remittance | CRA · Submitted Jan 14, 2026 | $14,802.48 (green) |

#### Right: 2026 statutory rates card
```
bg: #fff, border: 1px #e7e5e4, border-radius: 14px, padding: 20px
Each row: flex, gap 12px, padding 10px 0, border-bottom 1px #f0efed
```
Icon: 36×36px rounded square (radius 9px) with emoji

| Rate | Icon bg | Name | Description | Value |
|---|---|---|---|---|
| CPP employee | `#fef2f2` | CPP employee rate | Pensionable earnings above $3,500/yr basic exemption. Max $68,500. | 5.95% |
| CPP2 | `#fef2f2` | CPP2 additional | Earnings between $68,500–$73,200. Higher earners only. | 4.00% |
| EI employee | `#eff6ff` | EI employee premium | Insurable earnings up to max annual $65,700. | 1.66% |
| EI employer | `#eff6ff` | EI employer multiplier | 1.4× employee premium. Reduced rate with wage-loss plan. | ×1.4 |
| Remitter type | `#f0fdf4` | Remitter type threshold | Regular: avg monthly $1,000–$24,999. Due 15th of following month. | 15th |

Rate value: 13px / 700w / monospace
Rate label: 11px / `#a8a29e`

---

## Interactions & Behavior

### Tab switching
- Click tab → deactivate all tabs, activate clicked → hide all panels, show matching panel
- No animation required (instant show/hide)
- Default active: "Deduction breakdown"

### Period segmented control
- Click button → deactivate all, activate clicked
- When "Custom" selected: show date range pickers (fromDate, toDate)

### Filter apply
- "Apply" button triggers data reload for selected period + type + pay group

### Submit to CRA button
- Opens confirmation modal:
  - Amount: $15,126.32
  - Business number
  - Period
  - Confirm / Cancel buttons
  - On confirm: transitions filing status chip from amber "Pending review" → blue "Submitting…" → green "Submitted"
  - Dismisses alert banner
  - Adds history row with today's date and reference number

### Alert banner
- Show if: current period status is not "Submitted" AND due date is within 14 days
- "Review & Submit" button = same action as header "Submit to CRA"
- Dismissable (× button optional)

### Table row hover
- `background: #fafaf9` on hover (tbody rows only)

### Export buttons (PDF / CSV / Print)
- PDF: trigger print-to-PDF via `window.print()` or server-rendered PDF endpoint
- CSV: generate and download CSV of the active panel's table data
- Print: `window.print()`

---

## State Management

```
interface RemittanceState {
  period: 'current' | 'jan2026' | 'q4_2025' | 'ytd' | 'custom'
  customFrom: Date | null
  customTo: Date | null
  remittanceType: 'all' | 'cra_federal' | 'provincial_on' | 'workers_comp'
  payGroup: 'all' | 'office' | 'field'
  activeTab: 'breakdown' | 'employees' | 'history' | 'schedule'
  remittances: RemittanceRecord[]         // from API
  employees: EmployeeDeduction[]          // from API
  filingStatus: 'pending' | 'submitted' | 'submitting' | 'late'
  submissionModalOpen: boolean
}
```

Data fetching triggers:
- On mount: load current period data
- On period/type/payGroup change + Apply: reload remittances + employees
- On submit confirm: POST to `/api/remittances/{period}/submit`, refetch

---

## Design Tokens

### Colors
```
--brand:          #B3261E   (MapleRun red — primary)
--brand-dark:     #9b1c18   (hover state)
--brand-light:    #e56a5c   (avatar gradient end)
--bg:             #f5f5f4   (page background)
--surface:        #ffffff
--surface-raised: #fafaf9
--border:         #e7e5e4
--border-subtle:  #f0efed
--ink:            #1c1917   (primary text, sidebar bg)
--ink-2:          #292524
--ink-3:          #57534e
--ink-muted:      #78716c
--ink-faint:      #a8a29e
```

### Typography
```
--font-sans: Inter, system-ui, sans-serif
--font-mono: 'Geist Mono', monospace  (all numeric values, codes, references)
```

### Numeric sizes used
| Role | Size | Weight |
|---|---|---|
| Page title | 26px | 800 |
| Card value | 28px | 800 |
| Section label | 13px | 700 |
| Body | 13–13.5px | 400–600 |
| Small label | 11–12px | 600–700 |
| Micro label | 10–10.5px | 700 |

### Spacing / Radius
```
radius-sm:  8–9px   (inputs, small buttons)
radius-md:  10–12px (filter bar, tab bar, strip)
radius-lg:  14px    (cards, tables)
radius-full: 20px   (chips, badges)
```

### Shadows
```
card:  0 1px 3px rgba(0,0,0,.04)
btn:   0 1px 2px rgba(0,0,0,.08)
```

---

## Business Logic Notes

- **CPP employer = CPP employee** (1:1 match, same rate 5.95%)
- **EI employer = EI employee × 1.4**
- **Total CRA = (CPP_ee × 2) + (EI_ee × 2.4) + federal_tax + provincial_tax**
- **Regular remitter**: average monthly withholding $1,000–$24,999. Due 15th of the following month.
- **CPP max 2026**: $68,500 annual pensionable earnings. Basic exemption $3,500.
- **CPP2 tier 2026**: $68,500–$73,200 at 4.00%
- **EI max 2026**: $65,700 annual insurable earnings. Employee rate 1.66%.
- Province is Ontario (ON). Provincial tax is remitted to CRA on province's behalf.
- Business number format: `XXXXXXXXX RP XXXX`

---

## Assets
No external images. All icons are emoji or CSS-drawn shapes. Font imports:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## Files in This Package
| File | Purpose |
|---|---|
| `README.md` | This document — full design + functionality spec |
| `MapleRun Remittance Report.html` | Hi-fi HTML prototype — visual + interaction reference |
