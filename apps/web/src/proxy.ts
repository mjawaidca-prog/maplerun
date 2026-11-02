/**
 * Route protection — mode-dispatched (see lib/auth-mode.ts).
 *
 * LEGACY mode (default): Auth.js middleware, original behaviour below.
 * CLERK mode (APP_AUTH_PROVIDER=clerk): Clerk middleware with the SAME
 * public-path list (plus the Clerk webhook route, which verifies its own
 * Svix signature). Unauthenticated requests to protected paths redirect to
 * /sign-in?callbackUrl=<path>, mirroring the legacy behaviour.
 *
 * The matcher is shared by both modes.
 */

import { auth } from "@/lib/auth";
import { isClerkAuth } from "@/lib/auth-mode";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/signup" ||
    pathname.startsWith("/api/webhooks/clerk") ||
    pathname.startsWith("/guides") ||
    pathname.startsWith("/payroll-calculator") ||
    pathname.startsWith("/features") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/verify-request") ||
    pathname.startsWith("/api/auth")
  );
}

// ── Legacy (Auth.js) ─────────────────────────────────────────────────────────

const legacyProxy = auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Require auth for everything else
  if (!req.auth) {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

// ── Clerk ────────────────────────────────────────────────────────────────────

const isPublicRoute = createRouteMatcher([
  "/",
  "/signup(.*)",
  "/api/webhooks/clerk(.*)",
  "/guides(.*)",
  "/payroll-calculator(.*)",
  "/features(.*)",
  "/sign-in(.*)",
  "/verify-request(.*)",
  "/api/auth(.*)",
]);

const clerkProxy = clerkMiddleware(async (clerkAuth, req) => {
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }
  const { userId } = await clerkAuth();
  if (!userId) {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
});

// ── Dispatch ─────────────────────────────────────────────────────────────────

// Auth.js types its middleware handler context differently from Next's
// proxy context; both handlers accept (NextRequest, event) at runtime.
const legacyHandler = legacyProxy as unknown as (
  req: NextRequest,
  evt: NextFetchEvent,
) => Promise<Response | undefined> | Response | undefined;

export default function proxy(req: NextRequest, evt: NextFetchEvent) {
  return isClerkAuth() ? clerkProxy(req, evt) : legacyHandler(req, evt);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
