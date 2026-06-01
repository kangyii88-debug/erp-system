"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LANGUAGE,
  STORAGE_KEY,
  detectBrowserLanguage,
  isLanguage,
  translate,
  type TranslationKey
} from "@/lib/i18n";
import type { Language } from "@/lib/types";

type InterpolationParams = Record<string, string | number>;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, params?: InterpolationParams) => string;
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const localeMap: Record<Language, string> = {
  zh: "zh-CN",
  ko: "ko-KR"
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    setLanguageState(detectBrowserLanguage());
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "ko" ? "ko-KR" : "zh-CN";
  }, [language]);

  const setLanguage = (nextLanguage: Language) => {
    if (!isLanguage(nextLanguage)) return;
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    setLanguageState(nextLanguage);
  };

  const value = useMemo<LanguageContextValue>(() => {
    const locale = localeMap[language];

    return {
      language,
      setLanguage,
      t: (key, params) => translate(language, key, params),
      formatDate: (value, options) =>
        new Intl.DateTimeFormat(locale, options ?? { year: "numeric", month: "2-digit", day: "2-digit" }).format(
          typeof value === "string" ? new Date(value) : value
        ),
      formatNumber: (value, options) => new Intl.NumberFormat(locale, options).format(value),
      formatCurrency: (value) =>
        new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "KRW",
          maximumFractionDigits: 0
        }).format(value)
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
