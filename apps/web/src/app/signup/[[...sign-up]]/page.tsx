import { isClerkAuth } from "@/lib/auth-mode";
import { ClerkSignUpForm } from "@/components/clerk-auth-forms";
import { LegacySignUpForm } from "../legacy-form";

/**
 * /signup — Clerk components in clerk mode; the original Auth.js form
 * (moved verbatim to ../legacy-form.tsx) in legacy mode.
 */
export default function SignUpCatchAllPage() {
  return isClerkAuth() ? <ClerkSignUpForm /> : <LegacySignUpForm />;
}
