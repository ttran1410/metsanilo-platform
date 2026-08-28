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

import { executeAdmin } from "@/app/api/admin/module";

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
    const result = await executeAdmin(new Request("http://localhost/api/admin/products"), {
      permission: "catalog.product.read",
      parse: async () => ({ q: "berry" }),
      run: async (input, request) => ({ input, actor: request.context.actor, shop: request.context.shop }),
    });

    expect(result).toEqual({
      input: { q: "berry" },
      actor: expect.objectContaining({ id: "actor-1" }),
      shop: { shopId: "shop-test" },
    });
  });

  it("propagates domain auth errors for the response adapter", async () => {
    currentUser.mockRejectedValue(new DomainError("UNAUTHORIZED", "Authentication required", 401));

    await expect(executeAdmin(new Request("http://localhost/api/admin/products"), {
      permission: "catalog.product.read",
      parse: async () => undefined,
      run: async () => null,
    })).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });
});
