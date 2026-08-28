import { describe, expect, it } from "vitest";
import { parseProductsUrlState, serializeProductsUrlState } from "@/app/admin/products-url-state";

describe("Products URL state", () => {
  it("parses selection, filter, tab and presentation state", () => {
    expect(parseProductsUrlState(new URLSearchParams("product=p-1&q=berry&status=upcoming&tab=packages&view=table"))).toEqual({
      selectedId: "p-1", searchQuery: "berry", filterStatus: "upcoming", activeTab: "packages", viewMode: "table",
    });
  });

  it("falls back safely for unsupported values", () => {
    expect(parseProductsUrlState(new URLSearchParams("status=hidden&tab=pricing&view=kanban"), "p-first")).toEqual({
      selectedId: "p-first", searchQuery: "", filterStatus: "all", activeTab: "general", viewMode: "split",
    });
  });

  it("preserves unrelated params and serializes pagination", () => {
    const next = serializeProductsUrlState(new URLSearchParams("created=p-1&notice=saved"), {
      selectedId: "p-2", searchQuery: "berry", filterStatus: "archived", activeTab: "media", viewMode: "table", page: 2,
    });
    expect(next.get("created")).toBe("p-1");
    expect(next.get("notice")).toBe("saved");
    expect(next.get("product")).toBe("p-2");
    expect(next.get("status")).toBe("archived");
    expect(next.get("tab")).toBe("media");
    expect(next.get("page")).toBe("2");
  });
});
