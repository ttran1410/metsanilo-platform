"use client";

import { updateAvailability } from "./availability-admin-actions";

export function useFreezeActionController({ onError, onSuccess }: { onError: (message: string) => void; onSuccess: (locked: boolean, reason: string) => void }) {
  return async function updateFreeze(row: { id: string; version: number; capacityMl: number; reservedMl: number; soldOut: boolean; businessDate: string }, reason: string) {
    const locking = !row.soldOut;
    if (!locking && row.capacityMl <= row.reservedMl) return onError("Increase capacity before reopening this date. Remaining capacity must fit at least one active package.");
    try {
      await updateAvailability({ id: row.id, expectedVersion: row.version, capacityMl: row.capacityMl, manualSoldOut: locking, acceptsOrders: !locking, soldOutReason: locking ? reason : undefined });
      onSuccess(locking, reason);
    } catch (error) { onError(error instanceof Error ? error.message : "An unexpected network error occurred."); }
  };
}
