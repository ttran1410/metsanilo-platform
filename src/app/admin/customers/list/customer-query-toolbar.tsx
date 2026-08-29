"use client";

import type { ReactNode } from "react";

export function CustomerQueryToolbar({ children }: { children: ReactNode }) {
  return <div className="card customers-toolbar">{children}</div>;
}
