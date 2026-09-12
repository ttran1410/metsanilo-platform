import { beforeEach, describe, expect, it, vi } from "vitest";

const { database, currentUser, hasUserPermission } = vi.hoisted(() => ({
  database: {},
  currentUser: vi.fn(),
  hasUserPermission: vi.fn(),
}));

vi.mock("@/db/client", () => ({ db: vi.fn(() => database) }));
vi.mock("@/domain/access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/domain/access")>();
  return {
    ...actual,
    currentUser,
    hasUserPermission,
    PERMISSIONS: ["orders.read"],
    assertOperationalAccess: vi.fn(actual.assertOperationalAccess),
  };
});
vi.mock("@/lib/env", () => ({ env: () => ({ SHOP_ID: "shop-test" }) }));

import { PUT as updatePaymentMethod } from "@/app/api/admin/payment-methods/[method]/route";
import { GET as getProducts } from "@/app/api/admin/products/route";
import { GET as getOrders } from "@/app/api/admin/orders/route";
import { PUT as updateAvailability } from "@/app/api/admin/availability/[id]/route";
import { PUT as updateUserPermission } from "@/app/api/admin/users/[id]/permissions/route";
import { GET as getReviews } from "@/app/api/admin/reviews/route";
import { GET as getCustomers } from "@/app/api/admin/customers/route";
import { GET as getUsers } from "@/app/api/admin/users/route";
import { GET as getAvailability } from "@/app/api/admin/availability/route";
import { PUT as updateReview } from "@/app/api/admin/reviews/route";
import { PATCH as moderateReview } from "@/app/api/admin/reviews/route";
import { POST as anonymizeCustomer } from "@/app/api/admin/customers/[id]/route";
import { PATCH as updateProduct } from "@/app/api/admin/products/[id]/route";
import { POST as updateOrderStatus } from "@/app/api/admin/orders/[id]/status/route";
import { PATCH as updateFulfillmentMember } from "@/app/api/admin/fulfillment-locations/[id]/route";
import { PUT as updatePaymentMember } from "@/app/api/admin/payment-methods/[method]/route";
import { PATCH as updatePackageMember } from "@/app/api/admin/packages/[id]/route";
import { DELETE as deleteThemeDraft } from "@/app/api/admin/storefront-theme/drafts/[draftId]/route";
import { GET as getUserSessions, DELETE as revokeUserSessions } from "@/app/api/admin/users/[id]/sessions/route";

describe("admin route permission contract", () => {
  beforeEach(() => {
    currentUser.mockResolvedValue({ id: "actor-1", role: "STAFF", shopId: "shop-test" });
    hasUserPermission.mockResolvedValue(false);
  });

  it("returns a safe JSON permission error for compatibility mutations", async () => {
    const response = await updatePaymentMethod(
      new Request("http://localhost/api/admin/payment-methods/CASH", { method: "PUT", body: "{}" }),
      { params: Promise.resolve({ method: "CASH" }) },
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN", correlationId: expect.any(String) });
  });

  it("returns a safe JSON permission error for canonical collection reads", async () => {
    const response = await getProducts(new Request("http://localhost/api/admin/products"));

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN", correlationId: expect.any(String) });
  });

  it("returns a safe JSON permission error for sensitive mutations", async () => {
    const responses = await Promise.all([
      updateAvailability(new Request("http://localhost/api/admin/availability/a1", { method: "PUT", body: "{}" }), { params: Promise.resolve({ id: "a1" }) }),
      updateUserPermission(new Request("http://localhost/api/admin/users/u1/permissions", { method: "PUT", body: "{}" }), { params: Promise.resolve({ id: "u1" }) }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toMatchObject({ code: "FORBIDDEN", correlationId: expect.any(String) });
    }
  });

  it.each([
    ["Reviews", getReviews, "/api/admin/reviews"],
    ["Customers", getCustomers, "/api/admin/customers"],
    ["Users", getUsers, "/api/admin/users"],
    ["Availability", getAvailability, "/api/admin/availability"],
  ])("returns a safe JSON permission error for canonical %s reads", async (_name, handler, path) => {
    const response = await handler(new Request(`http://localhost${path}`));
    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN", correlationId: expect.any(String) });
  });

  it("protects the administrative user-session listing with permission", async () => {
    const response = await getUserSessions(new Request("http://localhost/api/admin/users/u1/sessions"), {
      params: Promise.resolve({ id: "u1" }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN", correlationId: expect.any(String) });
  });

  it("keeps administrative session revocation behind permission and JSON error handling", async () => {
    const response = await revokeUserSessions(
      new Request("http://localhost/api/admin/users/u1/sessions", {
        method: "DELETE",
        headers: { origin: "http://localhost", "content-type": "application/json" },
        body: JSON.stringify({ scope: "all" }),
      }),
      { params: Promise.resolve({ id: "u1" }) },
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN", correlationId: expect.any(String) });
  });

  it.each([
    ["Reviews update", updateReview, "PUT", "/api/admin/reviews", "{}", undefined],
    ["Reviews moderation", moderateReview, "PATCH", "/api/admin/reviews", "{}", undefined],
    ["Customer anonymize", anonymizeCustomer, "POST", "/api/admin/customers/c1", undefined, { params: Promise.resolve({ id: "c1" }) }],
    ["Product update", updateProduct, "PATCH", "/api/admin/products/p1", "{}", { params: Promise.resolve({ id: "p1" }) }],
    ["Order status", updateOrderStatus, "POST", "/api/admin/orders/o1/status", "{}", { params: Promise.resolve({ id: "o1" }) }],
  ])("returns a safe JSON permission error for canonical %s mutations", async (_name, handler, method, path, body, context) => {
    const invoke = handler as (...args: unknown[]) => Promise<Response>;
    const response = await invoke(new Request(`http://localhost${path}`, { method, ...(body === undefined ? {} : { body }) }), ...(context ? [context] : []));
    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN", correlationId: expect.any(String) });
  });

  it.each([
    ["Fulfillment member", updateFulfillmentMember, "PATCH", "/api/admin/fulfillment-locations/l1", "{}", { params: Promise.resolve({ id: "l1" }) }],
    ["Payment member", updatePaymentMember, "PUT", "/api/admin/payment-methods/CASH", "{}", { params: Promise.resolve({ method: "CASH" }) }],
    ["Package member", updatePackageMember, "PATCH", "/api/admin/packages/p1", "{}", { params: Promise.resolve({ id: "p1" }) }],
    ["Theme draft", deleteThemeDraft, "DELETE", "/api/admin/storefront-theme/drafts/d1", undefined, { params: Promise.resolve({ draftId: "d1" }) }],
  ])("returns a safe JSON permission error for compatibility %s mutations", async (_name, handler, method, path, body, context) => {
    const invoke = handler as (...args: unknown[]) => Promise<Response>;
    const response = await invoke(new Request(`http://localhost${path}`, { method, ...(body === undefined ? {} : { body }) }), context);
    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN", correlationId: expect.any(String) });
  });

  it("blocks actors requiring password change at runtime across representative routes with PASSWORD_CHANGE_REQUIRED", async () => {
    currentUser.mockResolvedValue({ id: "actor-temp", role: "ADMIN", shopId: "shop-test", mustChangePassword: true });
    hasUserPermission.mockResolvedValue(true);

    const routes: Array<() => Promise<Response>> = [
      () => getProducts(new Request("http://localhost/api/admin/products")),
      () => getOrders(new Request("http://localhost/api/admin/orders")),
      () => getUsers(new Request("http://localhost/api/admin/users")),
      // Delegated collection mutations
      () => updateReview(new Request("http://localhost/api/admin/reviews", { method: "PUT", body: "{}" })),
      () => moderateReview(new Request("http://localhost/api/admin/reviews", { method: "PATCH", body: "{}" })),
      // Parameterized / individual member mutations
      () => updateProduct(new Request("http://localhost/api/admin/products/p1", { method: "PATCH", body: "{}" }), { params: Promise.resolve({ id: "p1" }) }),
      () => updateOrderStatus(new Request("http://localhost/api/admin/orders/o1/status", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "o1" }) }),
      () => deleteThemeDraft(new Request("http://localhost/api/admin/storefront-theme/drafts/d1", { method: "DELETE" }), { params: Promise.resolve({ draftId: "d1" }) }),
    ];

    for (const invoke of routes) {
      const response = await invoke();
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        code: "FORBIDDEN",
        detail: { reason: "PASSWORD_CHANGE_REQUIRED" },
      });
    }
  });
});
