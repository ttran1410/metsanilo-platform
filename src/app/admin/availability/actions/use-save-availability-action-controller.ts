"use client";

export function useSaveAvailabilityActionController({ onError, onSuccess }: { onError: (message: string) => void; onSuccess: () => void }) {
  return async function save(input: { id: string; version: number; capacityMl: number; manualSoldOut: boolean; soldOutReason?: string | null }) {
    try {
      const response = await fetch(`/api/admin/availability/${input.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: input.version, capacityMl: input.capacityMl, manualSoldOut: input.manualSoldOut, soldOutReason: input.soldOutReason ?? undefined }) });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) return onError(body.message ?? "Could not save availability.");
      onSuccess();
    } catch { onError("An unexpected network error occurred."); }
  };
}
