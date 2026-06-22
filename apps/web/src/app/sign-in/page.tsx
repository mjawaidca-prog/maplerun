"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/app";
  const hasGoogle = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";
  const { data: session, status: sessionStatus } = useSession();

  // Already signed in — redirect
  useEffect(() => {
    if (sessionStatus === "authenticated" && session?.user) {
      const dest = session.user.companyId ? "/app" : "/onboarding";
      window.location.href = dest;
    }
  }, [sessionStatus, session]);

  if (sessionStatus === "authenticated" && session?.user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); if (loading) return;
    setError(null); setLoading(true);
    try {
      const result = await signIn("resend", { email, redirect: false, callbackUrl });
      if (result?.error) setError("Failed to send magic link. Please try again.");
      else setSent(true);
    } catch { setError("An unexpected error occurred."); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-8 py-12 bg-gradient-to-b from-white to-[#FEF6F5]">
      <div className="w-full max-w-[400px] space-y-7">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center">
            <Logo size={34} />
          </div>
          <p className="text-sm text-[#78716C]">Sign in to your payroll account</p>
        </div>

        <Card className="border-[#E7E5E4] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-0">
          {!sent ? (
            <>
              <CardHeader className="pb-3 pt-7 px-7">
                <CardTitle className="text-lg font-bold">Sign in</CardTitle>
                <CardDescription className="text-[13px] text-[#78716C] mt-1">
                  We&apos;ll email you a secure magic link — no password needed.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-7 pb-7 space-y-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-semibold text-[#44403C]">Work email</Label>
                    <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className="rounded-lg h-[44px]" />
                  </div>
                  {error && <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">{error}</div>}
                  <Button type="submit" className="w-full h-[44px] rounded-[10px] bg-[#B3261E] hover:bg-[#8F1D17] text-[15px] font-semibold" disabled={loading}>
                    {loading ? "Sending link…" : "Send magic link"}
                  </Button>
                </form>
                {hasGoogle && (
                  <>
                    <div className="flex items-center gap-3 text-xs text-[#A8A29E]">
                      <Separator className="flex-1" /><span>or</span><Separator className="flex-1" />
                    </div>
                    <button onClick={() => signIn("google", { callbackUrl })} className="w-full h-[44px] rounded-[10px] border border-[#D6D3D1] bg-white text-sm font-semibold flex items-center justify-center gap-2.5 hover:bg-gray-50">
                      <span className="font-bold text-[#4285F4]">G</span> Continue with Google
                    </button>
                  </>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="py-7 px-7 text-center space-y-5">
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[10px] p-4">
                <p className="text-[26px] mb-1">📬</p>
                <p className="text-[15px] font-bold text-[#15803D]">Check your email</p>
                <p className="text-[13px] text-[#166534] mt-1 leading-relaxed">
                  We sent a magic link to <b>{email}</b>. Click it to sign in — it expires in 15 minutes.
                </p>
              </div>
              <button onClick={() => { setSent(false); setError(null); }} className="text-[13px] text-[#B3261E] font-semibold hover:underline">
                Use a different email
              </button>
            </CardContent>
          )}
        </Card>
        <p className="text-center text-xs text-[#A8A29E] leading-relaxed">
          By continuing you agree to our <a href="#" className="text-[#78716C]">Terms</a> and <a href="#" className="text-[#78716C]">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return <Suspense><SignInForm /></Suspense>;
}
