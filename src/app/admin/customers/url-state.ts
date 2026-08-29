export type CustomerFilter = "all" | "vip" | "conflicts" | "consent";
export type CustomerSort = "recent" | "spend_desc" | "litres_desc" | "name_asc";
export type CustomerView = "split" | "table";

export function parseCustomersUrlState(params: URLSearchParams) {
  const filter = params.get("filter") as CustomerFilter | null;
  const sort = params.get("sort") as CustomerSort | null;
  const filterChip: CustomerFilter = filter === "vip" || filter === "conflicts" || filter === "consent" ? filter : "all";
  const sortMode: CustomerSort = sort === "spend_desc" || sort === "litres_desc" || sort === "name_asc" ? sort : "recent";
  return { selectedId: params.get("customer") ?? "", searchQuery: params.get("q") ?? "", filterChip, sortMode, workspaceView: params.get("view") === "table" ? "table" as CustomerView : "split" as CustomerView };
}

export function serializeCustomersUrlState(current: URLSearchParams, state: { selectedId: string; searchQuery: string; filterChip: CustomerFilter; sortMode: CustomerSort; workspaceView: CustomerView; page: number }) {
  const next = new URLSearchParams(current.toString());
  next.delete("_rsc");
  if (state.selectedId) next.set("customer", state.selectedId); else next.delete("customer");
  if (state.searchQuery) next.set("q", state.searchQuery); else next.delete("q");
  if (state.filterChip !== "all") next.set("filter", state.filterChip); else next.delete("filter");
  if (state.sortMode !== "recent") next.set("sort", state.sortMode); else next.delete("sort");
  if (state.workspaceView !== "split") next.set("view", state.workspaceView); else next.delete("view");
  if (state.page > 1) next.set("page", String(state.page)); else next.delete("page");
  return next;
}
