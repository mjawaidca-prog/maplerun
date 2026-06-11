# MapleRun — Quick Start & Launch Checklist

## What works NOW (fully functional)

- [x] Sign in with magic link email (Resend)
- [x] Company creation + onboarding
- [x] Employee management with SIN encryption
- [x] Pay runs with CRA T4127 tax calculations
- [x] Pay stubs (view + print + PDF download)
- [x] PD7A remittance reports
- [x] ROE generation
- [x] Landing page with pricing and calculator
- [x] Stripe billing code (needs API keys)

## Step-by-step launch flow

### Step 1: Stripe (billing)
```
Go to: https://dashboard.stripe.com
1. Create account → test mode
2. Settings → API keys → copy sk_test_ and pk_test_
3. Products → Add:
   - "MapleRun Solo" $15/mo
   - "MapleRun Growth" $25/mo  
   - "MapleRun Accountant" $59/mo
4. Copy each price ID
5. Paste into apps/web/.env
```

### Step 2: Domain
```
Register: getmaplerun.com (Namecheap, Hover, etc. ~$15/yr)
Optional: maplerun.app
```

### Step 3: Resend (email)
```
Go to: https://resend.com
1. Settings → Domains → Add getmaplerun.com
2. Add DNS records (Resend provides them)
3. Update AUTH_RESEND_FROM in .env to "noreply@getmaplerun.com"
```

### Step 4: Deploy
```
1. Push MapleRun/ to GitHub
2. Import into Vercel (vercel.com)
3. Add all env vars from .env
4. Deploy → getmaplerun.com is live
```

### Step 5: Pre-launch
- [ ] Test sign-up flow end-to-end
- [ ] Test pay run with 2-3 employees
- [ ] Test Stripe checkout in test mode
- [ ] CIPO trademark search for "MapleRun"
- [ ] Privacy policy + Terms of Service
- [ ] E&O + cyber insurance quote

### Step 6: Go live
- [ ] Switch Stripe to live mode
- [ ] Switch Neon to ca-central-1 (production database)
- [ ] Announce on LinkedIn, Product Hunt, BetaList

---

## Environment variables checklist

```
DATABASE_URL          ✅ Set (Neon)
AUTH_SECRET           ✅ Set
AUTH_RESEND_KEY        ✅ Set (re_...)
AUTH_RESEND_FROM       ✅ Set (onboarding@resend.dev)
AUTH_GOOGLE_ID         ⬜ Optional
AUTH_GOOGLE_SECRET     ⬜ Optional
STRIPE_SECRET_KEY      ⬜ NEEDED (sk_test_...)
STRIPE_WEBHOOK_SECRET  ⬜ NEEDED (whsec_...)
STRIPE_PRICE_SOLO      ⬜ NEEDED (price_...)
STRIPE_PRICE_GROWTH    ⬜ NEEDED (price_...)
STRIPE_PRICE_ACCOUNTANT⬜ NEEDED (price_...)
NEXT_PUBLIC_STRIPE_KEY ⬜ NEEDED (pk_test_...)
ENCRYPTION_KEY         ✅ Set
NEXT_PUBLIC_APP_URL    ✅ localhost (set to domain in prod)
```

---

## Support & docs

| Document | What it covers |
|----------|---------------|
| [USER-GUIDE.md](USER-GUIDE.md) | How to use MapleRun day-to-day |
| [SUBSCRIPTION.md](SUBSCRIPTION.md) | Plans, pricing, Stripe setup |
| [FAQ.md](FAQ.md) | Common questions and troubleshooting |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technical architecture decisions |
| [TAX-COMPLIANCE.md](TAX-COMPLIANCE.md) | Tax data sources and verification |
| [BRAND.md](BRAND.md) | Brand, design, pricing draft |
| [ROADMAP.md](ROADMAP.md) | Full development roadmap |
| [STATE.md](STATE.md) | Current development state |
