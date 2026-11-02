"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { SessionProvider } from "next-auth/react";
import type { AuthMode } from "@/lib/auth-mode";

/**
 * Session providers — mode chosen server-side (root layout reads
 * APP_AUTH_PROVIDER via lib/auth-mode.ts and passes it down).
 * Legacy mode renders the Auth.js SessionProvider exactly as before.
 */
export function Providers({
  children,
  mode = "legacy",
}: {
  children: React.ReactNode;
  mode?: AuthMode;
}) {
  if (mode === "clerk") {
    return (
      <ClerkProvider
        signInUrl="/sign-in"
        signUpUrl="/signup"
        signInFallbackRedirectUrl="/app"
        signUpFallbackRedirectUrl="/onboarding"
      >
        {children}
      </ClerkProvider>
    );
  }
  return <SessionProvider>{children}</SessionProvider>;
}
