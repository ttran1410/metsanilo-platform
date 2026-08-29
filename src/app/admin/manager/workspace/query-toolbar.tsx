"use client";

import type { ReactNode } from "react";

export function ManagerQueryToolbar({ children }: { children: ReactNode }) {
  return <div className="admin-orders-toolbar">{children}</div>;
}
