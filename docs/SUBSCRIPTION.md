# MapleRun — Subscription & Billing Guide

## Plans

| | Solo | Growth | Accountant |
|---|---|---|---|
| **Base price** | $15/mo | $25/mo | $59/mo |
| **Per employee** | $3/mo | $3/mo | $2/mo |
| **Companies** | 1 | 1 | Unlimited |
| **Pay runs** | Unlimited | Unlimited | Unlimited |
| **Pay stubs (PDF)** | ✅ | ✅ | ✅ |
| **PD7A remittance** | ✅ | ✅ | ✅ |
| **T4 reporting** | — | ✅ | ✅ |
| **ROE** | — | ✅ | ✅ |
| **Data exports** | — | ✅ (CSV, PDF) | ✅ |
| **Multi-admin** | — | ✅ | ✅ |
| **Priority support** | — | ✅ | ✅ |
| **Bulk pay runs** | — | — | ✅ |
| **Client-ready reports** | — | — | ✅ |

All prices in CAD. 30-day free trial — no credit card required.

---

## How billing works

1. User signs up → 30-day free trial begins
2. During trial: full access to the selected plan
3. Trial ends → Stripe charges the monthly subscription
4. Employee count is auto-detected from active employees

Billing is handled entirely through **Stripe**:
- Secure payment processing (PCI DSS Level 1)
- Customers can update payment methods via Stripe Customer Portal
- Invoices and receipts emailed automatically by Stripe

---

## Setting up Stripe (one-time admin task)

### 1. Create Stripe account
Go to [dashboard.stripe.com](https://dashboard.stripe.com) and sign up. Use **test mode** for development.

### 2. Get API keys
- Developers → API keys → copy **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...`)
- Paste into your `.env` file:
  ```
  STRIPE_SECRET_KEY="sk_test_..."
  NEXT_PUBLIC_STRIPE_KEY="pk_test_..."
  ```

### 3. Create products and prices
In Stripe Dashboard → Products → Add product:

| Product | Price | Billing |
|---------|-------|---------|
| MapleRun Solo | $15.00 CAD | Monthly, flat rate |
| MapleRun Growth | $25.00 CAD | Monthly, flat rate |
| MapleRun Accountant | $59.00 CAD | Monthly, flat rate |

Copy each **Price ID** (`price_...`) to `.env`:
```
STRIPE_PRICE_SOLO="price_..."
STRIPE_PRICE_GROWTH="price_..."
STRIPE_PRICE_ACCOUNTANT="price_..."
```

### 4. Set up webhooks (for local dev)
```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```
Copy the signing secret (`whsec_...`) to `.env`:
```
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### 5. Go live
When ready for real payments, switch to **live mode** in Stripe Dashboard and use live keys.

---

## Managing subscriptions

- **Upgrade/downgrade** — Customer contacts support (self-serve portal coming)
- **Cancel** — Subscription runs to end of billing period, then access is revoked
- **Failed payments** — Stripe retries automatically; past-due accounts are flagged
- **Refunds** — Handled via Stripe Dashboard
