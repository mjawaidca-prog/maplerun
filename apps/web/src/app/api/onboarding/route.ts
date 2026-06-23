import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name: string; slug: string; businessNumber?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, slug, businessNumber } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "Company name and slug are required" }, { status: 400 });
  }

  // Check slug uniqueness
  const existing = await prisma.company.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "This URL slug is already taken. Try another." }, { status: 409 });
  }

  // Promo code: MAPLE2026 gives Accountant plan + unlimited trial
  const isPromo = slug.toUpperCase().includes("MAPLE2026") || name.toUpperCase().includes("MAPLE2026");

  // Trial: 14 days from now (promo code = no expiry)
  const trialEndsAt = isPromo ? null : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const company = await prisma.company.create({
    data: {
      name,
      slug,
      active: true,
      plan: isPromo ? "accountant" : "growth",
      maxFreePayRuns: isPromo ? 999 : 2,
      businessNumber: businessNumber ?? null,
      trialEndsAt,
      memberships: {
        create: {
          userId: session.user.id,
          role: "OWNER",
        },
      },
    },
  });

  // Note: Pay groups are created separately by the user inside the app.
  // No default pay group is auto-created — province and frequency are set per pay group.

  return NextResponse.json({ success: true, companyId: company.id, slug: company.slug });
}
