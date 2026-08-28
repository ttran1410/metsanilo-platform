import { describe, expect, it } from "vitest";
import { parseAuditUrlState, serializeAuditUrlState } from "@/app/admin/audit-url-state";

describe("Audit URL state", () => {
  it("parses the canonical q parameter and audit filters", () => {
    expect(parseAuditUrlState(new URLSearchParams("audit=a-1&q=refund&severity=HIGH&category=SECURITY&actor=admin&dateRange=24h&page=2"))).toMatchObject({
      selectedAuditId: "a-1", searchQuery: "refund", severityFilter: "HIGH", categoryFilter: "SECURITY", actorFilter: "admin", dateRange: "24h", currentPage: 2,
    });
  });

  it("reads the legacy search alias and safe defaults", () => {
    expect(parseAuditUrlState(new URLSearchParams("search=legacy&page=0&dateRange=bad"))).toMatchObject({
      searchQuery: "legacy", dateRange: "7d", currentPage: 1, severityFilter: "ALL", categoryFilter: "ALL", actorFilter: "ALL",
    });
  });

  it("canonicalizes search to q while preserving unrelated params", () => {
    const next = serializeAuditUrlState(new URLSearchParams("search=old&created=a-1"), {
      selectedAuditId: null, searchQuery: "new", severityFilter: "ALL", categoryFilter: "ALL", actorFilter: "ALL", dateRange: "7d", currentPage: 1,
    });
    expect(next.get("q")).toBe("new");
    expect(next.has("search")).toBe(false);
    expect(next.get("created")).toBe("a-1");
    expect(next.has("audit")).toBe(false);
  });
});
