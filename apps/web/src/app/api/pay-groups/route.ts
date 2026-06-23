import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { companyId: string; name: string; frequency: string; defaultProvince: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { companyId, name, frequency, defaultProvince } = body;

  if (!companyId || !name || !frequency || !defaultProvince) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const validFrequencies = ["WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY"];
  if (!validFrequencies.includes(frequency)) {
    return NextResponse.json({ error: "Invalid pay frequency" }, { status: 400 });
  }

  // Verify membership
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, companyId },
  });
  if (!membership) {
    return NextResponse.json({ error: "You do not belong to this company" }, { status: 403 });
  }

  const payGroup = await prisma.payGroup.create({
    data: {
      companyId,
      name,
      frequency: frequency as "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY" | "MONTHLY",
      defaultProvince,
    },
  });

  return NextResponse.json({ success: true, payGroup });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing pay group ID" }, { status: 400 });
  }

  // Verify membership via the pay group's company
  const payGroup = await prisma.payGroup.findUnique({
    where: { id },
    select: { companyId: true },
  });
  if (!payGroup) {
    return NextResponse.json({ error: "Pay group not found" }, { status: 404 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, companyId: payGroup.companyId },
  });
  if (!membership) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await prisma.payGroup.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
