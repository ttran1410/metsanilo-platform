"use client";

export function useOrderStatusActionController({ onError, onSuccess }: { onError: (message: string) => void; onSuccess: (data: unknown) => void }) {
  return async function transition(order: { id: string; version: number }, status: string, reason?: string) {
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, expectedVersion: order.version, reason: reason || undefined, contactChannel: status === "CONFIRMED" ? "PHONE" : undefined }) });
      const body = await response.json().catch(() => ({})) as { message?: string; data?: unknown };
      if (!response.ok) { onError(body.message ?? "Status update failed."); return false; }
      onSuccess(body.data);
      return true;
    } catch { onError("An unexpected network error occurred."); return false; }
  };
}
