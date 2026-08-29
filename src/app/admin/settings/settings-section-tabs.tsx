"use client";

import type { ReactNode } from "react";

export function SettingsSectionTabs({ children }: { children: ReactNode }) {
  return <nav className="settings-section-tabs" aria-label="Settings sections">{children}</nav>;
}
