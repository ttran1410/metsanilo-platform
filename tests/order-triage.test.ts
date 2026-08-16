import { describe, expect, it } from "vitest";
import { getOrderTriageReasons, orderTriageScore, type OrderTriageInput } from "@/domain/order-triage";

const now = new Date("2026-08-16T09:00:00.000Z");
const base: OrderTriageInput = {
  status: "CONFIRMED",
  createdAt: "2026-08-16T08:50:00.000Z",
  fulfillmentDate: "2026-08-16",
  fulfillmentMethod: "PICKUP",
  paymentStatus: "PAID",
};

describe("operations triage", () => {
  it("keeps healthy orders out of the exception queue", () => {
    expect(getOrderTriageReasons(base, now)).toEqual([]);
  });

  it("prioritizes new orders waiting more than fifteen minutes", () => {
    const reasons = getOrderTriageReasons({ ...base, status: "NEW", createdAt: "2026-08-16T08:30:00.000Z" }, now);
    expect(reasons[0]).toMatchObject({ code: "OVERDUE_NEW", severity: "urgent" });
    expect(reasons[0].label).toBe("Waiting 30 min");
  });

  it("surfaces incomplete delivery data", () => {
    const reasons = getOrderTriageReasons({ ...base, fulfillmentMethod: "DELIVERY", deliveryFeeCents: null, streetAddress: null, postalCode: null, city: null }, now);
    expect(reasons.map(({ code }) => code)).toEqual(["ADDRESS_MISSING", "DELIVERY_FEE_MISSING"]);
  });

  it("flags unpaid handover work without reopening completed fulfillment", () => {
    const reasons = getOrderTriageReasons({ ...base, status: "DELIVERED", fulfillmentMethod: "DELIVERY", paymentStatus: "UNPAID" }, now);
    expect(reasons).toHaveLength(1);
    expect(reasons[0].code).toBe("PAYMENT_DUE");
  });

  it("assigns urgent work a higher ranking", () => {
    const overdue = orderTriageScore({ ...base, status: "NEW", createdAt: "2026-08-16T08:00:00.000Z" }, now);
    const missingFee = orderTriageScore({ ...base, fulfillmentMethod: "DELIVERY", streetAddress: "Road 1", postalCode: "00100", city: "Helsinki", deliveryFeeCents: null }, now);
    expect(overdue).toBeGreaterThan(missingFee);
  });
});
