import { describe, expect, it } from "vitest";
import { bulkModerateAdminReviews, replyAdminToReview } from "@/domain/admin-review-actions";

const context = {
  actor: { id: "admin", shopId: "shop-other", role: "ADMIN" as const },
  shop: { id: "shop-main" },
};

describe("Admin Reviews action contract", () => {
  it("rejects bulk moderation with a mismatched tenant", async () => {
    await expect(bulkModerateAdminReviews({} as never, context, {
      ids: ["review-1"], status: "APPROVED",
    })).rejects.toThrow("Admin action context shop mismatch");
  });

  it("rejects seller replies with a mismatched tenant", async () => {
    await expect(replyAdminToReview({} as never, context, {
      id: "review-1", replyText: "Thank you",
    })).rejects.toThrow("Admin action context shop mismatch");
  });
});
