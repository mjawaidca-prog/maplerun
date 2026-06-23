/**
 * POST /api/billing/checkout — create a Stripe Checkout session.
 * Body: { planId: string, employeeCount: number, annual?: boolean }
 *
 * Monthly billing or annual (2 months free = 10x monthly price billed yearly).
 */

import { NextResponse } from "next/server";
import { stripe, getPlan } from "@/lib/stripe";
import { requireCompany } from "@/lib/session";

export async function POST(request: Request) {
  const { companyId } = await requireCompany();

  let body: { planId: string; employeeCount: number; annual?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { planId, employeeCount, annual } = body;
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

  // Annual = 10x monthly price (2 months free), billed yearly
  const unitAmount = annual ? plan.basePriceCents * 10 : plan.basePriceCents;
  const interval = annual ? ("year" as const) : ("month" as const);
  const label = annual ? `${plan.name} (Annual)` : plan.name;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      billing_address_collection: "required",
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: { name: `Nexvar Pay ${label}` },
            unit_amount: unitAmount,
            recurring: { interval },
          },
          quantity: 1,
        },
      ],
      metadata: {
        companyId,
        planId,
        annual: annual ? "true" : "false",
        employeeCount: employeeCount.toString(),
      },
      subscription_data: {
        metadata: {
          companyId,
          planId,
          annual: annual ? "true" : "false",
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
