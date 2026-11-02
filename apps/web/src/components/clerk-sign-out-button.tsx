"use client";

import { SignOutButton } from "@clerk/nextjs";

/** Clerk-mode sign-out control, styled to match the legacy sidebar button. */
export function ClerkSignOutButton() {
  return (
    <SignOutButton redirectUrl="/">
      <button
        type="button"
        className="text-[11px] text-[#78716C] hover:text-[#A8A29E] cursor-pointer"
      >
        Sign out
      </button>
    </SignOutButton>
  );
}
