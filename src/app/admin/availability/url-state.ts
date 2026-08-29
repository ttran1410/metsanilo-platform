export type AvailabilityView = "WEEK" | "MONTH" | "TABLE";

export function parseAvailabilityUrlState(params: URLSearchParams) {
  const view = params.get("view")?.toUpperCase();
  const requestedStartDate = params.get("startDate") ?? "";
  return { viewMode: view === "MONTH" || view === "TABLE" ? view as AvailabilityView : "WEEK" as AvailabilityView, productFilter: params.get("productId") ?? "ALL", seasonFilter: params.get("seasonId") ?? "ALL", startDate: /^\d{4}-\d{2}-\d{2}$/.test(requestedStartDate) ? requestedStartDate : "" };
}

export function serializeAvailabilityUrlState(current: URLSearchParams, state: { viewMode: AvailabilityView; productFilter: string; seasonFilter: string; startDate: string }) {
  const next = new URLSearchParams(current.toString());
  next.delete("_rsc");
  next.set("view", state.viewMode);
  if (state.productFilter !== "ALL") next.set("productId", state.productFilter); else next.delete("productId");
  if (state.seasonFilter !== "ALL") next.set("seasonId", state.seasonFilter); else next.delete("seasonId");
  if (state.startDate) next.set("startDate", state.startDate); else next.delete("startDate");
  return next;
}
