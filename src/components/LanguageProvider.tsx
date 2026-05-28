"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { dictionaries } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n";
import type { Language } from "@/lib/types";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Dictionary;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("zh");
  const value = useMemo(() => ({ language, setLanguage, t: dictionaries[language] }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
