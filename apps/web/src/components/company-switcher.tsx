"use client";

import { useState } from "react";

type Props = {
  companies: { id: string; name: string }[];
  activeId: string;
};

export function CompanySwitcher({ companies, activeId }: Props) {
  const [switching, setSwitching] = useState(false);

  if (companies.length <= 1) return null;

  async function handleSwitch(companyId: string) {
    if (companyId === activeId || switching) return;
    setSwitching(true);
    try {
      await fetch("/api/company/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      // Full page reload to ensure the new cookie is sent to the server
      window.location.href = "/app";
    } catch {
      setSwitching(false);
    }
  }

  return (
    <div className="px-2 space-y-0.5">
      <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#57534E] px-1 pb-1">
        Active company
      </p>
      {companies.map((c) => (
        <button
          key={c.id}
          onClick={() => handleSwitch(c.id)}
          disabled={switching}
          className={`w-full text-left px-3 py-1.5 rounded-[7px] text-xs transition-colors ${
            c.id === activeId
              ? "bg-[#3F1413] text-white font-semibold cursor-default"
              : "text-[#A8A29E] hover:bg-[#292524] hover:text-[#E7E5E4]"
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
