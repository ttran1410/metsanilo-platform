import { describe, expect, it } from "vitest";
import { parseJson } from "@/app/api/admin/module";
import { PUT as updatePaymentMethod } from "@/app/api/admin/payment-methods/[method]/route";
import { PATCH as updateFulfillmentLocation } from "@/app/api/admin/fulfillment-locations/[id]/route";
import { DELETE as deletePaymentMethod } from "@/app/api/admin/payment-methods/route";
import { DELETE as deleteFulfillmentLocation } from "@/app/api/admin/fulfillment-locations/route";
import { GET as getProducts } from "@/app/api/admin/products/route";
import { GET as getOrders } from "@/app/api/admin/orders/route";
import { GET as getReviews } from "@/app/api/admin/reviews/route";
import { GET as getCustomers } from "@/app/api/admin/customers/route";
import { GET as getUsers } from "@/app/api/admin/users/route";
import { GET as getAvailability } from "@/app/api/admin/availability/route";
import { GET as getNotifications } from "@/app/api/admin/notifications/route";
import { GET as getAudit } from "@/app/api/admin/audit/route";
import { GET as getSettings } from "@/app/api/admin/contact/route";
import { GET as getDashboard } from "@/app/api/admin/dashboard/route";
import { GET as getNavigationSummary } from "@/app/api/admin/navigation-summary/route";
import { GET as getMedia } from "@/app/api/admin/media/route";
import { GET as getTheme } from "@/app/api/admin/storefront-theme/route";
import { POST as runAutomation } from "@/app/api/admin/automation/run/route";
import { GET as getOrderMember } from "@/app/api/admin/orders/[id]/route";
import { POST as updateOrderStatus } from "@/app/api/admin/orders/[id]/status/route";
import { POST as addOrderNote } from "@/app/api/admin/orders/[id]/notes/route";
import { POST as recordOrderPayment } from "@/app/api/admin/orders/[id]/payment/route";
import { POST as refundOrder } from "@/app/api/admin/orders/[id]/refund/route";

describe("admin request module contract", () => {
  it("parses valid JSON bodies", async () => {
    await expect(parseJson(new Request("http://localhost", { method: "POST", body: JSON.stringify({ action: "update" }) }))).resolves.toEqual({ action: "update" });
  });

  it("turns malformed JSON into a validation error", async () => {
    await expect(parseJson(new Request("http://localhost", { method: "POST", body: "{" }))).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422 });
  });

  it("keeps compatibility member routes on the JSON error envelope", async () => {
    const payment = await updatePaymentMethod(new Request("http://localhost/api/admin/payment-methods/CASH", { method: "PUT", body: "{" }), { params: Promise.resolve({ method: "CASH" }) });
    const fulfillment = await updateFulfillmentLocation(new Request("http://localhost/api/admin/fulfillment-locations/location-1", { method: "PATCH", body: "{" }), { params: Promise.resolve({ id: "location-1" }) });
    expect(payment.status).toBe(422);
    expect(fulfillment.status).toBe(422);
    expect(payment.headers.get("content-type")).toContain("application/json");
    expect(fulfillment.headers.get("content-type")).toContain("application/json");
    expect((await payment.json())).toMatchObject({ code: "VALIDATION_ERROR", correlationId: expect.any(String) });
    expect((await fulfillment.json())).toMatchObject({ code: "VALIDATION_ERROR", correlationId: expect.any(String) });
  });

  it("keeps canonical DELETE requests behind authentication", async () => {
    const payment = await deletePaymentMethod(new Request("http://localhost/api/admin/payment-methods", { method: "DELETE" }));
    const fulfillment = await deleteFulfillmentLocation(new Request("http://localhost/api/admin/fulfillment-locations", { method: "DELETE" }));
    expect(payment.status).toBe(401);
    expect(fulfillment.status).toBe(401);
    expect(await payment.json()).toMatchObject({ code: "UNAUTHORIZED", correlationId: expect.any(String) });
    expect(await fulfillment.json()).toMatchObject({ code: "UNAUTHORIZED", correlationId: expect.any(String) });
  });

  it("keeps canonical collection reads behind authentication", async () => {
    const responses = await Promise.all([
      getProducts(new Request("http://localhost/api/admin/products")),
      getOrders(new Request("http://localhost/api/admin/orders")),
      getReviews(new Request("http://localhost/api/admin/reviews")),
      getCustomers(new Request("http://localhost/api/admin/customers")),
      getUsers(new Request("http://localhost/api/admin/users")),
      getAvailability(new Request("http://localhost/api/admin/availability")),
      getNotifications(new Request("http://localhost/api/admin/notifications")),
      getAudit(new Request("http://localhost/api/admin/audit")),
      getSettings(new Request("http://localhost/api/admin/contact")),
      getDashboard(new Request("http://localhost/api/admin/dashboard")),
      getNavigationSummary(new Request("http://localhost/api/admin/navigation-summary")),
      getMedia(new Request("http://localhost/api/admin/media")),
      getTheme(new Request("http://localhost/api/admin/storefront-theme")),
      runAutomation(new Request("http://localhost/api/admin/automation/run", { method: "POST" })),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED", correlationId: expect.any(String) });
    }
  });

  it("keeps Order member and action routes behind authentication", async () => {
    const params = Promise.resolve({ id: "order-1" });
    const responses = await Promise.all([
      getOrderMember(new Request("http://localhost/api/admin/orders/order-1"), { params }),
      updateOrderStatus(new Request("http://localhost/api/admin/orders/order-1/status", { method: "POST", body: "{}" }), { params }),
      addOrderNote(new Request("http://localhost/api/admin/orders/order-1/notes", { method: "POST", body: "{}" }), { params }),
      recordOrderPayment(new Request("http://localhost/api/admin/orders/order-1/payment", { method: "POST", body: "{}" }), { params }),
      refundOrder(new Request("http://localhost/api/admin/orders/order-1/refund", { method: "POST", body: "{}" }), { params }),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED", correlationId: expect.any(String) });
    }
  });
});
