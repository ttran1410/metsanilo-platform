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
import { PATCH as updateOrderMember } from "@/app/api/admin/orders/[id]/route";
import { GET as getCustomerMember } from "@/app/api/admin/customers/[id]/route";
import { POST as anonymizeCustomer } from "@/app/api/admin/customers/[id]/route";
import { PATCH as updateCustomerMember } from "@/app/api/admin/customers/[id]/route";
import { POST as confirmContact } from "@/app/api/admin/customers/[id]/contact-confirmation/route";
import { GET as getUserMember } from "@/app/api/admin/users/[id]/route";
import { PATCH as updateUser } from "@/app/api/admin/users/[id]/route";
import { POST as resetPassword } from "@/app/api/admin/users/[id]/password/route";
import { PUT as updatePermission } from "@/app/api/admin/users/[id]/permissions/route";
import { GET as getProductMember } from "@/app/api/admin/products/[id]/route";
import { DELETE as deleteProduct } from "@/app/api/admin/products/[id]/route";
import { PATCH as reorderProducts } from "@/app/api/admin/products/route";
import { PATCH as reorderPackages } from "@/app/api/admin/products/[id]/packages/route";
import { GET as getSeasons } from "@/app/api/admin/products/[id]/seasons/route";
import { PUT as updateReviewVisibility } from "@/app/api/admin/reviews/visibility/route";
import { PUT as updateAvailability } from "@/app/api/admin/availability/[id]/route";
import { POST as publishTheme } from "@/app/api/admin/storefront-theme/drafts/[draftId]/publish/route";
import { POST as rollbackTheme } from "@/app/api/admin/storefront-theme/versions/[versionId]/rollback/route";

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

  it("keeps Settings operational mutations behind authentication", async () => {
    const payment = await updatePaymentMethod(new Request("http://localhost/api/admin/payment-methods/CASH", { method: "PUT", body: JSON.stringify({ method: "CASH", enabled: true }) }), { params: Promise.resolve({ method: "CASH" }) });
    const fulfillment = await updateFulfillmentLocation(new Request("http://localhost/api/admin/fulfillment-locations/location-1", { method: "PATCH", body: JSON.stringify({ id: "location-1", nameFi: "Pori", nameEn: "Pori", type: "PICKUP", address: "Market street 1" }) }), { params: Promise.resolve({ id: "location-1" }) });
    for (const response of [payment, fulfillment]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED", correlationId: expect.any(String) });
    }
  });

  it("keeps Storefront theme transitions behind authentication", async () => {
    const publish = await publishTheme(new Request("http://localhost/api/admin/storefront-theme/drafts/draft-1", { method: "POST" }), { params: Promise.resolve({ draftId: "draft-1" }) });
    const rollback = await rollbackTheme(new Request("http://localhost/api/admin/storefront-theme/versions/version-1", { method: "POST" }), { params: Promise.resolve({ versionId: "version-1" }) });
    for (const response of [publish, rollback]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED", correlationId: expect.any(String) });
    }
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

  it("keeps Customer and User member/action routes behind authentication", async () => {
    const customerParams = Promise.resolve({ id: "customer-1" });
    const userParams = Promise.resolve({ id: "user-1" });
    const responses = await Promise.all([
      getCustomerMember(new Request("http://localhost/api/admin/customers/customer-1"), { params: customerParams }),
      anonymizeCustomer(new Request("http://localhost/api/admin/customers/customer-1", { method: "POST" }), { params: customerParams }),
      confirmContact(new Request("http://localhost/api/admin/customers/customer-1/contact-confirmation", { method: "POST", body: JSON.stringify({ channel: "PHONE" }) }), { params: customerParams }),
      getUserMember(new Request("http://localhost/api/admin/users/user-1"), { params: userParams }),
      updateUser(new Request("http://localhost/api/admin/users/user-1", { method: "PATCH", body: JSON.stringify({ action: "update", displayName: "Test User" }) }), { params: userParams }),
      resetPassword(new Request("http://localhost/api/admin/users/user-1/password", { method: "POST" }), { params: userParams }),
      updatePermission(new Request("http://localhost/api/admin/users/user-1/permissions", { method: "PUT", body: JSON.stringify({ permission: "orders.read", granted: true }) }), { params: userParams }),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED", correlationId: expect.any(String) });
    }
  });

  it("keeps Product, Review, and Availability action routes behind authentication", async () => {
    const productParams = Promise.resolve({ id: "product-1" });
    const responses = await Promise.all([
      getProductMember(new Request("http://localhost/api/admin/products/product-1"), { params: productParams }),
      deleteProduct(new Request("http://localhost/api/admin/products/product-1", { method: "DELETE" }), { params: productParams }),
      reorderPackages(new Request("http://localhost/api/admin/products/product-1/packages", { method: "PATCH", body: JSON.stringify({ packageIds: [] }) }), { params: productParams }),
      getSeasons(new Request("http://localhost/api/admin/products/product-1/seasons"), { params: productParams }),
      updateReviewVisibility(new Request("http://localhost/api/admin/reviews/visibility", { method: "PUT", body: JSON.stringify({ visible: true }) })),
      updateAvailability(new Request("http://localhost/api/admin/availability/availability-1", { method: "PUT", body: JSON.stringify({ expectedVersion: 1, capacityMl: 1000, manualSoldOut: false }) }), { params: Promise.resolve({ id: "availability-1" }) }),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED", correlationId: expect.any(String) });
    }
  });

  it("authenticates Availability commands before parsing malformed input", async () => {
    const response = await updateAvailability(new Request("http://localhost/api/admin/availability/availability-1", { method: "PUT", body: "{" }), { params: Promise.resolve({ id: "availability-1" }) });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED", correlationId: expect.any(String) });
  });

  it("authenticates Product collection commands before parsing malformed input", async () => {
    const response = await reorderProducts(new Request("http://localhost/api/admin/products", { method: "PATCH", body: "{" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED", correlationId: expect.any(String) });
  });

  it("authenticates Order member commands before parsing malformed input", async () => {
    const response = await updateOrderMember(new Request("http://localhost/api/admin/orders/order-1", { method: "PATCH", body: "{" }), { params: Promise.resolve({ id: "order-1" }) });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED", correlationId: expect.any(String) });
  });

  it("authenticates Customer member commands before parsing malformed input", async () => {
    const response = await updateCustomerMember(new Request("http://localhost/api/admin/customers/customer-1", { method: "PATCH", body: "{" }), { params: Promise.resolve({ id: "customer-1" }) });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED", correlationId: expect.any(String) });
  });

  it("authenticates User member commands before parsing malformed input", async () => {
    const response = await updateUser(new Request("http://localhost/api/admin/users/user-1", { method: "PATCH", body: "{" }), { params: Promise.resolve({ id: "user-1" }) });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED", correlationId: expect.any(String) });
  });
});
