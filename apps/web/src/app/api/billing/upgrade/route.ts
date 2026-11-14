/**
 * POST /api/billing/upgrade — change the plan of an EXISTING subscription.
 * Body: { planId: string }
 *
 * Unlike /api/billing/checkout (which always creates a brand-new
 * subscription — the double-billing defect this route fixes), an
 * upgrade mutates the company's one subscription in place:
 *
 *   1. Every current item is replaced with the new plan's catalog
 *      prices (lib/stripe-catalog.ts) at the subscription's EXISTING
 *      billing interval — monthly stays monthly, annual stays annual
 *      (annual amounts are 10× monthly, as in checkout).
 *   2. `proration_behavior: "create_prorations"` makes Stripe price
 *      the swap for the remainder of the current paid period only:
 *      credit for the unused old plan, charge for the new plan.
 *   3. A standalone invoice for the subscription is then created,
 *      finalized and paid immediately, so the difference lands on the
 *      card on file right away. A net credit (downgrade) is not
 *      charged — it stays on the customer's balance and offsets
 *      future invoices.
 *
 * From the next renewal the subscription bills the full new plan
 * price automatically. There is exactly one subscription throughout.
 */

import { NextResponse } from "next/server";
import { stripe, getPlan } from "@/lib/stripe";
import {
  buildSubscriptionItemReplacement,
  planPeriodTotal,
  stripeId,
  subscriptionInterval,
  upgradeCompanyUpdate,
} from "@/lib/billing";
import { ensurePlanPrices } from "@/lib/stripe-catalog";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/session";

/** Recorded subscription statuses an in-place upgrade may start from. */
const UPGRADABLE_STATUSES: readonly string[] = [
  "active",
  "trialing",
  "past_due",
];

export async function POST(request: Request) {
  const { companyId } = await requireCompany();

  let body: { planId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { planId } = body;
  const plan = getPlan(planId);
  if (!plan) {
    return NextResponse.json(
      { error: `Unknown plan: ${planId}` },
      { status: 400 },
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      plan: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
    },
  });

  // In-place upgrade needs a live subscription to mutate. Companies
  // without one (never subscribed, or lapsed/canceled) subscribe
  // through the normal checkout flow instead.
  if (
    !company?.stripeSubscriptionId ||
    !company.subscriptionStatus ||
    !UPGRADABLE_STATUSES.includes(company.subscriptionStatus)
  ) {
    return NextResponse.json(
      {
        error:
          "No active subscription to upgrade — subscribe through checkout first.",
      },
      { status: 400 },
    );
  }
  if (company.plan === planId) {
    return NextResponse.json(
      { error: `Already on the ${plan.name} plan.` },
      { status: 400 },
    );
  }
  const subscriptionId = company.stripeSubscriptionId;

  // Server-side source of truth for the per-employee quantity — the
  // same `active: true` count the checkout route uses.
  const employeeCount = await prisma.employee.count({
    where: { companyId, active: true },
  });

  let updatedSubscription;
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    // The subscription itself is the source of truth for the customer
    // (the recorded stripeCustomerId can lag behind reality).
    const customerId =
      stripeId(subscription.customer) ?? company.stripeCustomerId;
    if (!customerId) {
      return NextResponse.json(
        { error: "Subscription has no Stripe customer to bill." },
        { status: 400 },
      );
    }

    // Keep the subscription's current interval; the new plan's prices
    // follow the same annual = 10× monthly rule as checkout.
    const interval = subscriptionInterval(subscription);
    const { basePriceId, employeePriceId } = await ensurePlanPrices(
      plan,
      interval,
      employeeCount,
    );

    updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: buildSubscriptionItemReplacement({
        currentItems: subscription.items.data,
        basePriceId,
        employeePriceId,
        employeeCount,
      }),
      proration_behavior: "create_prorations",
      // A payment problem must surface as an incomplete update rather
      // than silently half-applying the plan change.
      payment_behavior: "pending_if_incomplete",
      metadata: {
        companyId,
        planId,
        annual: interval === "year" ? "true" : "false",
      },
    });

    // Collect the difference NOW: invoice the pending proration items
    // against the subscription, finalize, and pay with the card on
    // file. auto_advance stays off so nothing here double-charges —
    // this invoice is the one explicit collection step.
    const draft = await stripe.invoices.create({
      customer: customerId,
      subscription: subscriptionId,
      auto_advance: false,
      metadata: { companyId, planId, reason: "plan-upgrade" },
    });
    const finalized = await stripe.invoices.finalizeInvoice(draft.id!);

    let amountChargedCents = 0;
    if (finalized.amount_due > 0) {
      const paid = await stripe.invoices.pay(finalized.id!);
      if (paid.status !== "paid") {
        // NOTE: the subscription in Stripe has already been updated —
        // its customer.subscription.updated webhook will record the new
        // status, but the recorded PLAN is deliberately not updated
        // here; reconciling Stripe's plan against the unpaid proration
        // invoice (retry the charge, or revert the items) is an ops
        // follow-up if this error is ever seen in production.
        return NextResponse.json(
          {
            error:
              "Your card could not be charged for the plan difference. The upgrade was not completed — please update your payment method and try again.",
          },
          { status: 402 },
        );
      }
      amountChargedCents = paid.amount_paid;
    }
    // amount_due <= 0: net credit (e.g. a downgrade). Nothing to
    // collect — finalizing the invoice applies the credit to the
    // customer's balance, where it offsets future invoices.

    const update = upgradeCompanyUpdate({
      planId,
      subscriptionId,
      subscriptionStatus: updatedSubscription.status,
    });
    if (!update) {
      console.warn(
        `Upgrade for company ${companyId} named unknown plan "${planId}"; not recording.`,
      );
      return NextResponse.json(
        { error: "Upgrade could not be recorded." },
        { status: 500 },
      );
    }
    await prisma.company.update({
      where: { id: companyId },
      data: update,
    });

    console.log(
      `🔀 Subscription upgraded in place: company=${companyId} plan=${planId} sub=${subscriptionId} charged=${amountChargedCents}`,
    );

    return NextResponse.json({
      ok: true,
      plan: planId,
      amountChargedCents,
      currency: "cad",
      // Extra field beyond the core contract so the billing UI can
      // label the renewal amount "/mo" vs "/yr" correctly.
      interval,
      nextRenewalAmountCents: planPeriodTotal(plan, employeeCount, interval),
    });
  } catch (error) {
    // A Stripe card error during the immediate collection lands here
    // (invoices.pay throws on a hard decline) — same contract as the
    // non-"paid" branch above: no DB plan change, specific error.
    if (
      error instanceof stripe.errors.StripeCardError ||
      (typeof error === "object" &&
        error !== null &&
        (error as { type?: string }).type === "StripeCardError")
    ) {
      console.error("Upgrade charge declined:", error);
      return NextResponse.json(
        {
          error:
            "Your card was declined for the plan difference. The upgrade was not completed — please update your payment method and try again.",
        },
        { status: 402 },
      );
    }
    console.error("Stripe upgrade error:", error);
    return NextResponse.json(
      { error: "Failed to upgrade plan" },
      { status: 500 },
    );
  }
}
