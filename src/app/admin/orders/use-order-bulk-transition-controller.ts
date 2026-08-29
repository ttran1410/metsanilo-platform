"use client";

import { useCallback } from "react";
import type { OrderStatus } from "@/domain/order-transitions";
import type { AdminOrder } from "../orders-listing";

export function useOrderBulkTransitionController({ pending, reason, onClearSelection, onComplete, onError, refresh }: { pending: { target: OrderStatus; orders: AdminOrder[] } | null; reason: string; onClearSelection: () => void; onComplete: (message: string) => void; onError: (message: string) => void; refresh: () => Promise<void> }) {
  return useCallback(async () => {
    if (!pending) return;
    try {
      for (const order of pending.orders) {
        const response = await fetch(`/api/admin/orders/${order.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "transition", status: pending.target, expectedVersion: order.version, reason: reason.trim() || undefined }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? `Transition failed for ${order.publicReference}`);
      }
      onComplete(`Updated ${pending.orders.length} order(s) to ${pending.target.replaceAll("_", " ")}.`);
      onClearSelection();
      await refresh();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Batch transition failed.");
    }
  }, [onClearSelection, onComplete, onError, pending, reason, refresh]);
}
