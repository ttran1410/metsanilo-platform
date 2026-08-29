"use client";

export function useFreezeActionController({ onError, onSuccess }: { onError: (message: string) => void; onSuccess: (locked: boolean, reason: string) => void }) {
  return async function updateFreeze(row: { id: string; version: number; capacityMl: number; reservedMl: number; soldOut: boolean; businessDate: string }, reason: string) {
    const locking = !row.soldOut;
    if (!locking && row.capacityMl <= row.reservedMl) return onError("Increase capacity before reopening this date. Remaining capacity must fit at least one active package.");
    try {
      const response = await fetch(`/api/admin/availability/${row.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: row.version, capacityMl: row.capacityMl, manualSoldOut: locking, acceptsOrders: !locking, soldOutReason: locking ? reason : undefined }) });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) return onError(body.message ?? "Could not update sold-out lock.");
      onSuccess(locking, reason);
    } catch { onError("An unexpected network error occurred."); }
  };
}
