export type ProductFilterStatus = "all" | "in_season" | "upcoming" | "archived";
export type ProductTab = "general" | "packages" | "media" | "channels";
export type ProductView = "split" | "table";

export function parseProductsUrlState(params: URLSearchParams, fallbackSelectedId = "") {
  const status = params.get("status");
  const tab = params.get("tab");
  return {
    selectedId: params.get("product") ?? fallbackSelectedId,
    searchQuery: params.get("q") ?? "",
    filterStatus: status === "in_season" || status === "upcoming" || status === "archived" ? status as ProductFilterStatus : "all" as ProductFilterStatus,
    activeTab: tab === "packages" || tab === "media" || tab === "channels" ? tab as ProductTab : "general" as ProductTab,
    viewMode: params.get("view") === "table" ? "table" as ProductView : "split" as ProductView,
  };
}

export function serializeProductsUrlState(current: URLSearchParams, state: { selectedId: string; searchQuery: string; filterStatus: ProductFilterStatus; activeTab: ProductTab; viewMode: ProductView; page: number }) {
  const next = new URLSearchParams(current.toString());
  next.delete("_rsc");
  if (state.selectedId) next.set("product", state.selectedId); else next.delete("product");
  if (state.searchQuery) next.set("q", state.searchQuery); else next.delete("q");
  if (state.filterStatus !== "all") next.set("status", state.filterStatus); else next.delete("status");
  if (state.activeTab !== "general") next.set("tab", state.activeTab); else next.delete("tab");
  if (state.viewMode !== "split") next.set("view", state.viewMode); else next.delete("view");
  if (state.page > 1) next.set("page", String(state.page)); else next.delete("page");
  return next;
}
