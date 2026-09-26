/**
 * Route protection via Auth.js middleware.
 *
 * Public routes (marketing, calculator, auth): "/", "/sign-in", "/verify-request"
 * Protected routes (dashboard, employees, payroll, etc.): match "/app/*"
 */

import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (
    pathname === "/" ||
    pathname === "/signup" ||
    pathname === "/payroll-calculator" ||
    pathname.startsWith("/features/") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/verify-request") ||
    pathname.startsWith("/api/auth")
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
