/**
 * Route protection via Auth.js middleware.
 *
 * Public routes (marketing, calculator, auth): "/", "/sign-in", "/verify-request"
 * Protected routes (dashboard, employees, payroll, etc.): match "/app/*"
 *
 * "/portal/*" is the employee portal (Wave 3): employees are not Auth.js
 * users — they authenticate with Clerk. The portal enforces its own
 * identity seam in its route-group layout, so it is public HERE only in
 * the Auth.js sense; it fails closed without a resolved Clerk identity.
 */

import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (
    pathname === "/" ||
    pathname === "/signup" ||
    pathname === "/payroll-calculator" ||
    pathname === "/guides" ||
    pathname.startsWith("/guides/") ||
    pathname.startsWith("/features/") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/verify-request") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/")
  ) {
    return;
  }

  // Protect app routes
  if (!req.auth) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|opengraph-image|.*\\.svg$).*)"],
};
