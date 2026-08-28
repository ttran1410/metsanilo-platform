"use client";

export function useOrderNoteActionController({ onError }: { onError: (message: string) => void }) {
  return async function addNote(orderId: string, note: string) {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/notes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: note }) });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) { onError(body.message ?? "Could not add note."); return false; }
      return true;
    } catch { onError("An unexpected network error occurred."); return false; }
  };
}
