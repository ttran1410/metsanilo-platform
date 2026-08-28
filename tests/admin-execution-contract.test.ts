import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/domain/errors";

const { database, currentUser, hasUserPermission } = vi.hoisted(() => ({
  database: {},
  currentUser: vi.fn(),
  hasUserPermission: vi.fn(),
}));

vi.mock("@/db/client", () => ({ db: vi.fn(() => database) }));
vi.mock("@/domain/access", () => ({ currentUser, hasUserPermission }));
vi.mock("@/lib/env", () => ({ env: () => ({ SHOP_ID: "shop-test" }) }));

import { authenticateAdminAny, executeAdmin } from "@/app/api/admin/module";
import { assertAdminActionContext } from "@/domain/admin-action-context";
import { failure } from "@/app/api/response";

describe("executeAdmin contract", () => {
  beforeEach(() => {
    currentUser.mockResolvedValue({ id: "actor-1", role: "ADMIN", shopId: "shop-test", email: "admin@example.test" });
    hasUserPermission.mockResolvedValue(true);
  });

  it("requires the declared permission before running the handler", async () => {
    hasUserPermission.mockResolvedValue(false);
    const run = vi.fn();

    await expect(executeAdmin(new Request("http://localhost/api/admin/products"), {
      permission: "catalog.product.read",
      parse: async () => ({ q: "berry" }),
      run,
    })).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    expect(hasUserPermission).toHaveBeenCalledWith(database, expect.anything(), "catalog.product.read");
    expect(run).not.toHaveBeenCalled();
  });

  it("passes authenticated actor and active shop context to the handler", async () => {
    const result = await executeAdmin(new Request("http://localhost/api/admin/products", { headers: { "x-admin-request-scope": "products-list", "x-correlation-id": "corr-test" } }), {
      permission: "catalog.product.read",
      parse: async () => ({ q: "berry" }),
      run: async (input, request) => ({ input, actor: request.context.actor, shop: request.context.shop, requestScope: request.request.headers.get("x-admin-request-scope") }),
    });

    expect(result).toEqual({
      input: { q: "berry" },
      actor: expect.objectContaining({ id: "actor-1" }),
      shop: { shopId: "shop-test" },
      requestScope: "products-list",
    });
  });

  it("authenticates before parsing the command", async () => {
    hasUserPermission.mockResolvedValue(false);
    const parse = vi.fn(async () => { throw new DomainError("VALIDATION_ERROR", "bad input", 422); });
    await expect(executeAdmin(new Request("http://localhost/api/admin/products", { method: "POST" }), {
      permission: "catalog.product.write", parse, run: async () => null,
    })).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(parse).not.toHaveBeenCalled();
  });

  it("rejects dynamic permission boundaries when no candidate permission is granted", async () => {
    hasUserPermission.mockResolvedValue(false);
    hasUserPermission.mockClear();
    await expect(authenticateAdminAny(new Request("http://localhost/api/admin/settings"), ["settings.read", "settings.operational"])).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(hasUserPermission).toHaveBeenCalledTimes(2);
  });

  it("propagates domain auth errors for the response adapter", async () => {
    currentUser.mockRejectedValue(new DomainError("UNAUTHORIZED", "Authentication required", 401));

    await expect(executeAdmin(new Request("http://localhost/api/admin/products"), {
      permission: "catalog.product.read",
      parse: async () => undefined,
      run: async () => null,
    })).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });

  it("rejects an actor and shop from different tenants", () => {
    expect(() => assertAdminActionContext({
      actor: { id: "actor-1", role: "ADMIN", shopId: "shop-a" },
      shop: { id: "shop-b" },
    })).toThrow("Admin action context shop mismatch");
  });

  it("preserves a valid request correlation ID and replaces invalid IDs", async () => {
    const valid = failure(new DomainError("FORBIDDEN", "Denied", 403), new Request("http://localhost", { headers: { "x-correlation-id": "123e4567-e89b-12d3-a456-426614174000" } }));
    expect((await valid.json()).correlationId).toBe("123e4567-e89b-12d3-a456-426614174000");

    const invalid = failure(new DomainError("FORBIDDEN", "Denied", 403), new Request("http://localhost", { headers: { "x-correlation-id": "not-safe" } }));
    expect((await invalid.json()).correlationId).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
