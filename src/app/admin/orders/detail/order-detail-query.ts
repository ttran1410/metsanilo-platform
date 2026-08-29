import type { orders } from "@/db/schema";

export type OrderDetailOrder = typeof orders.$inferSelect & { paidCents?: number; outstandingCents?: number | null; paymentStatus?: string };
export type OrderDetail = {
  order: OrderDetailOrder;
  notes: Array<{ id: string; body: string; actor: string; createdAt: string }>;
  audit: Array<{ id: string; action: string; actor: string; createdAt: string }>;
  paymentSummary: { paidCents: number; refundedCents: number; outstandingCents: number; status: string };
};

export async function fetchOrderDetail(orderId: string, signal?: AbortSignal): Promise<OrderDetail> {
  const response = await fetch(`/api/admin/orders/${orderId}`, { cache: "no-store", signal, headers: { "x-admin-request-scope": "order-inspector-detail" } });
  const body = await response.json().catch(() => ({})) as { data?: OrderDetail; message?: string };
  if (!response.ok || !body.data) throw new Error(body.message ?? "Order details unavailable.");
  return body.data;
}
