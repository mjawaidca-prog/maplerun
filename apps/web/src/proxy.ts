/**
 * Route protection — mode-dispatched (see lib/auth-mode.ts).
 *
 * LEGACY mode (default): Auth.js middleware, original behaviour below.
 * CLERK mode (APP_AUTH_PROVIDER=clerk): Clerk middleware with the SAME
 * public-path list (plus the Clerk webhook route, which verifies its own
 * Svix signature). Unauthenticated requests to protected paths redirect to
 * /sign-in?callbackUrl=<path>, mirroring the legacy behaviour.
 *
 * "/portal/*" is the employee portal (Wave 3): employees are not Auth.js
 * users — they authenticate with Clerk. The portal is public at the proxy
 * in BOTH modes; its own route-group layout resolves the Clerk identity
 * and fails closed without one, so the proxy never gates it.
 *
 * The matcher is shared by both modes. It keeps the production exclusions
 * for the app-generated metadata routes (robots.txt, sitemap.xml,
 * opengraph-image — src/app/robots.ts, sitemap.ts) so crawlers are never
 * redirected to /sign-in.
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
    pathname.startsWith("/api/auth") ||
    pathname === "/api/register" ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/")
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
  "/api/register",
  "/portal(.*)",
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
    // Skip Next.js internals and static files; also skip the app-generated
    // metadata routes (production matcher parity — see header note)
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
