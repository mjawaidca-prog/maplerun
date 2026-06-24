"use client";

import { useState, useRef, useEffect } from "react";

type Props = {
  companies: { id: string; name: string }[];
  activeId: string;
};

export function CompanySwitcher({ companies, activeId }: Props) {
  const [switching, setSwitching] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (companies.length <= 1) return null;

  const activeCompany = companies.find((c) => c.id === activeId);
  const otherCompanies = companies.filter((c) => c.id !== activeId);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleSwitch(companyId: string) {
    if (companyId === activeId || switching) return;
    setSwitching(true);
    try {
      await fetch("/api/company/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      window.location.href = "/app";
    } catch {
      setSwitching(false);
    }
  }

  return (
    <div className="px-2" ref={ref}>
      {/* Label */}
      <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#57534E] px-1 pb-1">
        Company
      </p>

      {/* Active company — click to open dropdown */}
      <button
        onClick={() => setOpen(!open)}
        disabled={switching}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[8px] bg-[#292524] text-white text-[13px] font-semibold hover:bg-[#3F1413] transition-colors cursor-pointer"
      >
        <span className="truncate text-left">
          {activeCompany?.name ?? "Unknown"}
        </span>
        <svg
          className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 14 14"
          fill="none"
        >
          <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown list of other companies */}
      {open && (
        <div className="mt-1 border border-[#292524] rounded-[8px] overflow-hidden bg-[#1C1917]">
          {otherCompanies.length === 0 ? (
            <div className="px-3 py-2.5 text-[11px] text-[#57534E] text-center">
              No other companies
            </div>
          ) : (
            otherCompanies.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSwitch(c.id)}
                disabled={switching}
                className="w-full text-left px-3 py-2 text-xs text-[#A8A29E] hover:bg-[#292524] hover:text-[#E7E5E4] transition-colors border-b border-[#292524] last:border-b-0"
              >
                {c.name}
              </button>
            ))
          )}
          {switching && (
            <div className="px-3 py-2 text-[11px] text-[#57534E] text-center animate-pulse">
              Switching…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
