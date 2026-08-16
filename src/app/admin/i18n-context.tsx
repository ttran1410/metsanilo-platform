"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { adminDictionary, type AdminLocale } from "./i18n-dictionary";

type AdminI18nContextType = {
  locale: AdminLocale;
  setLocale: (locale: AdminLocale) => void;
  t: (key: string, fallback?: string) => string;
  dict: Record<string, string>;
};

const AdminI18nContext = createContext<AdminI18nContextType | null>(null);

const STORAGE_KEY = "metsanilo-admin-lang";

export function AdminI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as AdminLocale | null;
      if (saved && (saved === "en" || saved === "fi" || saved === "vi")) {
        setLocaleState(saved);
      }
    } catch {
      /* Preference is optional */
    }
  }, []);

  function setLocale(next: AdminLocale) {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Preference is optional */
    }
  }

  function t(key: string, fallback?: string): string {
    return adminDictionary[locale]?.[key] ?? adminDictionary.en?.[key] ?? fallback ?? key;
  }

  const value: AdminI18nContextType = {
    locale,
    setLocale,
    t,
    dict: adminDictionary[locale] ?? adminDictionary.en,
  };

  return <AdminI18nContext.Provider value={value}>{children}</AdminI18nContext.Provider>;
}

export function useAdminI18n(): AdminI18nContextType {
  const context = useContext(AdminI18nContext);
  if (!context) {
    // Fallback if rendered outside Provider
    return {
      locale: "en",
      setLocale: () => undefined,
      t: (key: string, fallback?: string) => adminDictionary.en[key] ?? fallback ?? key,
      dict: adminDictionary.en,
    };
  }
  return context;
}
