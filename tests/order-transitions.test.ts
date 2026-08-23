import { describe, expect, it } from "vitest";
import {
  EXCEPTION_BRANCHES,
  getFulfillmentActions,
  getLegalOrderTransitions,
  getLifecycleSteps,
} from "@/domain/order-transitions";

describe("order transition domain", () => {
  it("keeps pickup and delivery handover actions explicit", () => {
    const pickup = getFulfillmentActions({ status: "READY", fulfillmentMethod: "PICKUP", finalTotalCents: 1200 });
    const delivery = getFulfillmentActions({ status: "READY", fulfillmentMethod: "DELIVERY", finalTotalCents: 1200 });

    expect(pickup.map((action) => action.status)).toContain("PICKED_UP");
    expect(pickup.map((action) => action.status)).not.toContain("OUT_FOR_DELIVERY");
    expect(delivery.map((action) => action.status)).toContain("OUT_FOR_DELIVERY");
    expect(delivery.map((action) => action.status)).not.toContain("PICKED_UP");
  });

  it("blocks handover until the order total is resolved", () => {
    const actions = getLegalOrderTransitions({ status: "READY", fulfillmentMethod: "DELIVERY", finalTotalCents: null });
    const handover = actions.find((action) => action.status === "OUT_FOR_DELIVERY");

    expect(handover?.available).toBe(false);
    expect(handover?.blockedReason).toMatch(/order total/i);
  });

  it("marks exception transitions as requiring a reason", () => {
    const actions = getLegalOrderTransitions({ status: "NEW", fulfillmentMethod: "PICKUP", finalTotalCents: 1000 });
    expect(actions.find((action) => action.status === "CUSTOMER_DECLINED")?.requiresReason).toBe(true);
    expect(actions.find((action) => action.status === "CANCELLED")?.requiresReason).toBe(true);
  });

  it("requires confirmation before an order can enter packing", () => {
    const newOrder = getLegalOrderTransitions({ status: "NEW", fulfillmentMethod: "PICKUP", finalTotalCents: 1000 });
    const confirmedOrder = getLegalOrderTransitions({ status: "CONFIRMED", fulfillmentMethod: "PICKUP", finalTotalCents: 1000 });

    expect(newOrder.map((action) => action.status)).not.toContain("PICKING");
    expect(confirmedOrder.find((action) => action.status === "PICKING")?.available).toBe(true);
  });

  it("returns a method-specific lifecycle and shared exception branches", () => {
    expect(getLifecycleSteps("PICKUP")).toEqual(["NEW", "CONFIRMED", "PICKING", "READY", "PICKED_UP"]);
    expect(getLifecycleSteps("DELIVERY")).toContain("OUT_FOR_DELIVERY");
    expect(EXCEPTION_BRANCHES.map((branch) => branch.status)).toEqual(
      expect.arrayContaining(["CANCELLED", "REJECTED", "NO_SHOW"]),
    );
  });
});
