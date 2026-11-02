"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { clerkAppearance } from "@/components/clerk-appearance";
import { Logo } from "@/components/logo";

/**
 * Clerk-hosted auth forms inside the app's brand chrome (same shell as the
 * legacy pages: gradient background, centred logo, white card).
 * URLs are preserved: /sign-in and /signup (path routing, catch-all routes).
 */

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 bg-gradient-to-b from-white to-[#FEF6F5]">
      <div className="w-full max-w-[440px] flex flex-col items-center gap-5">
        <Logo size={36} />
        {children}
        <div className="text-center">
          <p className="text-[11px] text-[#A8A29E]">
            Nexvar Pay by Nexvar Lab Inc. · Canadian payroll software
          </p>
        </div>
      </div>
    </div>
  );
}

export function ClerkSignInForm() {
  return (
    <AuthShell>
      <SignIn
        appearance={clerkAppearance}
        routing="path"
        path="/sign-in"
        signUpUrl="/signup"
        fallbackRedirectUrl="/app"
      />
    </AuthShell>
  );
}

export function ClerkSignUpForm() {
  return (
    <AuthShell>
      <SignUp
        appearance={clerkAppearance}
        routing="path"
        path="/signup"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/onboarding"
      />
    </AuthShell>
  );
}
