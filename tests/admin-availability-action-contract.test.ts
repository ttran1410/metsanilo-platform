import { describe, expect, it } from "vitest";
import { planAdminAvailability, updateAdminAvailability } from "@/domain/admin-availability-actions";

const mismatchedContext = {
  actor: { id: "admin", shopId: "shop-other", role: "ADMIN" as const },
  shop: { id: "shop-main" },
};

describe("Admin Availability action contract", () => {
  it("rejects an update with a mismatched tenant before querying", async () => {
    expect(() => updateAdminAvailability({} as never, mismatchedContext, "availability-1", {
      expectedVersion: 1,
      capacityMl: 1000,
      manualSoldOut: false,
    })).toThrow("Admin action context shop mismatch");
  });

  it("rejects a plan with a mismatched tenant before planning", async () => {
    expect(() => planAdminAvailability({} as never, mismatchedContext, {
      productId: "product-1",
      frequency: "DAY",
      startDate: "2026-08-29",
      endDate: "2026-08-29",
      capacityMl: 1000,
      manualSoldOut: false,
    })).toThrow("Admin action context shop mismatch");
  });
});
