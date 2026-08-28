import type { NotificationSeverity, NotificationStateFilter } from "@/domain/notifications";

export type NotificationsUrlState = {
  state: NotificationStateFilter;
  category?: string;
  severity?: NotificationSeverity;
  query?: string;
  page: number;
};

export function parseNotificationsUrlState(params: URLSearchParams): NotificationsUrlState {
  const state = params.get("state");
  const severity = params.get("severity");
  return {
    state: state === "READ" || state === "ALL" ? state : "UNREAD",
    category: params.get("category") ?? undefined,
    severity: severity === "HIGH" || severity === "STANDARD" || severity === "INFO" ? severity : undefined,
    query: params.get("q") ?? undefined,
    page: Math.max(1, Number(params.get("page") ?? "1") || 1),
  };
}

export function serializeNotificationsUrlState(state: NotificationsUrlState) {
  const params = new URLSearchParams();
  params.set("state", state.state);
  if (state.category && state.category !== "ALL") params.set("category", state.category);
  if (state.severity) params.set("severity", state.severity);
  if (state.query) params.set("q", state.query);
  if (state.page > 1) params.set("page", String(state.page));
  return params;
}
