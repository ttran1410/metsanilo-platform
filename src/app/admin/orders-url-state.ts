export type OrdersView = "TRIAGE" | "ALL" | "TODAY" | "NEEDS_CONFIRMATION" | "PICKUP_TODAY" | "DELIVERY_TODAY" | "UNPAID" | "ARCHIVED";
export type WorkspaceMode = "TABLE" | "KANBAN" | "TERMINAL";
export type DatePreset = "TODAY" | "TOMORROW" | "YESTERDAY" | "THIS_WEEK" | "LAST_WEEK" | "LAST_7_DAYS" | "ALL" | "CUSTOM";
export type ArchiveScope = "ACTIVE_ONLY" | "ARCHIVED_ONLY" | "ALL";
export type EntryTypeFilter = "ALL" | "LIVE_ONLY" | "HISTORICAL_ONLY";

export type OrdersUrlState = {
  view: OrdersView;
  mode: WorkspaceMode;
  query: string;
  from: string;
  to: string;
  preset: DatePreset;
  method: string;
  status: string;
  source: string;
  entry: EntryTypeFilter;
};

const views = new Set<OrdersView>(["TRIAGE", "ALL", "TODAY", "NEEDS_CONFIRMATION", "PICKUP_TODAY", "DELIVERY_TODAY", "UNPAID", "ARCHIVED"]);
const presets = new Set<DatePreset>(["TODAY", "TOMORROW", "YESTERDAY", "THIS_WEEK", "LAST_WEEK", "LAST_7_DAYS", "ALL", "CUSTOM"]);
const entries = new Set<EntryTypeFilter>(["ALL", "LIVE_ONLY", "HISTORICAL_ONLY"]);

export function parseOrdersUrlState(params: URLSearchParams, defaults: Pick<OrdersUrlState, "view" | "status" | "from" | "to" | "preset">): OrdersUrlState {
  const requestedView = params.get("view") as OrdersView | null;
  const requestedMode = params.get("mode") as WorkspaceMode | null;
  const requestedPreset = params.get("preset") as DatePreset | null;
  const requestedEntry = params.get("entry") as EntryTypeFilter | null;
  return {
    view: requestedView && views.has(requestedView) ? requestedView : defaults.view,
    mode: requestedMode === "KANBAN" || requestedMode === "TERMINAL" ? requestedMode : "TABLE",
    query: params.get("q") ?? "",
    from: params.get("from") ?? defaults.from,
    to: params.get("to") ?? defaults.to,
    preset: requestedPreset && presets.has(requestedPreset) ? requestedPreset : defaults.preset,
    method: params.get("method") ?? "ALL",
    status: params.get("status") ?? defaults.status,
    source: params.get("source") ?? "ALL",
    entry: requestedEntry && entries.has(requestedEntry) ? requestedEntry : "ALL",
  };
}

export function serializeOrdersUrlState(current: URLSearchParams, state: OrdersUrlState) {
  const next = new URLSearchParams(current.toString());
  next.set("view", state.view);
  next.set("mode", state.mode);
  state.query ? next.set("q", state.query) : next.delete("q");
  state.from ? next.set("from", state.from) : next.delete("from");
  state.to ? next.set("to", state.to) : next.delete("to");
  state.preset !== "ALL" ? next.set("preset", state.preset) : next.delete("preset");
  state.method !== "ALL" ? next.set("method", state.method) : next.delete("method");
  state.status !== "ALL" ? next.set("status", state.status) : next.delete("status");
  state.source !== "ALL" ? next.set("source", state.source) : next.delete("source");
  state.entry !== "ALL" ? next.set("entry", state.entry) : next.delete("entry");
  return next;
}
