import { describe, expect, it } from "vitest";
import { parseCustomersUrlState, serializeCustomersUrlState } from "@/app/admin/customers-url-state";

describe("Customers URL state", () => {
  it("parses selection, filters, sort and presentation state", () => {
    expect(parseCustomersUrlState(new URLSearchParams("customer=c-1&q=berry&filter=vip&sort=spend_desc&view=table"))).toEqual({
      selectedId: "c-1", searchQuery: "berry", filterChip: "vip", sortMode: "spend_desc", workspaceView: "table",
    });
  });

  it("falls back safely for unsupported values", () => {
    expect(parseCustomersUrlState(new URLSearchParams("filter=unknown&sort=bad&view=kanban"))).toMatchObject({
      selectedId: "", searchQuery: "", filterChip: "all", sortMode: "recent", workspaceView: "split",
    });
  });

  it("preserves unrelated params and removes canonical defaults", () => {
    const next = serializeCustomersUrlState(new URLSearchParams("created=c-1&notice=saved"), {
      selectedId: "", searchQuery: "", filterChip: "all", sortMode: "recent", workspaceView: "split", page: 1,
    });
    expect(next.get("created")).toBe("c-1");
    expect(next.get("notice")).toBe("saved");
    expect(next.has("filter")).toBe(false);
    expect(next.has("page")).toBe(false);
  });
});
