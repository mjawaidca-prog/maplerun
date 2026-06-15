/**
 * POST /api/billing/checkout — create a Stripe Checkout session.
 * Body: { planId: string, employeeCount: number, companyId: string }
 *
 * Stripe Checkout redirects to success/cancel URLs after payment.
 * On success, the webhook handler provisions access.
 */

import { NextResponse } from "next/server";
import { stripe, getPlan, planMonthlyTotal } from "@/lib/stripe";
import { requireCompany } from "@/lib/session";

export async function POST(request: Request) {
  const { companyId } = await requireCompany();

  let body: { planId: string; employeeCount: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { planId, employeeCount } = body;
  const plan = getPlan(planId);
  if (!plan) {
    return NextResponse.json(
      { error: `Unknown plan: ${planId}` },
      { status: 400 },
    );
  }

  if (!Number.isInteger(employeeCount) || employeeCount < 0) {
    return NextResponse.json(
      { error: "employeeCount must be a non-negative integer" },
      { status: 400 },
    );
  }

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      billing_address_collection: "required",
      customer_email: undefined, // will be set by Checkout
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: { name: `MapleRun ${plan.name}` },
            unit_amount: plan.basePriceCents,
            recurring: { interval: "month" as const },
          },
          quantity: 1,
        },
      ],
      metadata: {
        companyId,
        planId,
        employeeCount: employeeCount.toString(),
      },
      subscription_data: {
        metadata: {
          companyId,
          planId,
        },
      },
      success_url: `${origin}/app?checkout=success&plan=${planId}`,
      cancel_url: `${origin}/app?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
