import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = await request.json();
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  // Verify the user is a member of this company
  const membership = await prisma.membership.findFirst({
    where: { userId: userId, companyId },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this company" }, { status: 403 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("maplerun-active-company", companyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return response;
}
