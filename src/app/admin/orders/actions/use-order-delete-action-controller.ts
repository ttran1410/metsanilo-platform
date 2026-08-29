"use client";

export function useOrderDeleteActionController({ onError }: { onError: (message: string) => void }) {
  return async function deleteOrder(orderId: string) {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) { onError(body.message ?? "Delete failed"); return false; }
      return true;
    } catch { onError("An unexpected network error occurred."); return false; }
  };
}
