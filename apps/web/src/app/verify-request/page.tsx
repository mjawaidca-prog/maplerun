/**
 * Verify request — shown after magic link is sent (server-rendered fallback).
 */
import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-8 py-12 bg-gradient-to-b from-white to-[#FEF6F5]">
      <div className="w-full max-w-[420px] text-center space-y-6">
        <div className="flex items-center justify-center gap-2.5">
          <span className="text-[26px]">🍁</span>
          <span className="text-[22px] font-extrabold tracking-[-0.02em]">MapleRun</span>
        </div>

        <div className="bg-white border border-[#E7E5E4] rounded-2xl p-10 shadow-[0_4px_24px_rgba(0,0,0,0.06)] space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-[#FEF2F2] flex items-center justify-center text-[30px] mx-auto">📬</div>
          <h1 className="text-xl font-extrabold tracking-[-0.01em]">Check your email</h1>
          <p className="text-sm text-[#78716C] leading-relaxed">
            A sign-in link is on its way. Click it to finish signing in — the link expires in 15 minutes and can only be used once.
          </p>
          <div className="flex gap-2.5 text-left bg-[#FAFAF9] border border-[#E7E5E4] rounded-[10px] px-4 py-3.5 text-[12.5px] text-[#78716C] leading-relaxed">
            🔒 Didn&apos;t request this? You can safely ignore this page — no one can access your account without the link.
          </div>
          <p className="text-[13px] text-[#78716C]">
            Didn&apos;t get it? Check spam
          </p>
        </div>

        <Link href="/sign-in" className="inline-block text-[13px] text-[#78716C] no-underline hover:text-[#1C1917]">
          ← Use a different email
        </Link>
      </div>
    </div>
  );
}
