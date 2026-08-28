import { beforeEach, describe, expect, it, vi } from "vitest";

const { database, currentUser, hasUserPermission } = vi.hoisted(() => ({
  database: {},
  currentUser: vi.fn(),
  hasUserPermission: vi.fn(),
}));

vi.mock("@/db/client", () => ({ db: vi.fn(() => database) }));
vi.mock("@/domain/access", () => ({ currentUser, hasUserPermission }));
vi.mock("@/lib/env", () => ({ env: () => ({ SHOP_ID: "shop-test" }) }));

import { PUT as updatePaymentMethod } from "@/app/api/admin/payment-methods/[method]/route";
import { GET as getProducts } from "@/app/api/admin/products/route";

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
});
