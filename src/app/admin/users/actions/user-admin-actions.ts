"use client";

import type { Role } from "@/lib/permissions";

export type UserActionResult<T = unknown> = { ok: boolean; status: number; data?: T; code?: string; message?: string };

async function requestUser<T>(userId: string, init: RequestInit): Promise<UserActionResult<T>> {
  const response = await fetch(`/api/admin/users/${userId}`, init);
  const body = await response.json().catch(() => ({})) as { data?: T; code?: string; message?: string };
  return { ok: response.ok, status: response.status, data: body.data, code: body.code, message: body.message };
}

export function updateUserStatus(userId: string, active: boolean) { return requestUser(userId, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "active", active }) }); }
export function revokeUserSessions(userId: string) { return requestUser(userId, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "revoke_sessions" }) }); }
export async function resetUserPassword(userId: string): Promise<UserActionResult<{ temporaryPassword: string }>> {
  const response = await fetch(`/api/admin/users/${userId}/password`, { method: "POST" });
  const body = await response.json().catch(() => ({})) as { data?: { temporaryPassword: string }; code?: string; message?: string };
  return { ok: response.ok, status: response.status, data: body.data, code: body.code, message: body.message };
}
export type UserRoleUpdateInput = { userId: string; displayName: string; currentRole: Role; nextRole: Role; actorId?: string; actorRole: Role };

export function updateUserRole(input: UserRoleUpdateInput) {
  const isSelf = input.actorId !== undefined && input.actorId === input.userId;
  if (isSelf && (input.actorRole === "ADMIN" || input.actorRole === "MANAGER") && input.nextRole !== input.actorRole) {
    return Promise.resolve<UserActionResult>({ ok: false, status: 403, code: "SELF_ROLE_CHANGE_FORBIDDEN", message: "You cannot change your own Admin or Manager role." });
  }
  return requestUser(input.userId, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "update", displayName: input.displayName, role: input.nextRole }) });
}
export function resetUserPermissions(userId: string) { return requestUser(userId, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reset_permissions" }) }); }
export async function updateUserPermission(userId: string, permission: string, granted: boolean) {
  const response = await fetch(`/api/admin/users/${userId}/permissions`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ permission, granted }) });
  const body = await response.json().catch(() => ({})) as { data?: unknown; code?: string; message?: string };
  return { ok: response.ok, status: response.status, data: body.data, code: body.code, message: body.message } satisfies UserActionResult;
}

export async function inviteUser(input: { displayName: string; email: string; role: string; password: string }): Promise<UserActionResult> {
  const response = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  const body = await response.json().catch(() => ({})) as { data?: unknown; code?: string; message?: string };
  return { ok: response.ok, status: response.status, data: body.data, code: body.code, message: body.message };
}
