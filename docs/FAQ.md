# MapleRun — Frequently Asked Questions

## General

**Q: What is MapleRun?**
MapleRun is Canadian payroll software for small businesses (1–100 employees). It calculates CRA-compliant payroll deductions, generates pay stubs, and produces remittance and year-end reports.

**Q: How is this different from ADP or QuickBooks Payroll?**
MapleRun is built exclusively for Canada — no US-centric workarounds. It's simpler and cheaper: plans start at $15/mo vs $25–30+ for competitors. It covers all 13 provinces and territories including Quebec (QPP/QPIP).

**Q: Is my data stored in Canada?**
Yes. The database is hosted in Canada (PIPEDA-compliant). For the current dev setup, data is in US East. Production will use Canadian hosting.

---

## Security

**Q: How is SIN data protected?**
Social Insurance Numbers are encrypted at rest using AES-256-GCM. They are never logged, never exposed in API responses without explicit permission, and never accessible to unauthorized users.

**Q: Does MapleRun handle money movement?**
No. v1 calculates and reports only — it does not hold or remit client funds. This means MapleRun stays out of FINTRAC MSB territory. You remit taxes to CRA yourself through your bank.

**Q: Who can see my payroll data?**
Only users you invite to your company workspace. Each user has a role: Owner, Admin, or Viewer. All access is scoped to your company.

---

## Payroll calculations

**Q: Are the tax calculations accurate?**
Yes. The tax engine implements CRA T4127 formulas (121st and 123rd editions for 2026). All 2026 tax tables have been verified against CRA-published constants. Calculations match CRA PDOC within $0.50 tolerance.

**Q: What about Quebec?**
Quebec employees are fully supported: QPP replaces CPP, QPIP premiums are calculated, and the 16.5% federal tax abatement is applied. Quebec provincial tax follows Revenu Québec TP-1015.3 formulas.

**Q: How are bonuses taxed?**
Bonuses use the CRA T4127 bonus method: tax is calculated on the annualized income including the bonus, minus tax on the annualized income without it. CPP on bonuses has no per-period exemption.

**Q: What about vacation pay?**
Vacation pay minimums by province are built into the engine. These are the statutory minimums — you can pay more.

---

## Using MapleRun

**Q: How do I sign in?**
Enter your email — you'll receive a magic link. Click it to sign in. No password needed.

**Q: Can multiple people access the same company?**
Yes on the Growth and Accountant plans. Invite team members with Admin or Viewer roles.

**Q: What if I make a mistake in a pay run?**
Pay runs are immutable once finalized. To fix an error, create an adjustment pay run (negative amounts for the correction). This leaves a clear audit trail.

**Q: Can I export data?**
Yes. Growth and Accountant plans support CSV and PDF exports of payroll journals, pay stubs, and reports.

**Q: Does MapleRun file T4s with CRA?**
MapleRun generates T4 data and XML for CRA Internet File Transfer. You submit it to CRA yourself or through your accountant.

---

## Billing

**Q: Is there a free trial?**
Yes — 30 days, no credit card required. Full access to your chosen plan.

**Q: How do I cancel?**
Contact support. Your subscription runs to the end of the current billing period.

**Q: What payment methods are accepted?**
Credit/debit cards via Stripe. More methods coming.

---

## Troubleshooting

**Q: I didn't receive the magic link email.**
Check your spam folder. Make sure you're using the same email you signed up with. For Resend test mode, emails only deliver to the account owner's email.

**Q: The page keeps redirecting.**
Clear cookies for localhost and try signing in again. If it persists, use a fresh browser session.

**Q: An employee's SIN isn't being accepted.**
SIN must be exactly 9 digits (spaces are stripped automatically). It must pass the Luhn algorithm check.

**Q: Tax calculations don't match my spreadsheet.**
Make sure the pay date selects the right tax table edition (Jan–Jun vs Jul–Dec). Check that TD1 claim amounts match. The engine uses the exact CRA formulas — differences usually come from rounding at different steps.
