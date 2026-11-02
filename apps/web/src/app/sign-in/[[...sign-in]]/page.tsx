import { isClerkAuth } from "@/lib/auth-mode";
import { ClerkSignInForm } from "@/components/clerk-auth-forms";
import { LegacySignInForm } from "../legacy-form";

/**
 * /sign-in — Clerk components in clerk mode; the original Auth.js form
 * (moved verbatim to ../legacy-form.tsx) in legacy mode. The mode is read
 * server-side from APP_AUTH_PROVIDER, so rollback is one env flip.
 */
export default function SignInCatchAllPage() {
  return isClerkAuth() ? <ClerkSignInForm /> : <LegacySignInForm />;
}
