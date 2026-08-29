"use client";

export type OrderDetailActionCommand =
  | { orderId: string; kind: "note"; payload: { body: string } }
  | { orderId: string; kind: "payment"; payload: { amountCents: number; method: string; reference?: string } }
  | { orderId: string; kind: "pricing"; payload: { expectedVersion: number; itemSubtotalCents: number; deliveryFeeCents: number | null; reason: unknown } }
  | { orderId: string; kind: "exception"; payload: { type: unknown; nextAction: unknown; note: unknown; rescheduledDate?: string } };

export function useOrderDetailActionController({ onError }: { onError: (message: string) => void }) {
  return async function submit(command: OrderDetailActionCommand) {
    const { orderId, kind, payload } = command;
    const endpoint = kind === "note" ? "notes" : kind === "payment" ? "payment" : kind === "pricing" ? "pricing" : "delivery-exception";
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/${endpoint}`, { method: kind === "pricing" ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({})) as { data?: unknown; message?: string; code?: string };
      if (!response.ok) { onError(body.message ?? body.code ?? "Order update failed"); return { ok: false, data: undefined }; }
      return { ok: true, data: body.data };
    } catch { onError("An unexpected network error occurred."); return { ok: false, data: undefined }; }
  };
}
