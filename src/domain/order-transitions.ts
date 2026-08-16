export const ORDER_STATUSES = [
  "NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED",
  "CUSTOMER_DECLINED", "CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW", "REFUNDED",
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];
export type FulfillmentMethod = "PICKUP" | "DELIVERY";

export type TransitionOrder = {
  status: string;
  fulfillmentMethod: string;
  finalTotalCents?: number | null;
};

export type OrderTransition = {
  status: OrderStatus;
  label: string;
  requiresReason: boolean;
  available: boolean;
  blockedReason?: string;
};

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ["CONFIRMED", "CUSTOMER_DECLINED", "CANCELLED"],
  CONFIRMED: ["PICKING", "CANCELLED", "CANCELLED_BY_CUSTOMER"],
  PICKING: ["READY", "CANCELLED", "CANCELLED_BY_CUSTOMER"],
  READY: ["PICKED_UP", "OUT_FOR_DELIVERY", "CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW"],
  PICKED_UP: ["REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CUSTOMER_DECLINED: [], CANCELLED: [], CANCELLED_BY_CUSTOMER: [], REJECTED: [], NO_SHOW: [], REFUNDED: [],
};

const LABELS: Record<OrderStatus, string> = {
  NEW: "New", CONFIRMED: "Confirmed", PICKING: "Picking", READY: "Ready", OUT_FOR_DELIVERY: "Out for delivery",
  PICKED_UP: "Picked up", DELIVERED: "Delivered", CUSTOMER_DECLINED: "Decline order", CANCELLED: "Cancel order",
  CANCELLED_BY_CUSTOMER: "Mark customer-cancelled", REJECTED: "Reject order", NO_SHOW: "Mark no-show", REFUNDED: "Refunded",
};

const REASON_REQUIRED = new Set<OrderStatus>(["CUSTOMER_DECLINED", "CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW", "REFUNDED"]);
const HANDOVER_STATUSES = new Set<OrderStatus>(["PICKED_UP", "OUT_FOR_DELIVERY"]);

export function getLegalOrderTransitions(order: TransitionOrder): OrderTransition[] {
  const statuses = TRANSITIONS[order.status as OrderStatus] ?? [];
  return statuses.filter((status) => {
    if (status === "PICKED_UP") return order.fulfillmentMethod === "PICKUP";
    if (status === "OUT_FOR_DELIVERY") return order.fulfillmentMethod === "DELIVERY";
    return true;
  }).map((status) => {
    const blockedReason = HANDOVER_STATUSES.has(status) && order.finalTotalCents == null ? "Resolve the order total before handover" : undefined;
    return { status, label: LABELS[status], requiresReason: REASON_REQUIRED.has(status), available: !blockedReason, blockedReason };
  });
}

/** Actions shown in fulfillment controls. Refunds remain in the payment workflow. */
export function getFulfillmentActions(order: TransitionOrder) {
  return getLegalOrderTransitions(order).filter((action) => action.status !== "REFUNDED");
}

export function getLifecycleSteps(method: string): OrderStatus[] {
  return method === "PICKUP" ? ["NEW", "CONFIRMED", "PICKING", "READY", "PICKED_UP"] : ["NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"];
}

export const EXCEPTION_BRANCHES: Array<{ status: OrderStatus; label: string; description: string }> = [
  { status: "CUSTOMER_DECLINED", label: "Customer declined", description: "Customer did not confirm" },
  { status: "CANCELLED", label: "Cancelled", description: "Staff cancellation" },
  { status: "CANCELLED_BY_CUSTOMER", label: "Customer-cancelled", description: "Customer cancelled" },
  { status: "REJECTED", label: "Rejected", description: "Fulfillment rejected" },
  { status: "NO_SHOW", label: "No-show", description: "Customer did not arrive" },
];
