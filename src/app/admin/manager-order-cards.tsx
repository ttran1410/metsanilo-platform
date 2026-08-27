"use client";

import type { ReactNode } from "react";

export function ManagerOrderCards({ children }: { children: ReactNode }) {
  return <div className="mt-3 grid gap-3">{children}</div>;
}
