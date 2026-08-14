"use client";

import { useEffect } from "react";

export function LocaleDocument({ locale }: { locale: "fi" | "en" }) {
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return null;
}
