/**
 * POST /api/register — legacy-mode password sign-up.
 *
 * Creates a User with a scrypt password hash (lib/password.ts). There is
 * deliberately NO email-verification gate: the account works immediately,
 * mirroring LedgerPro, so an accountant can create a client's account for
 * them and hand over the login. The account's owner can always reclaim it
 * through the magic-link or Google sign-in for the same email, so a
 * password created by someone else is never a lock-out.
 *
 * The client follows a 201 with signIn("credentials") to start a session.
 *
 * Self-disables in Clerk mode (mirroring how the Clerk webhook route
 * self-disables in legacy mode): when APP_AUTH_PROVIDER=clerk, sign-up
 * belongs to Clerk and this endpoint answers 404.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { validateRegistration } from "@/lib/credentials";
import { isClerkAuth } from "@/lib/auth-mode";

export async function POST(req: Request) {
  if (isClerkAuth()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = validateRegistration(
    (body ?? {}) as { name?: unknown; email?: unknown; password?: unknown },
  );
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { name, email, password } = parsed.value;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error:
          "An account with this email already exists. Please sign in instead.",
      },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  try {
    await prisma.user.create({ data: { name, email, passwordHash } });
  } catch (err) {
    // Lost a registration race for the same email — same answer as the
    // pre-check above (Prisma unique-constraint violation, P2002).
    if ((err as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Please sign in instead.",
        },
        { status: 409 },
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
