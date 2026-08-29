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
  if (state.searchQuery) next.set("q", state.searchQuery); else next.delete("q");
  if (state.roleFilter !== "ALL") next.set("role", state.roleFilter); else next.delete("role");
  if (state.selectedId) next.set("user", state.selectedId); else next.delete("user");
  if (state.page > 1) next.set("page", String(state.page)); else next.delete("page");
  return next;
}
