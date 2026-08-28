import type { AuditCategory, AuditSeverity } from "@/domain/audit";

export type AuditDateRange = "24h" | "7d" | "30d" | "all";

export function parseAuditUrlState(params: URLSearchParams) {
  const severity = params.get("severity") as AuditSeverity | null;
  const category = params.get("category") as AuditCategory | null;
  const dateRange = params.get("dateRange") as AuditDateRange | null;
  return {
    selectedAuditId: params.get("audit"),
    searchQuery: params.get("q") ?? params.get("search") ?? "",
    severityFilter: severity ?? "ALL" as AuditSeverity | "ALL",
    categoryFilter: category ?? "ALL" as AuditCategory | "ALL",
    actorFilter: params.get("actor") ?? "ALL",
    dateRange: dateRange === "24h" || dateRange === "30d" || dateRange === "all" ? dateRange : "7d" as AuditDateRange,
    currentPage: Math.max(1, Number(params.get("page") ?? "1") || 1),
  };
}

export function serializeAuditUrlState(current: URLSearchParams, state: { selectedAuditId: string | null; searchQuery: string; severityFilter: AuditSeverity | "ALL"; categoryFilter: AuditCategory | "ALL"; actorFilter: string; dateRange: AuditDateRange; currentPage: number }) {
  const next = new URLSearchParams(current.toString());
  state.searchQuery ? next.set("q", state.searchQuery) : next.delete("q");
  next.delete("search");
  state.severityFilter !== "ALL" ? next.set("severity", state.severityFilter) : next.delete("severity");
  state.categoryFilter !== "ALL" ? next.set("category", state.categoryFilter) : next.delete("category");
  state.actorFilter !== "ALL" ? next.set("actor", state.actorFilter) : next.delete("actor");
  state.dateRange !== "7d" ? next.set("dateRange", state.dateRange) : next.delete("dateRange");
  state.currentPage > 1 ? next.set("page", String(state.currentPage)) : next.delete("page");
  state.selectedAuditId ? next.set("audit", state.selectedAuditId) : next.delete("audit");
  return next;
}
