"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function SignUpForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/app";
  const { data: session, status: sessionStatus } = useSession();

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
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-gradient-to-b from-white to-[#FEF6F5]">
      <div className="w-full max-w-[440px] space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center">
            <Logo size={34} />
          </div>
          <h1 className="text-[22px] font-extrabold tracking-[-0.02em]">Create your account</h1>
          <p className="text-sm text-[#78716C]">
            14-day free trial · No credit card · Cancel anytime
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { icon: "🧮", text: "CRA-accurate tax engine" },
            { icon: "📄", text: "Pay stubs & T4 slips" },
            { icon: "🇨🇦", text: "All 13 provinces" },
          ].map((b) => (
            <div key={b.text} className="bg-white border border-[#E7E5E4] rounded-xl p-3">
              <div className="text-xl mb-1">{b.icon}</div>
              <p className="text-[11px] font-semibold text-[#57534E] leading-tight">{b.text}</p>
            </div>
          ))}
        </div>

        {!sent ? (
          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-7 shadow-[0_4px_24px_rgba(0,0,0,0.06)] space-y-4">
            {/* Google sign-up */}
            <button
              onClick={() => signIn("google", { callbackUrl })}
              className="w-full h-[48px] rounded-[10px] border border-[#D6D3D1] bg-white text-[15px] font-semibold flex items-center justify-center gap-3 hover:bg-gray-50 hover:border-[#B3261E]/30 transition-colors shadow-sm"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign up with Google
            </button>

            <div className="flex items-center gap-3 text-xs text-[#A8A29E]">
              <Separator className="flex-1" /><span>or sign up with email</span><Separator className="flex-1" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold text-[#44403C]">Work email</Label>
                <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className="rounded-lg h-[44px]" />
              </div>
              {error && <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">{error}</div>}
              <Button type="submit" className="w-full h-[44px] rounded-[10px] bg-[#B3261E] hover:bg-[#8F1D17] text-[15px] font-semibold" disabled={loading}>
                {loading ? "Sending link…" : "Continue with email →"}
              </Button>
            </form>
          </div>
        ) : (
          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-10 shadow-[0_4px_24px_rgba(0,0,0,0.06)] text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-[#F0FDF4] flex items-center justify-center text-[30px] mx-auto">📬</div>
            <h2 className="text-lg font-extrabold tracking-[-0.01em] text-[#15803D]">Check your email</h2>
            <p className="text-sm text-[#166534] leading-relaxed">
              We sent a magic link to <b>{email}</b>. Click it to create your account — link expires in 15 minutes.
            </p>
            <button onClick={() => { setSent(false); setError(null); }} className="text-[13px] text-[#B3261E] font-semibold hover:underline">
              Use a different email
            </button>
          </div>
        )}

        <p className="text-center text-xs text-[#A8A29E] leading-relaxed">
          Already have an account?{" "}
          <a href="/sign-in" className="text-[#B3261E] font-semibold no-underline">Sign in →</a>
        </p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return <Suspense><SignUpForm /></Suspense>;
}
