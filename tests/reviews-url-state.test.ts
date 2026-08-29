import { describe, expect, it } from "vitest";
import { parseReviewsUrlState, serializeReviewsUrlState } from "@/app/admin/reviews/url-state";

describe("Reviews URL state", () => {
  it("parses status tab, search and page", () => {
    expect(parseReviewsUrlState(new URLSearchParams("status=featured&q=berry&page=4"))).toEqual({
      activeTab: "featured", searchQuery: "berry", currentPage: 4,
    });
  });

  it("uses pending and page one for invalid values", () => {
    expect(parseReviewsUrlState(new URLSearchParams("status=unknown&page=0"))).toEqual({
      activeTab: "pending", searchQuery: "", currentPage: 1,
    });
  });

  it("preserves unrelated params and removes canonical defaults", () => {
    const next = serializeReviewsUrlState(new URLSearchParams("created=r-1&notice=saved"), {
      activeTab: "pending", searchQuery: "", currentPage: 1,
    });
    expect(next.get("created")).toBe("r-1");
    expect(next.get("notice")).toBe("saved");
    expect(next.has("status")).toBe(false);
    expect(next.has("page")).toBe(false);
  });
});
