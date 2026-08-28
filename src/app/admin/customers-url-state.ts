export type CustomerFilter = "all" | "vip" | "conflicts" | "consent";
export type CustomerSort = "recent" | "spend_desc" | "litres_desc" | "name_asc";
export type CustomerView = "split" | "table";

export function parseCustomersUrlState(params: URLSearchParams) {
  const filter = params.get("filter") as CustomerFilter | null;
  const sort = params.get("sort") as CustomerSort | null;
  const filterChip: CustomerFilter = filter === "vip" || filter === "conflicts" || filter === "consent" ? filter : "all";
  const sortMode: CustomerSort = sort === "spend_desc" || sort === "litres_desc" || sort === "name_asc" ? sort : "recent";
  return {
    selectedId: params.get("customer") ?? "",
    searchQuery: params.get("q") ?? "",
    filterChip,
    sortMode,
    workspaceView: params.get("view") === "table" ? "table" as CustomerView : "split" as CustomerView,
  };
}

export function serializeCustomersUrlState(current: URLSearchParams, state: { selectedId: string; searchQuery: string; filterChip: CustomerFilter; sortMode: CustomerSort; workspaceView: CustomerView; page: number }) {
  const next = new URLSearchParams(current.toString());
  next.delete("_rsc");
  state.selectedId ? next.set("customer", state.selectedId) : next.delete("customer");
  state.searchQuery ? next.set("q", state.searchQuery) : next.delete("q");
  state.filterChip !== "all" ? next.set("filter", state.filterChip) : next.delete("filter");
  state.sortMode !== "recent" ? next.set("sort", state.sortMode) : next.delete("sort");
  state.workspaceView !== "split" ? next.set("view", state.workspaceView) : next.delete("view");
  state.page > 1 ? next.set("page", String(state.page)) : next.delete("page");
  return next;
}
