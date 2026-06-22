"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];
const FREQUENCIES = [
  { value: "WEEKLY", label: "Weekly" }, { value: "BIWEEKLY", label: "Biweekly" },
  { value: "SEMIMONTHLY", label: "Semi-monthly" }, { value: "MONTHLY", label: "Monthly" },
];

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [defaultProvince, setDefaultProvince] = useState("ON");
  const [payFrequency, setPayFrequency] = useState("BIWEEKLY");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) { router.push("/sign-in"); return; }
    // Allow creating additional companies — don't redirect
  }, [status, session, router]);

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center"><p className="text-[#A8A29E]">Loading…</p></div>;
  if (!session?.user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); if (submitting) return;
    setError(null); setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug, defaultProvince, payFrequency }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Failed to create company"); }
      router.push("/app");
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-8 py-12 bg-gradient-to-b from-white to-[#FEF6F5]">
      <div className="w-full max-w-[460px] space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center">
            <Logo size={32} />
          </div>
          <p className="text-sm text-[#78716C]">Let&apos;s set up your company</p>
          <div className="flex items-center justify-center gap-1.5">
            <span className="w-[22px] h-[7px] rounded-full bg-[#B3261E]" />
            <span className="w-[7px] h-[7px] rounded-full bg-[#E7E5E4]" />
            <span className="w-[7px] h-[7px] rounded-full bg-[#E7E5E4]" />
          </div>
        </div>

        <div className="bg-white border border-[#E7E5E4] rounded-2xl p-7 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <h2 className="text-[19px] font-extrabold tracking-[-0.01em]">Company details</h2>
          <p className="text-[13px] text-[#78716C] mt-1 mb-5">You can change any of this later in Company settings.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[13px] font-semibold text-[#44403C] block mb-1.5">Company name <span className="text-[#B3261E]">*</span></label>
              <input className="w-full border border-[#D6D3D1] rounded-lg px-3.5 py-[11px] text-sm bg-white font-sans disabled:opacity-50" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} disabled={submitting} placeholder="Northwind Carpentry Ltd." />
            </div>

            <div>
              <label className="text-[13px] font-semibold text-[#44403C] block mb-1.5">Workspace URL <span className="text-[#B3261E]">*</span></label>
              <div className="flex items-center border border-[#D6D3D1] rounded-lg overflow-hidden">
                <span className="px-3 py-[11px] bg-[#FAFAF9] text-[#A8A29E] text-sm border-r border-[#E7E5E4]">nexvarlab.com/</span>
                <input className="flex-1 border-none px-3 py-[11px] text-sm font-mono outline-none disabled:opacity-50" value={slug} onChange={(e) => setSlug(e.target.value)} required maxLength={50} pattern="[a-zA-Z0-9-]+" disabled={submitting} placeholder="northwind" />
              </div>
              <p className="text-xs text-[#A8A29E] mt-1.5">Letters, numbers and hyphens only.</p>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="text-[13px] font-semibold text-[#44403C] block mb-1.5">Default province <span className="text-[#B3261E]">*</span></label>
                <select className="w-full border border-[#D6D3D1] rounded-lg px-3 py-[11px] text-sm bg-white font-sans disabled:opacity-50" value={defaultProvince} onChange={(e) => setDefaultProvince(e.target.value)} disabled={submitting}>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-[#44403C] block mb-1.5">Pay frequency <span className="text-[#B3261E]">*</span></label>
                <select className="w-full border border-[#D6D3D1] rounded-lg px-3 py-[11px] text-sm bg-white font-sans disabled:opacity-50" value={payFrequency} onChange={(e) => setPayFrequency(e.target.value)} disabled={submitting}>
                  {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>

            {error && <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">{error}</div>}

            <button type="submit" className="w-full py-3 rounded-[10px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-[15px] font-semibold mt-1.5 disabled:opacity-50" disabled={submitting}>
              {submitting ? "Creating…" : "Create company →"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#A8A29E]">Signed in as {session.user.email}</p>
      </div>
    </div>
  );
}
