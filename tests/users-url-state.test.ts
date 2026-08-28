import { describe, expect, it } from "vitest";
import { parseUsersUrlState, serializeUsersUrlState } from "@/app/admin/users-url-state";

describe("Users URL state", () => {
  it("parses selected user, search and role filter", () => {
    expect(parseUsersUrlState(new URLSearchParams("user=u-1&q=alice&role=MANAGER"))).toEqual({
      selectedId: "u-1", searchQuery: "alice", roleFilter: "MANAGER",
    });
  });

  it("falls back to the first user and ALL role for invalid state", () => {
    expect(parseUsersUrlState(new URLSearchParams("role=OWNER"), "u-first")).toEqual({
      selectedId: "u-first", searchQuery: "", roleFilter: "ALL",
    });
  });

  it("preserves unrelated params and canonicalizes defaults", () => {
    const next = serializeUsersUrlState(new URLSearchParams("created=u-1&notice=saved"), {
      selectedId: "u-2", searchQuery: "alice", roleFilter: "STAFF", page: 3,
    });
    expect(next.toString()).toContain("created=u-1");
    expect(next.get("notice")).toBe("saved");
    expect(next.get("user")).toBe("u-2");
    expect(next.get("role")).toBe("STAFF");
    expect(next.get("page")).toBe("3");
  });
});
