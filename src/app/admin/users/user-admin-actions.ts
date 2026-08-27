"use client";

export type UserActionResult<T = unknown> = { ok: boolean; status: number; data?: T; code?: string; message?: string };

async function requestUser<T>(userId: string, init: RequestInit): Promise<UserActionResult<T>> {
  const response = await fetch(`/api/admin/users/${userId}`, init);
  const body = await response.json().catch(() => ({})) as { data?: T; code?: string; message?: string };
  return { ok: response.ok, status: response.status, data: body.data, code: body.code, message: body.message };
}

export function updateUserStatus(userId: string, active: boolean) { return requestUser(userId, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "active", active }) }); }
export function revokeUserSessions(userId: string) { return requestUser(userId, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "revoke_sessions" }) }); }
export function resetUserPassword(userId: string) { return requestUser<{ temporaryPassword: string }>(userId, { method: "POST" }); }
