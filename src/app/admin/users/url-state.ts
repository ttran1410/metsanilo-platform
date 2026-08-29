import type { Role } from "@/lib/permissions";

export type UserRoleFilter = Role | "ALL";

export function parseUsersUrlState(params: URLSearchParams, fallbackSelectedId = "") {
  const role = params.get("role");
  const roleFilter: UserRoleFilter = role === "ADMIN" || role === "MANAGER" || role === "STAFF" || role === "CONTENT_CREATOR" ? role : "ALL";
  return { selectedId: params.get("user") ?? fallbackSelectedId, searchQuery: params.get("q") ?? "", roleFilter };
}

export function serializeUsersUrlState(current: URLSearchParams, state: { selectedId: string; searchQuery: string; roleFilter: UserRoleFilter; page: number }) {
  const next = new URLSearchParams(current.toString());
  next.delete("_rsc");
  state.searchQuery ? next.set("q", state.searchQuery) : next.delete("q");
  state.roleFilter !== "ALL" ? next.set("role", state.roleFilter) : next.delete("role");
  state.selectedId ? next.set("user", state.selectedId) : next.delete("user");
  state.page > 1 ? next.set("page", String(state.page)) : next.delete("page");
  return next;
}
