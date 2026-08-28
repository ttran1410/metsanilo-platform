import { describe, expect, it } from "vitest";
import { parseOrdersUrlState, serializeOrdersUrlState } from "@/app/admin/orders-url-state";

describe("Orders URL state", () => {
  it("parses shareable filters and restores defaults", () => {
    const state = parseOrdersUrlState(new URLSearchParams("view=TODAY&mode=KANBAN&q=berry&from=2026-08-28&preset=TODAY&status=NEW&entry=LIVE_ONLY"), {
      view: "ALL", status: "ALL", from: "", to: "", preset: "ALL",
    });
    expect(state).toEqual({ view: "TODAY", mode: "KANBAN", query: "berry", from: "2026-08-28", to: "", preset: "TODAY", method: "ALL", status: "NEW", source: "ALL", entry: "LIVE_ONLY" });
  });

  it("rejects unsupported values while retaining safe defaults", () => {
    const state = parseOrdersUrlState(new URLSearchParams("view=unknown&mode=popup&preset=bad&entry=bad"), {
      view: "TODAY", status: "ALL", from: "2026-08-28", to: "2026-08-28", preset: "TODAY",
    });
    expect(state).toMatchObject({ view: "TODAY", mode: "TABLE", preset: "TODAY", entry: "ALL", from: "2026-08-28", to: "2026-08-28" });
  });

  it("preserves unrelated and transient parameters while serializing state", () => {
    const next = serializeOrdersUrlState(new URLSearchParams("created=order-1&_rsc=internal"), {
      view: "UNPAID", mode: "TABLE", query: "", from: "", to: "", preset: "ALL", method: "ALL", status: "ALL", source: "ALL", entry: "ALL",
    });
    expect(next.get("created")).toBe("order-1");
    expect(next.get("_rsc")).toBe("internal");
    expect(next.get("view")).toBe("UNPAID");
    expect(next.has("q")).toBe(false);
  });
});
