"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordInput } from "@/components/password-input";
import { resetPasswordAction } from "@/app/actions/password-reset";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

/**
 * /reset-password?token=…&email=… — set a new password from the emailed link.
 *
 * The token is validated server-side (exists, unused, unexpired) when the
 * form is submitted; see lib/password-reset.ts. On success the user lands
 * on /sign-in?reset=success, which shows the confirmation notice.
 */
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkMissing = !token || !email;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const result = await resetPasswordAction({ email, token, newPassword: password });
      if (result.ok) {
        window.location.href = "/sign-in?reset=success";
        return;
      }
      setError(result.error);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-gradient-to-b from-white to-[#FEF6F5]">
      <div className="w-full max-w-[400px] space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center">
            <Logo size={34} />
          </div>
          <p className="text-sm text-[#78716C]">Set a new password</p>
        </div>

        <Card className="border-[#E7E5E4] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-0">
          <CardContent className="pt-7 px-7 pb-7 space-y-4">
            {linkMissing ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-[13px] text-destructive">
                  This reset link is incomplete. Open the link from your email,
                  or request a new one.
                </div>
                <p className="text-center text-[13px]">
                  <a href="/forgot-password" className="text-[#B3261E] font-semibold hover:underline">
                    Request a new reset link
                  </a>
                </p>
              </div>
            ) : (
              <>
                <p className="text-[13px] text-[#57534E] leading-relaxed">
                  Choose a new password for <b>{email}</b>.
                </p>
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-[13px] font-semibold text-[#44403C]">
                      New password
                    </Label>
                    <PasswordInput
                      id="new-password"
                      value={password}
                      onChange={setPassword}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="text-[13px] font-semibold text-[#44403C]">
                      Confirm new password
                    </Label>
                    <PasswordInput
                      id="confirm-password"
                      value={confirm}
                      onChange={setConfirm}
                      placeholder="Repeat the new password"
                      autoComplete="new-password"
                      required
                      disabled={loading}
                    />
                  </div>
                  {error && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                      {error}
                      <div className="mt-1">
                        <a href="/forgot-password" className="font-semibold underline">
                          Request a new reset link
                        </a>
                      </div>
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full h-[44px] rounded-[10px] bg-[#B3261E] hover:bg-[#8F1D17] text-[15px] font-semibold"
                    disabled={loading}
                  >
                    {loading ? "Saving…" : "Set new password"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
