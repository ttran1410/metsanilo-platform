import { describe, expect, it } from "vitest";
import { parseAvailabilityUrlState, serializeAvailabilityUrlState } from "@/app/admin/availability/url-state";

describe("Availability URL state", () => {
  it("parses view, product, season and start date", () => {
    expect(parseAvailabilityUrlState(new URLSearchParams("view=month&productId=p-1&seasonId=s-1&startDate=2026-08-28"))).toEqual({
      viewMode: "MONTH", productFilter: "p-1", seasonFilter: "s-1", startDate: "2026-08-28",
    });
  });

  it("falls back to the weekly all-items view", () => {
    expect(parseAvailabilityUrlState(new URLSearchParams("view=calendar"))).toEqual({
      viewMode: "WEEK", productFilter: "ALL", seasonFilter: "ALL", startDate: "",
    });
  });

  it("preserves unrelated params and removes all-item defaults", () => {
    const next = serializeAvailabilityUrlState(new URLSearchParams("created=a-1&notice=saved"), {
      viewMode: "WEEK", productFilter: "ALL", seasonFilter: "ALL", startDate: "2026-08-28",
    });
    expect(next.get("created")).toBe("a-1");
    expect(next.get("notice")).toBe("saved");
    expect(next.get("view")).toBe("WEEK");
    expect(next.get("startDate")).toBe("2026-08-28");
    expect(next.has("productId")).toBe(false);
  });
});
