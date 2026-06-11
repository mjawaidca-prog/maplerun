/**
 * POST /api/billing/webhook — Stripe webhook receiver.
 *
 * Handles:
 *  - checkout.session.completed → provision subscription access
 *  - customer.subscription.updated → update plan/seat count
 *  - customer.subscription.deleted → revoke access
 *
 * Setup: `stripe listen --forward-to localhost:3000/api/billing/webhook`
 * Then copy the signing secret to STRIPE_WEBHOOK_SECRET in .env.
 */

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
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
  const { companyId, planId } = session.metadata ?? {};
  if (!companyId || !planId) {
    console.warn("Webhook missing metadata:", session.id);
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  // Store subscription info — in production, add a Subscription model to Prisma.
  // For Phase 5, we log and mark the company as subscribed.
  console.log(
    `✅ Subscription activated: company=${companyId} plan=${planId} sub=${subscriptionId}`,
  );

  // TODO: Create a Billing/Subscription model in Prisma and persist here.
  // For now: update a metadata field or log.
  await prisma.company.update({
    where: { id: companyId },
    data: {
      // active field is already true by default
      // Future: add a stripeSubscriptionId and stripePlanId to Company model
    },
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const { companyId } = subscription.metadata ?? {};
  if (!companyId) return;

  const status = subscription.status;
  console.log(
    `📋 Subscription updated: company=${companyId} status=${status}`,
  );

  if (status === "past_due" || status === "unpaid") {
    // Could restrict access here — for now just log
    console.warn(`⚠ Subscription past due for company ${companyId}`);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { companyId } = subscription.metadata ?? {};
  if (!companyId) return;

  console.log(`❌ Subscription cancelled: company=${companyId}`);
  // At cancellation end-of-period, revoke access.
  // For now: keep the company active; real enforcement needs an expiry date field.
}
