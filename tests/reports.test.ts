import { describe, expect, it } from "vitest";
import { reportCsv } from "@/domain/reports";

describe("report CSV export", () => {
  it("quotes cells and keeps capacity annotations separate from litres", () => {
    const report = {
      meta: { from: "2026-08-01", to: "2026-08-07", groupBy: "day", currency: "EUR", timezone: "Europe/Helsinki", generatedAt: "2026-08-08T00:00:00.000Z", formulaVersion: "reporting-v1" },
      sales: { fulfilledOrders: 0, fulfilledLitresMl: 0, fulfilledSalesCents: 0, averageOrderValueCents: 0, deliveryFeeCents: 0, cancelledOrders: 0, timeline: [], productMix: [], methodMix: [], sourceMix: [] },
      capacity: { rows: [{ date: "2026-08-01", productId: "berries", configuredMl: 10000, reservedMl: 5000, remainingMl: 5000, manualSoldOut: true, manualSoldOutReason: "Weather" }], configuredMl: 10000, reservedMl: 5000, remainingMl: 5000, utilizationPercent: 50 },
      payments: { recordedPaymentsCents: 0, refundsCents: 0, netCashCents: 0, paymentCount: 0, refundCount: 0, events: [] },
      customers: { fulfilledCustomers: 0, repeatCustomers: 0, repeatRatePercent: 0, unlinkedOrders: 0, groups: [] },
    } as never;
    expect(reportCsv(report, "capacity")).toBe('"2026-08-01","berries","10000","5000","5000","manual sold-out"');
  });

  it("exports the filtered payment-event drill-down instead of an aggregate-only row", () => {
    const report = {
      payments: {
        events: [{ id: "payment-1", orderId: "order-1", orderReference: "MN-1042", kind: "REFUND", method: "CARD", amountCents: 1250, recordedAt: "2026-08-07T10:30:00.000Z" }],
      },
    } as never;

    expect(reportCsv(report, "payments")).toBe('"2026-08-07T10:30:00.000Z","MN-1042","REFUND","CARD","1250"');
  });
});
