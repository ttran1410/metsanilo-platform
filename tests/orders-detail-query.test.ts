import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOrderDetail } from "@/app/admin/orders/detail/order-detail-query";

afterEach(() => vi.restoreAllMocks());

describe("Orders detail query contract", () => {
  it("uses the inspector request scope and forwards abort signals", async () => {
    const detail = { order: { id: "order-1" }, notes: [], audit: [], paymentSummary: { paidCents: 0, refundedCents: 0, outstandingCents: 0, status: "UNPAID" } };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: detail }), { status: 200, headers: { "content-type": "application/json" } }));
    const controller = new AbortController();
    await fetchOrderDetail("order-1", controller.signal);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/orders/order-1", expect.objectContaining({ cache: "no-store", signal: controller.signal, headers: { "x-admin-request-scope": "order-inspector-detail" } }));
  });

  it("returns a safe error when the detail envelope is unsuccessful", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Order details unavailable." }), { status: 404 }));
    await expect(fetchOrderDetail("missing-order")).rejects.toThrow("Order details unavailable.");
  });
});
