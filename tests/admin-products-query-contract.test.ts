import { describe, expect, it } from "vitest";
import { getAdminProducts, getAdminProductDetailWithAvailability } from "@/domain/admin-products-actions";

const query = { q: "", page: 1, pageSize: 20, offset: 0 };

describe("Admin Products query contract", () => {
  it("rejects a mismatched shop context before querying the product list", async () => {
    await expect(getAdminProducts({} as never, {
      actor: { id: "admin", shopId: "shop-other", role: "ADMIN" },
      shop: { id: "shop-main" },
    }, query)).rejects.toThrow("Admin action context shop mismatch");
  });

  it("rejects a mismatched shop context before querying product detail", async () => {
    await expect(getAdminProductDetailWithAvailability({} as never, {
      actor: { id: "admin", shopId: "shop-other", role: "ADMIN" },
      shop: { id: "shop-main" },
    }, "product-1")).rejects.toThrow("Admin action context shop mismatch");
  });
});
