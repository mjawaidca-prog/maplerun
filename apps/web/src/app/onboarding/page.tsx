import { requireSession } from "@/lib/session";
import { OnboardingForm } from "./onboarding-form";

/**
 * Company setup. The auth gate is server-side (requireSession) so it works
 * in both legacy (Auth.js) and Clerk modes; the form itself is a client
 * component. POST /api/onboarding performs its own server-side auth check.
 */
export default async function OnboardingPage() {
  const session = await requireSession();
  return <OnboardingForm email={session.email} />;
}
