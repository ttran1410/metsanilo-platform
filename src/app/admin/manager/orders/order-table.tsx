"use client";

import type { ReactNode } from "react";

export function ManagerOrderTable({ children }: { children: ReactNode }) {
  return <div className="admin-orders-table-wrap card mt-3">{children}</div>;
}
