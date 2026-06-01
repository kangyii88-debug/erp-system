import zh from "../../locales/zh/common.json";
import ko from "../../locales/ko/common.json";
import type { Language } from "./types";

export const STORAGE_KEY = "coupang-erp-language";
export const DEFAULT_LANGUAGE: Language = "zh";

export const dictionaries = {
  zh,
  ko
} as const;

export type Dictionary = typeof zh;
export type TranslationKey = keyof Dictionary;

export function isLanguage(value: unknown): value is Language {
  return value === "zh" || value === "ko";
}

export function detectBrowserLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLanguage(stored)) return stored;

  const languages = window.navigator.languages?.length ? window.navigator.languages : [window.navigator.language];
  const normalized = languages.map((item) => item.toLowerCase());
  if (normalized.some((item) => item.startsWith("ko"))) return "ko";
  return "zh";
}

export function translate(language: Language, key: TranslationKey, params?: Record<string, string | number>) {
  let value = dictionaries[language][key] ?? dictionaries[DEFAULT_LANGUAGE][key] ?? key;

  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replaceAll(`{{${paramKey}}}`, String(paramValue));
    }
  }

  return value;
}
