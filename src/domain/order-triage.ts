export type TriageSeverity = "urgent" | "attention";

export type OrderTriageInput = {
  status: string;
  createdAt: string;
  fulfillmentDate: string;
  fulfillmentMethod: string;
  streetAddress?: string | null;
  postalCode?: string | null;
  city?: string | null;
  deliveryFeeCents?: number | null;
  paymentStatus?: string | null;
};

export type TriageReason = {
  code: string;
  label: string;
  severity: TriageSeverity;
  score: number;
};

const CLOSED = new Set([
  "PICKED_UP",
  "DELIVERED",
  "CANCELLED",
  "CANCELLED_BY_CUSTOMER",
  "CUSTOMER_DECLINED",
  "REJECTED",
  "NO_SHOW",
  "REFUNDED",
]);

function helsinkiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki" }).format(date);
}

export function getOrderTriageReasons(order: OrderTriageInput, now = new Date()): TriageReason[] {
  const reasons: TriageReason[] = [];
  const ageMinutes = Math.floor((now.getTime() - new Date(order.createdAt).getTime()) / 60_000);
  const isOpen = !CLOSED.has(order.status);

  if (order.status === "NEW" && ageMinutes >= 15) {
    reasons.push({ code: "OVERDUE_NEW", label: `Waiting ${ageMinutes} min`, severity: "urgent", score: 120 + ageMinutes });
  }
  if (isOpen && order.fulfillmentDate < helsinkiDate(now)) {
    reasons.push({ code: "OVERDUE_FULFILLMENT", label: "Past fulfillment date", severity: "urgent", score: 115 });
  }
  if (order.fulfillmentMethod === "DELIVERY" && isOpen && (!order.streetAddress || !order.postalCode || !order.city)) {
    reasons.push({ code: "ADDRESS_MISSING", label: "Delivery address incomplete", severity: "urgent", score: 110 });
  }
  if (order.fulfillmentMethod === "DELIVERY" && isOpen && order.deliveryFeeCents == null) {
    reasons.push({ code: "DELIVERY_FEE_MISSING", label: "Delivery fee missing", severity: "attention", score: 80 });
  }
  if (["READY", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED"].includes(order.status) && order.paymentStatus === "UNPAID") {
    reasons.push({ code: "PAYMENT_DUE", label: "Payment outstanding", severity: "urgent", score: 105 });
  }
  if (["CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW"].includes(order.status)) {
    reasons.push({ code: "EXCEPTION_REVIEW", label: "Exception needs review", severity: "attention", score: 75 });
  }
  return reasons.sort((a, b) => b.score - a.score);
}

export function orderTriageScore(order: OrderTriageInput, now = new Date()) {
  return getOrderTriageReasons(order, now)[0]?.score ?? 0;
}
