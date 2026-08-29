import { describe, expect, it } from "vitest";
import { serializeCustomersUrlState } from "@/app/admin/customers/url-state";
import { serializeUsersUrlState } from "@/app/admin/users/url-state";
import { serializeProductsUrlState } from "@/app/admin/products/url-state";
import { serializeReviewsUrlState } from "@/app/admin/reviews/url-state";
import { serializeAvailabilityUrlState } from "@/app/admin/availability/url-state";
import { serializeAuditUrlState } from "@/app/admin/audit/url-state";
import { serializeSettingsUrlState } from "@/app/admin/settings/url-state";

describe("Admin application URL transport contract", () => {
  it("never serializes Next's _rsc transport parameter", () => {
    const current = new URLSearchParams("_rsc=transport&created=record-1");
    const results = [
      serializeCustomersUrlState(current, { selectedId: "", searchQuery: "", filterChip: "all", sortMode: "recent", workspaceView: "split", page: 1 }),
      serializeUsersUrlState(current, { selectedId: "", searchQuery: "", roleFilter: "ALL", page: 1 }),
      serializeProductsUrlState(current, { selectedId: "", searchQuery: "", filterStatus: "all", activeTab: "general", viewMode: "split", page: 1 }),
      serializeReviewsUrlState(current, { activeTab: "all", searchQuery: "", currentPage: 1 }),
      serializeAvailabilityUrlState(current, { viewMode: "WEEK", productFilter: "ALL", seasonFilter: "ALL", startDate: "2026-08-29" }),
      serializeAuditUrlState(current, { selectedAuditId: null, searchQuery: "", severityFilter: "ALL", categoryFilter: "ALL", actorFilter: "", dateRange: "all", currentPage: 1 }),
      serializeSettingsUrlState(current, "identity"),
    ];
    for (const result of results) expect(result.has("_rsc")).toBe(false);
  });
});
