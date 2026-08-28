import { beforeEach, describe, expect, it, vi } from "vitest";

const { database, currentUser, hasUserPermission } = vi.hoisted(() => ({
  database: {},
  currentUser: vi.fn(),
  hasUserPermission: vi.fn(),
}));

vi.mock("@/db/client", () => ({ db: vi.fn(() => database) }));
vi.mock("@/domain/access", () => ({ currentUser, hasUserPermission, PERMISSIONS: ["orders.read"] }));
vi.mock("@/lib/env", () => ({ env: () => ({ SHOP_ID: "shop-test" }) }));

import { PUT as updatePaymentMethod } from "@/app/api/admin/payment-methods/[method]/route";
import { GET as getProducts } from "@/app/api/admin/products/route";
import { PUT as updateAvailability } from "@/app/api/admin/availability/[id]/route";
import { PUT as updateUserPermission } from "@/app/api/admin/users/[id]/permissions/route";

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
});
