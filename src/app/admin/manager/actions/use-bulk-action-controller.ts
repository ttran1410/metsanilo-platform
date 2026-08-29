"use client";

import type { Dispatch, SetStateAction } from "react";
import type { orders } from "@/db/schema";

type Order = typeof orders.$inferSelect;

export function useManagerBulkActionController({ pendingBulk, orderRows, selectedIds, setPendingBulk, setOrderRows, setSelectedIds, feedback }: { pendingBulk: string | null; orderRows: Order[]; selectedIds: string[]; setPendingBulk: (value: string | null) => void; setOrderRows: Dispatch<SetStateAction<Order[]>>; setSelectedIds: (ids: string[]) => void; feedback: (text: string, tone: "success" | "error") => void }) {
  async function confirmBulkTransition() {
    if (!pendingBulk) return;
    setPendingBulk(null);
    const selected = orderRows.filter((order) => selectedIds.includes(order.id));
    const updated: Order[] = [];
    let skipped = 0;
    await Promise.all(selected.map(async (order) => {
      try {
        const response = await fetch(`/api/admin/orders/${order.id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: pendingBulk, expectedVersion: order.version }) });
        const body = await response.json();
        if (response.ok) updated.push(body.data as Order); else skipped += 1;
      } catch { skipped += 1; }
    }));
    setOrderRows((rows) => rows.map((row) => updated.find((item) => item.id === row.id) ?? row));
    setSelectedIds([]);
    feedback(`${updated.length} order(s) updated${skipped ? `, ${skipped} skipped because they changed or were not eligible` : ""}.`, skipped ? "error" : "success");
  }
  return { confirmBulkTransition };
}
