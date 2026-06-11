# MapleRun — User Guide

## Getting started

### 1. Sign up
Go to the sign-in page and enter your email. You'll receive a magic link — click it to sign in. No password needed.

### 2. Create your company
On first sign-in, you'll be asked to set up your company:
- **Company name** — Your business name as it appears on pay stubs
- **URL slug** — Short identifier for your workspace (e.g. `acme`)
- **Default province** — Where most employees work (affects default tax calculations)
- **Pay frequency** — Weekly, biweekly, semi-monthly, or monthly

### 3. Add employees
Go to **Employees → Add employee** and fill in:
- **First name / Last name** — Required
- **SIN** — Social Insurance Number (9 digits). Encrypted at rest with AES-256-GCM.
- **Date of birth, email, phone, address** — Optional
- **Pay group** — Assign to your default pay group

A 2026 TD1 profile and YTD ledger are created automatically for each employee.

### 4. Run payroll
Go to **Payroll → Run payroll**:
1. Select a **pay group**
2. Choose the **pay period end date**
3. Enter **gross pay** for each employee
4. Click **Calculate deductions** to preview
5. Review CPP, EI, federal/provincial tax, net pay
6. Click **Finalize pay run** — this is permanent (immutable)

### 5. Pay stubs
After finalizing, each employee gets a pay stub:
- **View** — Click any employee in the pay run detail
- **Print** — Browser print (print-optimized layout)
- **PDF** — Download as PDF file

### 6. Reports
- **PD7A Remittance** — Monthly/quarterly summary of CPP, EI, and tax withheld
- **ROE (Record of Employment)** — Generate when an employee leaves

---

## Understanding your pay stub

| Section | What it means |
|---------|--------------|
| **Gross pay** | Total pay before deductions |
| **CPP / QPP** | Canada/Quebec Pension Plan contribution |
| **CPP2** | Second additional CPP contribution (earnings above $74,600) |
| **EI** | Employment Insurance premium |
| **Federal tax** | Federal income tax withheld |
| **Provincial tax** | Provincial/territorial income tax withheld |
| **Net pay** | Take-home pay after all deductions |
| **YTD** | Year-to-date totals for the current tax year |

---

## Tax years and updates

MapleRun uses CRA T4127 formulas. Tax tables are updated:
- **January** — New tax year rates and brackets
- **July** — Mid-year changes (e.g. BC rate changes, new brackets)

The engine automatically selects the correct edition based on the pay date.

---

## Supported provinces

All 13 provinces and territories: AB, BC, MB, NB, NL, NS, NT, NU, ON, PE, QC, SK, YT.

Quebec employees use QPP (instead of CPP), QPIP premiums, and the 16.5% federal tax abatement — all handled automatically.
