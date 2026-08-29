"use client";

import type { ReactNode } from "react";

export function CustomerSavedViews({ children }: { children: ReactNode }) {
  return <div className="customers-saved-views" role="tablist" aria-label="Customer saved views">{children}</div>;
}
