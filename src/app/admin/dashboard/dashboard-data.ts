export type DashboardData = {
  businessDate: string;
  asOf: string;
  unreadNotifications: number;
  attentionCount: number;
  overdueNew: Array<{ id: string; publicReference: string; customerName: string; createdAt: string; ageMinutes: number; mobile: string | null; email?: string | null; facebookProfile?: string | null; orderSource?: string | null; version?: number }>;
  unconfirmedDeliveryCount: number;
  funnel: { intake: { count: number; volumeLitres: number }; confirm: { count: number; volumeLitres: number }; packing: { count: number; volumeLitres: number }; ready: { count: number; volumeLitres: number }; done: { count: number; volumeLitres: number } };
  volume: { capacityLitres: number; reservedLitres: number; remainingLitres: number; percentage: number; pickupVolumeLitres: number; pickupCrates: number; deliveryVolumeLitres: number; deliveryCrates: number };
  financials: { grossBookedCents: number; collectedCents: number; outstandingCents: number; collectedPercentage: number; fulfilledSalesCents: number; fulfilledLitres: number };
  lookahead: Array<{ label: string; date: string; capacityLitres: number; reservedLitres: number; remainingLitres: number; percentage: number }>;
  attention: Array<{ id: string; orderId: string; publicReference: string; customerName: string; fulfillmentDate: string; status: string; label: string; severity: "urgent" | "attention" }>;
  activity: Array<{ id: string; actor: string; action: string; entityType: string; entityId: string; reference: string | null; createdAt: string }>;
};
