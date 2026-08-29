"use client";

export function useCutoffActionController({ onError, onSuccess }: { onError: (message: string) => void; onSuccess: (value: "OPEN" | "CLOSED" | null) => void }) {
  return async function updateCutoff(row: { id: string; version: number; capacityMl: number; manualSoldOut: boolean; acceptsOrders: boolean; manualSoldOutReason?: string | null }, value: "OPEN" | "CLOSED" | null) {
    try {
      const response = await fetch(`/api/admin/availability/${row.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: row.version, capacityMl: row.capacityMl, manualSoldOut: row.manualSoldOut, acceptsOrders: row.acceptsOrders, cutoffOverride: value, soldOutReason: row.manualSoldOutReason ?? undefined }) });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) return onError(body.message ?? "Could not update cutoff override.");
      onSuccess(value);
    } catch { onError("An unexpected network error occurred."); }
  };
}
