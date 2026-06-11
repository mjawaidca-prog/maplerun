# Launch Checklist — MapleRun

> Phase 7 items per docs/BRAND.md. Checked 2026-06-11.

## 1. Trademark (CIPO)

- [ ] **Search CIPO database**: https://ised-isde.canada.ca/cipo/trademark-search/
  - Search for "MapleRun", "Maple Run", and phonetic equivalents
  - Also search alternates: NorthPay, BorealPay, TrueNorth Payroll, LooniePay, Polaris Payroll
  - No results found via web search — but definitive clearance requires manual CIPO search
  - **Estimated cost**: $0 (self-search) or ~$500–1,500 for agent opinion

## 2. Domains

| Domain | Status |
|--------|--------|
| maplerun.ca | ❌ Taken (resolves to 185.158.133.1) |
| maplerun.com | ❌ Taken |
| **getmaplerun.com** | ✅ Available |
| **maplerun.app** | ✅ Available |
| paymaple.com | ❌ Taken |
| maplepay.ca | ❌ Taken |

**Recommendation**: Register `getmaplerun.com` as primary. Optionally grab `maplerun.app`.
- Registrar: Namecheap, Hover, or Google Domains (~$15–20/yr)

## 3. Social handles

- [ ] Twitter/X: @MapleRun / @getmaplerun
- [ ] LinkedIn: /company/maplerun
- [ ] GitHub: /MapleRun (already reserved for code)

*Check availability manually — most platforms don't have public APIs for handle checks.*

## 4. Business registration

- [ ] **Federal incorporation**: $200 via Corporations Canada (canada.ca)
  - Alternative: provincial incorporation in home province (cheaper, simpler for now)
- [ ] **GST/HST registration**: Required once revenue exceeds $30k/quarter. Voluntary earlier is fine.
- [ ] **CRA Business Number**: Comes with incorporation

## 5. Insurance

- [ ] **Errors & Omissions (E&O) + Cyber insurance**: Payroll SaaS standard
  - Brokers: Zensurance, CoverWallet, or traditional broker
  - Estimated: $800–2,000/yr for early-stage SaaS
  - Quote from at least 2 brokers

## 6. Payments / Billing

- [x] Stripe integration code ready
- [ ] Create Stripe account (stripe.com)
- [ ] Create products + prices for Solo/Growth/Accountant plans in Stripe Dashboard
- [ ] Set up webhook endpoint in Stripe Dashboard:
  - URL: `https://<domain>/api/billing/webhook`
  - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

## 7. Hosting / infra

- [x] Neon PostgreSQL (us-east-1, ca-central-1 requested for production)
- [ ] Vercel deployment: connect GitHub repo, set env vars, deploy
- [ ] Custom domain + SSL on Vercel

## 8. Email

- [ ] Resend: verify domain, set up sending
- [ ] AUTH_RESEND_KEY in production env
- [ ] Transactional emails: welcome, pay stub delivery, passwordless login

## 9. Pre-launch review

- [ ] All tax tables verified (2026 ✅)
- [ ] PDOC spot-checks pass (goldens generated, manual verification pending)
- [ ] PDF generation works
- [ ] Stripe checkout flow tested end-to-end
- [ ] Privacy policy + Terms of Service (use a template like Termly or a lawyer)
- [ ] PIPEDA compliance: data residency in Canada (Neon us-east-1 is a temp compromise)

## 10. Go-live

- [ ] Register domain
- [ ] Set up Stripe live keys
- [ ] Deploy to Vercel production
- [ ] Announce on LinkedIn, Product Hunt, BetaList
