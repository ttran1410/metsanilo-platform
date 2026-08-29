"use client";

import type { ReactNode } from "react";

export function CustomerInspector({ children }: { children: ReactNode }) {
  return <div className="customer-inspector">{children}</div>;
}
