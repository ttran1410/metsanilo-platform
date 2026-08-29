"use client";

import { useCallback } from "react";
import type { OrderStatus } from "@/domain/order-transitions";
import type { AdminOrder } from "../types/admin-order";
import { transitionOrder } from "./order-admin-actions";

export function useOrderBulkTransitionController({ pending, reason, onClearSelection, onComplete, onError, refresh }: { pending: { target: OrderStatus; orders: AdminOrder[] } | null; reason: string; onClearSelection: () => void; onComplete: (message: string) => void; onError: (message: string) => void; refresh: () => Promise<void> }) {
  return useCallback(async () => {
    if (!pending) return;
    try {
      for (const order of pending.orders) {
        await transitionOrder({ orderId: order.id, status: pending.target, expectedVersion: order.version, reason });
      }
      onComplete(`Updated ${pending.orders.length} order(s) to ${pending.target.replaceAll("_", " ")}.`);
      onClearSelection();
      await refresh();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Batch transition failed.");
    }
  }, [onClearSelection, onComplete, onError, pending, reason, refresh]);
}
