import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId, plan } = await request.json();
  if (!companyId || !plan) {
    return NextResponse.json({ error: "companyId and plan required" }, { status: 400 });
  }

  if (!["solo", "growth", "accountant"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // Verify user is OWNER of this company
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, companyId, role: "OWNER" },
  });
  if (!membership) {
    return NextResponse.json({ error: "Only the company owner can change the plan" }, { status: 403 });
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { plan },
  });

  return NextResponse.json({ success: true, plan });
}
