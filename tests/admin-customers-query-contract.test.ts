import { describe, expect, it } from "vitest";
import { getAdminCustomers } from "@/domain/admin-customer-actions";

describe("Admin Customers query contract", () => {
  it("rejects a mismatched shop context before querying", async () => {
    await expect(getAdminCustomers({} as never, {
      actor: { id: "admin", shopId: "shop-other", role: "ADMIN" },
      shop: { id: "shop-main" },
    }, { search: "", filter: "all", sort: "recent", page: 1, limit: 20 })).rejects.toThrow("Admin action context shop mismatch");
  });
});
