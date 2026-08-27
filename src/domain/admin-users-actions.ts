import type { Database } from "@/db/client";
import { env } from "@/lib/env";
import { resetUserPermissionsToRole, revokeUserSessions as revokeUserSessionsDomain, setUserPermission as setUserPermissionDomain, toggleUserActive, updateUserProfile as updateUserProfileDomain, updateUserRole as updateUserRoleDomain, type Permission, type Role } from "./access";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";
import { DomainError } from "./errors";

export type UserActionContext = AdminActionContext & Readonly<{ request: Request }>;

export async function updateUserRole(database: Database, context: UserActionContext, input: { userId: string; role: Role }) {
  assertAdminActionContext(context);
  if (context.shop.id !== env().SHOP_ID) throw new DomainError("FORBIDDEN", "Invalid admin shop context", 403);
  if (input.userId === context.actor.id && (context.actor.role === "ADMIN" || context.actor.role === "MANAGER") && input.role !== context.actor.role) {
    throw new DomainError("FORBIDDEN", "Cannot change your own role", 403);
  }
  return updateUserRoleDomain(database, context.request, input);
}

export function updateUserStatus(database: Database, context: UserActionContext, input: { userId: string; active: boolean }) {
  assertAdminActionContext(context);
  return toggleUserActive(database, context.request, input);
}

export function resetUserPermissions(database: Database, context: UserActionContext, userId: string) {
  assertAdminActionContext(context);
  return resetUserPermissionsToRole(database, context.request, userId);
}

export function revokeUserSessions(database: Database, context: UserActionContext, userId: string) {
  assertAdminActionContext(context);
  return revokeUserSessionsDomain(database, context.request, userId);
}

export function updateUserProfile(database: Database, context: UserActionContext, input: { userId: string; displayName?: string; email?: string | null; role?: Role }) {
  assertAdminActionContext(context);
  return updateUserProfileDomain(database, context.request, input);
}

export function updateUserPermission(database: Database, context: UserActionContext, input: { userId: string; permission: Permission; granted: boolean }) {
  assertAdminActionContext(context);
  return setUserPermissionDomain(database, context.request, input);
}
