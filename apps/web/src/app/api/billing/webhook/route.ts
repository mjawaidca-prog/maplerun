/**
 * POST /api/billing/webhook — Stripe webhook receiver.
 *
 * Handles:
 *  - checkout.session.completed → record the purchase on the Company
 *    (plan, Stripe customer + subscription ids, subscription status)
 *    and clear the free trial — a paying company must stop looking
 *    "on trial" to the banner and the pay-run gate (lib/trial).
 *  - customer.subscription.updated → record the subscription's new
 *    status (and ids) so plan changes / dunning states stay current.
 *  - customer.subscription.deleted → record status "canceled"; the
 *    pay-run gate treats a recorded canceled/unpaid subscription as
 *    blocked, so a cancelled company does not keep paid access.
 *
 * Setup: `stripe listen --forward-to localhost:3000/api/billing/webhook`
 * Then copy the signing secret to STRIPE_WEBHOOK_SECRET in .env.
 */

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { checkoutCompletionCompanyUpdate, stripeId } from "@/lib/billing";
import type Stripe from "stripe";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      default:
        // Unhandled event — no-op
        break;
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return new NextResponse("Handler error", { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // companyId + planId come from the metadata /api/billing/checkout set
  // server-side when it created the session — never from client input.
  const { companyId, planId } = session.metadata ?? {};
  if (!companyId) {
    console.warn("Webhook missing companyId metadata:", session.id);
    return;
  }

  const subscriptionId = stripeId(session.subscription);
  const customerId = stripeId(session.customer);

  // The session doesn't carry the subscription's status; fetch it so
  // the recorded status is Stripe's truth. A completed checkout implies
  // a live subscription, so if the fetch fails we record "active"
  // rather than dropping the whole provisioning on the floor.
  let subscriptionStatus = "active";
  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      subscriptionStatus = subscription.status;
    } catch (error) {
      console.warn(
        `Could not retrieve subscription ${subscriptionId} for status; recording "active":`,
        error,
      );
    }
  }

  const update = checkoutCompletionCompanyUpdate({
    planId,
    customerId,
    subscriptionId,
    subscriptionStatus,
  });
  if (!update) {
    console.warn(
      `Webhook checkout for company ${companyId} named unknown plan "${planId}"; not recording.`,
    );
    return;
  }

  await prisma.company.update({
    where: { id: companyId },
    data: update,
  });

  console.log(
    `✅ Subscription recorded: company=${companyId} plan=${update.plan} sub=${subscriptionId} status=${subscriptionStatus} (trial cleared)`,
  );
}

/**
 * Find the company a subscription event belongs to: the subscription
 * metadata our checkout route stamps on every subscription is primary;
 * the recorded stripeSubscriptionId is the fallback (e.g. a subscription
 * whose metadata was edited in the Stripe Dashboard).
 */
async function resolveCompanyId(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromMetadata = subscription.metadata?.companyId;
  if (fromMetadata) return fromMetadata;

  const company = await prisma.company.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true },
  });
  return company?.id ?? null;
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const companyId = await resolveCompanyId(subscription);
  if (!companyId) return;

  // Keep the recorded billing state current: status drives the pay-run
  // gate (past_due still counts as paid while Stripe retries; unpaid /
  // canceled block), and the ids keep the deleted-event fallback cheap.
  await prisma.company.update({
    where: { id: companyId },
    data: {
      stripeCustomerId: stripeId(subscription.customer),
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
    },
  });

  console.log(
    `📋 Subscription updated: company=${companyId} status=${subscription.status}`,
  );

  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    console.warn(`⚠ Subscription ${subscription.status} for company ${companyId}`);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const companyId = await resolveCompanyId(subscription);
  if (!companyId) return;

  // Record the cancellation — deliberately NOT restoring trialEndsAt
  // (that would hand back free pay runs) and NOT clearing the ids:
  // subscriptionStatus stays non-null, so lib/trial reads the recorded
  // status and blocks finalizing until the company subscribes again.
  await prisma.company.update({
    where: { id: companyId },
    data: {
      stripeCustomerId: stripeId(subscription.customer),
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status, // "canceled" on this event
    },
  });

  console.log(`❌ Subscription cancelled: company=${companyId}`);
}
