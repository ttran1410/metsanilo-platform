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
  state.searchQuery ? next.set("q", state.searchQuery) : next.delete("q");
  state.activeTab !== "pending" ? next.set("status", state.activeTab) : next.delete("status");
  state.currentPage > 1 ? next.set("page", String(state.currentPage)) : next.delete("page");
  return next;
}
