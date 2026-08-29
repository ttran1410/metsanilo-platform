"use client";

import Link from "next/link";
import { Download, List, PackageCheck, Plus, Store } from "lucide-react";
import type { WorkspaceMode } from "./list/orders-url-state";

export function OrdersWorkspaceToolbar({ mode, canCreate, onModeChange, onOpenPackingSlip }: { mode: WorkspaceMode; canCreate: boolean; onModeChange: (mode: WorkspaceMode) => void; onOpenPackingSlip: () => void }) {
  return <div className="flex flex-wrap items-center gap-2">
    <div className="orders-mode-switch" role="tablist" aria-label="Order workspace">
      <button type="button" role="tab" aria-selected={mode === "TABLE"} className={mode === "TABLE" ? "is-active" : ""} onClick={() => onModeChange("TABLE")}><List aria-hidden="true" />Queue</button>
      <button type="button" role="tab" aria-selected={mode === "KANBAN"} className={mode === "KANBAN" ? "is-active" : ""} onClick={() => onModeChange("KANBAN")}><PackageCheck aria-hidden="true" />Packing</button>
      <button type="button" role="tab" aria-selected={mode === "TERMINAL"} className={mode === "TERMINAL" ? "is-active" : ""} onClick={() => onModeChange("TERMINAL")}><Store aria-hidden="true" />Pickup</button>
    </div>
    <button type="button" className="btn btn-secondary text-xs py-1.5 px-3 font-semibold" onClick={onOpenPackingSlip}><Download aria-hidden="true" />Packing slip</button>
    {canCreate && <Link className="btn text-xs py-1.5 px-3 font-bold" href="/admin/manual-orders"><Plus aria-hidden="true" />New order</Link>}
  </div>;
}
