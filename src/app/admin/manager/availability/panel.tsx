"use client";

import type { ReactNode } from "react";

export function ManagerAvailabilityPanel({ children }: { children: ReactNode }) {
  return <section id="availability" className="admin-availability-section mt-10">{children}</section>;
}
