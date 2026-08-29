"use client";

import type { ReactNode } from "react";

export function ManagerOrderInspector({ children }: { children: ReactNode }) {
  return <div className="mt-4 grid gap-3 border-t pt-4">{children}</div>;
}
