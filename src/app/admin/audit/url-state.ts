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
  next.delete("_rsc");
  if (state.searchQuery) next.set("q", state.searchQuery); else next.delete("q");
  next.delete("search");
  if (state.severityFilter !== "ALL") next.set("severity", state.severityFilter); else next.delete("severity");
  if (state.categoryFilter !== "ALL") next.set("category", state.categoryFilter); else next.delete("category");
  if (state.actorFilter !== "ALL") next.set("actor", state.actorFilter); else next.delete("actor");
  if (state.dateRange !== "7d") next.set("dateRange", state.dateRange); else next.delete("dateRange");
  if (state.currentPage > 1) next.set("page", String(state.currentPage)); else next.delete("page");
  if (state.selectedAuditId) next.set("audit", state.selectedAuditId); else next.delete("audit");
  return next;
}
