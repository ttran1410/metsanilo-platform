export type ReviewTab = "pending" | "approved" | "featured" | "rejected" | "all";

export function parseReviewsUrlState(params: URLSearchParams) {
  const status = params.get("status");
  return {
    activeTab: status === "approved" || status === "featured" || status === "rejected" || status === "all" ? status as ReviewTab : "pending" as ReviewTab,
    searchQuery: params.get("q") ?? "",
    currentPage: Math.max(1, Number(params.get("page") ?? "1") || 1),
  };
}

export function serializeReviewsUrlState(current: URLSearchParams, state: { activeTab: ReviewTab; searchQuery: string; currentPage: number }) {
  const next = new URLSearchParams(current.toString());
  next.delete("_rsc");
  if (state.searchQuery) next.set("q", state.searchQuery); else next.delete("q");
  if (state.activeTab !== "pending") next.set("status", state.activeTab); else next.delete("status");
  if (state.currentPage > 1) next.set("page", String(state.currentPage)); else next.delete("page");
  return next;
}
