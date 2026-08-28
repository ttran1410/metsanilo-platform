"use client";

export function useOrderStatusActionController({ onError, onSuccess }: { onError: (message: string) => void; onSuccess: () => void }) {
  return async function transition(order: { id: string; version: number }, status: string, reason?: string) {
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, expectedVersion: order.version, reason: reason || undefined, contactChannel: status === "CONFIRMED" ? "PHONE" : undefined }) });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) return onError(body.message ?? "Status update failed.");
      onSuccess();
    } catch { onError("An unexpected network error occurred."); }
  };
}
