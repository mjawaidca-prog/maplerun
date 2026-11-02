import { signOut } from "@/lib/auth";
import { getAuthMode } from "@/lib/auth-mode";
import { ClerkSignOutButton } from "@/components/clerk-sign-out-button";

/**
 * Sidebar sign-out control — renders the original Auth.js server-action
 * form in legacy mode, and Clerk's SignOutButton in clerk mode.
 */
export function SignOutControl() {
  if (getAuthMode() === "clerk") {
    return <ClerkSignOutButton />;
  }
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className="text-[11px] text-[#78716C] hover:text-[#A8A29E] cursor-pointer"
      >
        Sign out
      </button>
    </form>
  );
}
