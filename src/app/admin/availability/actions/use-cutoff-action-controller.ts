"use client";

import { updateAvailability } from "./availability-admin-actions";

export function useCutoffActionController({ onError, onSuccess }: { onError: (message: string) => void; onSuccess: (value: "OPEN" | "CLOSED" | null) => void }) {
  return async function updateCutoff(row: { id: string; version: number; capacityMl: number; manualSoldOut: boolean; acceptsOrders: boolean; manualSoldOutReason?: string | null }, value: "OPEN" | "CLOSED" | null) {
    try {
      await updateAvailability({ id: row.id, expectedVersion: row.version, capacityMl: row.capacityMl, manualSoldOut: row.manualSoldOut, acceptsOrders: row.acceptsOrders, cutoffOverride: value, soldOutReason: row.manualSoldOutReason });
      onSuccess(value);
    } catch (error) { onError(error instanceof Error ? error.message : "An unexpected network error occurred."); }
  };
}
