"use client";

import { useState } from "react";

export function UpgradePlanButton({ planId, label }: { planId: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, employeeCount: 1 }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? "Failed to start checkout");
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleUpgrade}
        disabled={loading}
        className="inline-flex rounded-[9px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-xs font-semibold px-4 py-2 transition-colors disabled:opacity-50"
      >
        {loading ? "Redirecting…" : label}
      </button>
      {error && <p className="text-[10px] text-[#B3261E] mt-1">{error}</p>}
    </div>
  );
}
