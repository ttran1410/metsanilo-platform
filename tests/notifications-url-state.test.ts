import { describe, expect, it } from "vitest";
import { parseNotificationsUrlState, serializeNotificationsUrlState } from "@/app/admin/notifications-url-state";

describe("Notifications URL state", () => {
  it("parses state, category, severity, query and page", () => {
    expect(parseNotificationsUrlState(new URLSearchParams("state=READ&category=ORDER&severity=HIGH&q=refund&page=3"))).toEqual({
      state: "READ", category: "ORDER", severity: "HIGH", query: "refund", page: 3,
    });
  });

  it("falls back to ALL and page one for invalid values", () => {
    expect(parseNotificationsUrlState(new URLSearchParams("state=ARCHIVED&severity=LOW&page=0"))).toEqual({
      state: "ALL", category: undefined, severity: undefined, query: undefined, page: 1,
    });
  });

  it("serializes canonical defaults and filters", () => {
    expect(serializeNotificationsUrlState({ state: "UNREAD", category: "ALL", severity: undefined, query: "", page: 1 }).toString()).toBe("state=UNREAD");
    expect(serializeNotificationsUrlState({ state: "READ", category: "ORDER", severity: "INFO", query: "refund", page: 2 }).toString()).toBe("state=READ&category=ORDER&severity=INFO&q=refund&page=2");
  });
});
