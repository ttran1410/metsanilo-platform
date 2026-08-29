"use client";

import { updateAvailability } from "./availability-admin-actions";

export function useSaveAvailabilityActionController({ onError, onSuccess }: { onError: (message: string) => void; onSuccess: () => void }) {
  return async function save(input: { id: string; version: number; capacityMl: number; manualSoldOut: boolean; soldOutReason?: string | null }) {
    try {
      await updateAvailability({ id: input.id, expectedVersion: input.version, capacityMl: input.capacityMl, manualSoldOut: input.manualSoldOut, soldOutReason: input.soldOutReason });
      onSuccess();
    } catch (error) { onError(error instanceof Error ? error.message : "An unexpected network error occurred."); }
  };
}
