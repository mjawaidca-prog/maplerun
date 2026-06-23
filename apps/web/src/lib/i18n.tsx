"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type Lang = "en" | "fr";

const LangContext = createContext<{
  lang: Lang;
  toggle: () => void;
  t: (en: string, fr: string) => string;
}>({
  lang: "en",
  toggle: () => {},
  t: (en) => en,
});

export function useLang() {
  return useContext(LangContext);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const stored = localStorage.getItem("nexvar-lang") as Lang | null;
    if (stored === "en" || stored === "fr") setLang(stored);
  }, []);

  function toggle() {
    const next = lang === "en" ? "fr" : "en";
    setLang(next);
    localStorage.setItem("nexvar-lang", next);
  }

  function t(en: string, fr: string): string {
    return lang === "fr" ? fr : en;
  }

  return (
    <LangContext.Provider value={{ lang, toggle, t }}>
      {children}
    </LangContext.Provider>
  );
}
