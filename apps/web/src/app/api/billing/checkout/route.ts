/**
 * POST /api/billing/checkout — create a Stripe Checkout session.
 * Body: { planId: string, annual?: boolean }
 *
 * Monthly billing or annual (2 months free = 10x monthly price billed yearly).
 *
 * The charge is the plan's base price PLUS its per-employee price × the
 * company's actual ACTIVE employee count, counted here in the database.
 * An `employeeCount` in the request body is accepted for backward
 * compatibility with older clients but is NEVER trusted or used — the
 * server-side count is the only one that reaches Stripe.
 */

import { NextResponse } from "next/server";
import { stripe, getPlan } from "@/lib/stripe";
import { buildCheckoutLineItems } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/session";

export async function POST(request: Request) {
  const { companyId } = await requireCompany();

  let body: { planId: string; annual?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { planId, annual } = body;
  const plan = getPlan(planId);
  if (!plan) {
    return NextResponse.json(
      { error: `Unknown plan: ${planId}` },
      { status: 400 },
    );
  }

  // Server-side source of truth for the per-employee line item — the
  // same `active: true` count the dashboard uses.
  const employeeCount = await prisma.employee.count({
    where: { companyId, active: true },
  });

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      billing_address_collection: "required",
      line_items: buildCheckoutLineItems(plan, employeeCount, !!annual),
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
