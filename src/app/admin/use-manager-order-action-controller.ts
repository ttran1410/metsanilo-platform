"use client";

import type { FormEvent } from "react";
import type { orders } from "@/db/schema";

type Order = typeof orders.$inferSelect;
type OrderDetail = { order: Order; notes: unknown[]; payments: unknown[]; audit: unknown[]; paymentSummary: { paidCents: number; refundedCents: number; outstandingCents: number; status: string } };

export function useManagerOrderActionController({ detail, onFeeUpdated, feedback, refreshDetail }: { detail: OrderDetail | null; onFeeUpdated: (order: Order) => void; feedback: (text: string, tone: "success" | "error") => void; refreshDetail: (order: Order) => Promise<void> }) {
  async function detailAction(event: FormEvent<HTMLFormElement>, action: "note" | "fee" | "payment") {
    event.preventDefault(); if (!detail) return;
    const values = new FormData(event.currentTarget);
    const endpoint = action === "note" ? "notes" : action === "fee" ? "delivery-fee" : "payment";
    const payload = action === "note" ? { body: values.get("body") } : action === "fee" ? { expectedVersion: detail.order.version, deliveryFeeCents: Math.round(Number(values.get("feeEuros")) * 100) } : { amountCents: Math.round(Number(values.get("paymentEuros")) * 100), method: values.get("method"), reference: String(values.get("reference") ?? "").trim() || undefined };
    try {
      const response = await fetch(`/api/admin/orders/${detail.order.id}/${endpoint}`, { method: action === "fee" ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) return feedback(body.code ?? body.message ?? "Request failed", "error");
      if (action === "fee") onFeeUpdated(body.data);
      else await refreshDetail(detail.order);
      feedback("Order updated.", "success");
      event.currentTarget.reset();
    } catch { feedback("Network error while updating order.", "error"); }
  }
  return { detailAction };
}
