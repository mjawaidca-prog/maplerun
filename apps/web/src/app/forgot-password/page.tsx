"use client";

import { useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { requestPasswordResetAction } from "@/app/actions/password-reset";

/**
 * /forgot-password — request a password reset link.
 *
 * The confirmation is deliberately neutral: the same message shows whether
 * or not the email belongs to an account, so this page can't be used to
 * probe which emails are registered. Every existing account receives an
 * email — the link resets an existing password or sets a first one for
 * accounts that signed up with a magic link / Google (lib/password-reset.ts).
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await requestPasswordResetAction(email);
    } finally {
      // Neutral by design: success and "no such account" look identical.
      setSent(true);
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
          <p className="text-sm text-[#78716C]">Reset your password</p>
        </div>

        <Card className="border-[#E7E5E4] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-0">
          {!sent ? (
            <CardContent className="pt-7 px-7 pb-7 space-y-4">
              <p className="text-[13px] text-[#57534E] leading-relaxed">
                Enter the email for your account and we&apos;ll send you a link
                to set a new password.
              </p>
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-semibold text-[#44403C]">Work email</Label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="rounded-lg h-[44px]"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-[44px] rounded-[10px] bg-[#B3261E] hover:bg-[#8F1D17] text-[15px] font-semibold"
                  disabled={loading}
                >
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
              </form>
              <p className="text-center text-[13px]">
                <a href="/sign-in" className="text-[#B3261E] font-semibold hover:underline">
                  Back to sign in
                </a>
              </p>
            </CardContent>
          ) : (
            <CardContent className="py-7 px-7 text-center space-y-5">
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[10px] p-4">
                <p className="text-[26px] mb-1">📬</p>
                <p className="text-[15px] font-bold text-[#15803D]">Check your email</p>
                <p className="text-[13px] text-[#166534] mt-1 leading-relaxed">
                  If an account exists for <b>{email}</b>, we sent a link to
                  set or reset your password — it expires in 1 hour.
                </p>
              </div>
              <button
                onClick={() => setSent(false)}
                className="text-[13px] text-[#B3261E] font-semibold hover:underline"
              >
                Use a different email
              </button>
              <p className="text-center text-[13px]">
                <a href="/sign-in" className="text-[#B3261E] font-semibold hover:underline">
                  Back to sign in
                </a>
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
