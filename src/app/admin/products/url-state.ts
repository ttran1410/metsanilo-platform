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
  state.selectedId ? next.set("product", state.selectedId) : next.delete("product");
  state.searchQuery ? next.set("q", state.searchQuery) : next.delete("q");
  state.filterStatus !== "all" ? next.set("status", state.filterStatus) : next.delete("status");
  state.activeTab !== "general" ? next.set("tab", state.activeTab) : next.delete("tab");
  state.viewMode !== "split" ? next.set("view", state.viewMode) : next.delete("view");
  state.page > 1 ? next.set("page", String(state.page)) : next.delete("page");
  return next;
}
