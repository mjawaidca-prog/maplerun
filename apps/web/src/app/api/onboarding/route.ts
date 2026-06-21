import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name: string; slug: string; defaultProvince: string; payFrequency: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, slug, defaultProvince, payFrequency } = body;

  if (!name || !slug || !defaultProvince || !payFrequency) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const validFrequencies = ["WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY"];
  if (!validFrequencies.includes(payFrequency)) {
    return NextResponse.json({ error: "Invalid pay frequency" }, { status: 400 });
  }

  // Check slug uniqueness
  const existing = await prisma.company.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "This URL slug is already taken. Try another." }, { status: 409 });
  }

  // Promo code: MAPLE2026 gives Accountant plan + unlimited free runs
  const isPromo = slug.toUpperCase().includes("MAPLE2026") || name.toUpperCase().includes("MAPLE2026");

  const company = await prisma.company.create({
    data: {
      name,
      slug,
      active: true,
      plan: isPromo ? "accountant" : "growth",
      maxFreePayRuns: isPromo ? 999 : 2,
      memberships: {
        create: {
          userId: session.user.id,
          role: "OWNER",
        },
      },
    },
  });

  // Create a default pay group
  await prisma.payGroup.create({
    data: {
      companyId: company.id,
      name: "Default",
      frequency: payFrequency as "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY" | "MONTHLY",
      defaultProvince: defaultProvince,
    },
  });

  return NextResponse.json({ success: true, companyId: company.id, slug: company.slug });
}
