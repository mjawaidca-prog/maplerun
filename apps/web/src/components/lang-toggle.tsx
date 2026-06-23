"use client";

import { useLang } from "@/lib/i18n";

export function LangToggle() {
  const { lang, toggle } = useLang();

  return (
    <div className="flex items-center border border-[#D6D3D1] rounded-md overflow-hidden text-xs font-semibold">
      <button
        onClick={() => lang === "fr" && toggle()}
        className={`px-2.5 py-1 cursor-pointer transition-colors ${
          lang === "en"
            ? "bg-[#1C1917] text-white"
            : "bg-transparent text-[#A8A29E] hover:text-[#57534E]"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => lang === "en" && toggle()}
        className={`px-2.5 py-1 cursor-pointer transition-colors ${
          lang === "fr"
            ? "bg-[#1C1917] text-white"
            : "bg-transparent text-[#A8A29E] hover:text-[#57534E]"
        }`}
      >
        FR
      </button>
    </div>
  );
}
