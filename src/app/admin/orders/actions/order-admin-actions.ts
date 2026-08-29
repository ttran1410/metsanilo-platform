import type { OrderStatus } from "@/domain/order-transitions";

export type OrderStatusTransitionCommand = {
  orderId: string;
  status: OrderStatus;
  expectedVersion: number;
  reason?: string;
};

export async function transitionOrder(command: OrderStatusTransitionCommand) {
  const response = await fetch(`/api/admin/orders/${command.orderId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "transition", status: command.status, expectedVersion: command.expectedVersion, reason: command.reason?.trim() || undefined }),
  });
  const body = await response.json().catch(() => ({})) as { data?: unknown; message?: string };
  if (!response.ok) throw new Error(body.message ?? "Order transition failed.");
  return body.data;
}
