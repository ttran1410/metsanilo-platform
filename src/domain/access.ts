import { randomUUID } from "node:crypto";
import { and, eq, ne, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, authAccounts, authSessions, userPermissions, users } from "@/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "./errors";
import { assertPassword, hashPassword, verifyPassword } from "./passwords";
import {
  getBetterAuthSession,
  revokeAllUserSessions,
  type SessionTiming,
  validateBetterAuthSession,
} from "@/lib/auth-integration";
import { defaultPermissionsForRole, PERMISSIONS, type Permission, type Role } from "@/lib/permissions";

export { COMING_SOON_PERMISSIONS, PERMISSIONS, defaultPermissionsForRole } from "@/lib/permissions";
export type { Permission, Role } from "@/lib/permissions";

export function assertOperationalAccess(actor: { mustChangePassword?: boolean | null; [key: string]: unknown }) {
  if (actor.mustChangePassword) {
    throw new DomainError("FORBIDDEN", "Password change required before accessing operations", 403, undefined, { reason: "PASSWORD_CHANGE_REQUIRED" });
  }
}

/** Temporary aliases keep existing grants and callers working while the
 * permission editor migrates users to the clearer read/write names. */
const LEGACY_PERMISSION_ALIASES: Partial<Record<string, Permission>> = {
  "catalog.product.delete_unreferenced": "catalog.product.delete",
};

export function normalizePermission(permission: string): Permission | null {
  return (PERMISSIONS as readonly string[]).includes(permission)
    ? (permission as Permission)
    : LEGACY_PERMISSION_ALIASES[permission] ?? null;
}

export type AuthContext = {
  actor: typeof users.$inferSelect;
  mechanism: "better_auth";
  sessionId: string;
  timing: SessionTiming;
};

export async function currentAuthContext(
  database: Database,
  request: Request,
  now: Date = new Date()
): Promise<AuthContext> {
  let betterSession: Awaited<ReturnType<typeof getBetterAuthSession>>;
  try {
    betterSession = await getBetterAuthSession(request);
  } catch {
    throw new DomainError("UNAUTHORIZED", "Authentication required", 401);
  }

  if (!betterSession?.user?.id || !betterSession?.session?.id) {
    throw new DomainError("UNAUTHORIZED", "Authentication required", 401);
  }

  const validated = await validateBetterAuthSession(database, betterSession.session.id, betterSession.user.id, now);
  if (!validated.valid) {
    if (validated.reason === "expired") {
      throw new DomainError("UNAUTHORIZED", "Session expired", 401);
    }
    throw new DomainError("FORBIDDEN", "User is not active in this shop", 403);
  }

  return {
    actor: validated.user,
    mechanism: "better_auth",
    sessionId: betterSession.session.id,
    timing: validated.timing,
  };
}

export async function currentUser(database: Database, request: Request, now: Date = new Date()) {
  const context = await currentAuthContext(database, request, now);
  return context.actor;
}

export async function hasUserPermission(
  database: Database,
  actor: { id: string; shopId: string; role: Role },
  permission: Permission
): Promise<boolean> {
  if (actor.role === "ADMIN" || actor.role === "MANAGER") return true;
  const normalized = normalizePermission(permission);
  if (!normalized) return false;
  const legacyNames = Object.entries(LEGACY_PERMISSION_ALIASES)
    .filter(([, target]) => target === normalized)
    .map(([name]) => name);
  const grant = await database.query.userPermissions.findFirst({
    where: and(
      eq(userPermissions.userId, actor.id),
      eq(userPermissions.shopId, actor.shopId),
      legacyNames.length
        ? or(eq(userPermissions.permission, normalized), ...legacyNames.map((name) => eq(userPermissions.permission, name)))
        : eq(userPermissions.permission, normalized)
    ),
  });
  if (grant) return grant.granted;
  return defaultPermissionsForRole(actor.role).includes(normalized);
}

export async function requirePermission(database: Database, request: Request, permission: Permission) {
  const actor = await currentUser(database, request);
  const allowed = await hasUserPermission(database, actor, permission);
  if (!allowed) throw new DomainError("FORBIDDEN", `Permission required: ${permission}`, 403);
  return actor;
}

export async function listUsers(database: Database, request: Request) {
  await requirePermission(database, request, "shop_users.manage");
  const shopId = env().SHOP_ID;
  const rows = await database.select().from(users).where(eq(users.shopId, shopId));
  const grants = await database.select().from(userPermissions).where(eq(userPermissions.shopId, shopId));

  return rows.map((user) => {
    const defaults = defaultPermissionsForRole(user.role);
    const userGrants = grants.filter((grant) => grant.userId === user.id);
    const revoked = new Set(
      userGrants
        .filter((grant) => !grant.granted)
        .map((grant) => normalizePermission(grant.permission))
        .filter(Boolean)
    );
    const added = userGrants
      .filter((grant) => grant.granted)
      .map((grant) => normalizePermission(grant.permission))
      .filter(Boolean) as Permission[];

    const customOverrides = {
      granted: added.filter((p) => !defaults.includes(p)),
      revoked: [...revoked],
    };

    return {
      ...user,
      permissions: [...new Set([...defaults.filter((permission) => !revoked.has(permission)), ...added])],
      customOverrides,
    };
  });
}

import {
  createUser as createCanonicalUser,
  getUserAccessDetail as getCanonicalUserAccessDetail,
  getUserAuditTrail as getCanonicalUserAuditTrail,
  getUserSessions as getCanonicalUserSessions,
  resetUserPermissionsToRole as resetCanonicalUserPermissionsToRole,
  revokeSingleSession as revokeCanonicalSingleSession,
  revokeUserSessions as revokeCanonicalUserSessions,
  toggleUserActive as toggleCanonicalUserActive,
  updateUserPermission as updateCanonicalUserPermission,
  updateUserProfile as updateCanonicalUserProfile,
  updateUserRole as updateCanonicalUserRole,
} from "./admin-user-actions";

export async function createUser(
  database: Database,
  request: Request,
  input: { email: string; displayName: string; role: Role; password: string }
) {
  const actor = await requirePermission(database, request, "shop_users.manage");
  return createCanonicalUser(database, { actor, shop: { id: env().SHOP_ID } }, input);
}

export async function setUserPermission(
  database: Database,
  request: Request,
  input: { userId: string; permission: Permission; granted: boolean }
) {
  const actor = await requirePermission(database, request, "shop_permissions.assign");
  return updateCanonicalUserPermission(database, { actor, shop: { id: env().SHOP_ID } }, input);
}

export async function updateUserProfile(
  database: Database,
  request: Request,
  input: { userId: string; displayName?: string; role?: Role }
) {
  const actor = await requirePermission(database, request, "shop_users.manage");
  return updateCanonicalUserProfile(database, { actor, shop: { id: env().SHOP_ID } }, input);
}

export async function updateUserRole(database: Database, request: Request, input: { userId: string; role: Role }) {
  const actor = await requirePermission(database, request, "shop_users.manage");
  return updateCanonicalUserRole(database, { actor, shop: { id: env().SHOP_ID } }, input);
}

export async function toggleUserActive(database: Database, request: Request, input: { userId: string; active: boolean }) {
  const actor = await requirePermission(database, request, "shop_users.manage");
  return toggleCanonicalUserActive(database, { actor, shop: { id: env().SHOP_ID } }, input);
}

export async function resetUserPermissionsToRole(database: Database, request: Request, userId: string) {
  const actor = await requirePermission(database, request, "shop_permissions.assign");
  return resetCanonicalUserPermissionsToRole(database, { actor, shop: { id: env().SHOP_ID } }, userId);
}

export { assertCanManageTarget as assertCanManageUserSessions } from "./admin-user-actions";

export async function getUserSessions(
  database: Database,
  actorOrRequest: typeof users.$inferSelect | Request,
  userId?: string,
  now: Date = new Date()
) {
  const actor = actorOrRequest instanceof Request
    ? await currentUser(database, actorOrRequest)
    : actorOrRequest;
  const targetUserId = userId ?? actor.id;
  return getCanonicalUserSessions(database, { actor, shop: { id: env().SHOP_ID } }, targetUserId, now);
}

export async function revokeSingleSession(
  database: Database,
  request: Request,
  targetUserId: string,
  sessionId: string,
  reason?: string
) {
  const actor = await currentUser(database, request);
  if (actor.id !== targetUserId) {
    await requirePermission(database, request, "shop_users.manage");
  }
  return revokeCanonicalSingleSession(database, { actor, shop: { id: env().SHOP_ID } }, { targetUserId, sessionId, reason });
}

export async function revokeCurrentSession(database: Database, request: Request) {
  const authContext = await currentAuthContext(database, request);
  if (authContext.mechanism === "better_auth" && authContext.sessionId) {
    return revokeSingleSession(database, request, authContext.actor.id, authContext.sessionId, "Self sign out");
  }

  const createdAt = new Date().toISOString();
  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId: env().SHOP_ID,
    actor: authContext.actor.email ?? authContext.actor.username ?? authContext.actor.id,
    action: "user.session_revoked",
    entityType: "user",
    entityId: authContext.actor.id,
    detailsJson: JSON.stringify({ scope: "current", mechanism: authContext.mechanism, affectedCount: 0, reason: "Self sign out" }),
    createdAt,
  });
  return { userId: authContext.actor.id, revoked: true, affectedCount: 0 };
}

export async function revokeOtherUserSessions(
  database: Database,
  request: Request,
  currentSessionId: string
) {
  const actor = await currentUser(database, request);
  const shopId = env().SHOP_ID;
  const updatedAt = new Date().toISOString();
  let affectedCount = 0;

  await database.transaction(async (tx) => {
    const result = await tx
      .delete(authSessions)
      .where(and(eq(authSessions.userId, actor.id), ne(authSessions.id, currentSessionId)))
      .run();
    affectedCount = result.rowsAffected;

    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId,
      actor: actor.email ?? actor.username ?? actor.id,
      action: "user.sessions_revoked",
      entityType: "user",
      entityId: actor.id,
      detailsJson: JSON.stringify({
        scope: "others",
        keepSessionId: currentSessionId,
        affectedCount,
        reason: "Revoke other sessions",
      }),
      createdAt: updatedAt,
    });
  });

  return { userId: actor.id, revoked: true, affectedCount };
}

export async function revokeUserSessions(
  database: Database,
  request: Request,
  userId: string,
  reason?: string
) {
  const actor = await currentUser(database, request);
  if (actor.id !== userId) {
    await requirePermission(database, request, "shop_users.manage");
  }
  return revokeCanonicalUserSessions(database, { actor, shop: { id: env().SHOP_ID } }, { targetUserId: userId, reason });
}

export async function getUserAuditTrail(database: Database, request: Request, userId: string) {
  const actor = await requirePermission(database, request, "shop_users.read");
  return getCanonicalUserAuditTrail(database, { actor, shop: { id: env().SHOP_ID } }, userId);
}

export async function getUserAccessDetail(database: Database, request: Request, userId: string) {
  const actor = await requirePermission(database, request, "shop_users.read");
  return getCanonicalUserAccessDetail(database, { actor, shop: { id: env().SHOP_ID } }, userId);
}

export type SelfPasswordActionActor = { id: string; role: Role; shopId: string; email?: string | null };
export type SelfPasswordActionShop = { id: string };
export type SelfPasswordActionContext = { actor: SelfPasswordActionActor; shop: SelfPasswordActionShop };

export type SelfPasswordDependencies = {
  setCredentialPassword: (database: Pick<Database, "update">, userId: string, password: string) => Promise<void>;
  revokeAllUserSessions: (database: Pick<Database, "delete">, userId: string) => Promise<void>;
};

export async function changeOwnPassword(
  database: Database,
  context: SelfPasswordActionContext,
  input: { currentPassword: string; newPassword: string },
  now: Date = new Date(),
  overrides: Partial<SelfPasswordDependencies> = {}
) {
  const configuredShopId = env().SHOP_ID;
  if (context.actor.shopId !== context.shop.id || context.shop.id !== configuredShopId) {
    throw new DomainError("FORBIDDEN", "Action context shop mismatch", 403);
  }

  if (typeof input.currentPassword !== "string" || input.currentPassword.length === 0) {
    throw new DomainError("VALIDATION_ERROR", "Current password is required", 422);
  }

  try {
    assertPassword(input.newPassword);
  } catch (err) {
    throw new DomainError(
      "VALIDATION_ERROR",
      err instanceof Error ? err.message : "Password does not meet security rules",
      422
    );
  }

  const target = await database.query.users.findFirst({
    where: and(
      eq(users.id, context.actor.id),
      eq(users.shopId, context.shop.id),
      eq(users.active, true)
    ),
  });

  if (!target) {
    throw new DomainError("NOT_FOUND", "User not found", 404);
  }

  const credential = await database.query.authAccounts.findFirst({
    where: and(eq(authAccounts.userId, target.id), eq(authAccounts.providerId, "credential")),
  });
  const currentPasswordHash = credential?.password;
  if (!currentPasswordHash || !verifyPassword(input.currentPassword, currentPasswordHash)) {
    throw new DomainError("UNAUTHORIZED", "Current password is incorrect", 401);
  }

  const nowIso = now.toISOString();
  const hashedPassword = hashPassword(input.newPassword);

  const setCredential = overrides.setCredentialPassword ?? (async (db, userId, password) => {
    const result = await db.update(authAccounts).set({ password, updatedAt: new Date() }).where(
      and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, "credential"), eq(authAccounts.password, currentPasswordHash))
    ).run();
    if (result.rowsAffected !== 1) throw new DomainError("CONFLICT", "User was modified concurrently", 409);
  });
  const revokeSessions = overrides.revokeAllUserSessions ?? revokeAllUserSessions;

  await database.transaction(async (tx) => {
    await tx.update(users).set({ mustChangePassword: false, temporaryPasswordIssuedAt: null, temporaryPasswordExpiresAt: null }).where(and(eq(users.id, target.id), eq(users.shopId, context.shop.id))).run();
    await setCredential(tx, target.id, hashedPassword);
    await revokeSessions(tx, target.id);

    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId: context.shop.id,
      actor: context.actor.email ?? context.actor.id,
      action: "user.password_changed",
      entityType: "user",
      entityId: target.id,
      detailsJson: JSON.stringify({ selfService: true }),
      createdAt: nowIso,
    });

    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId: context.shop.id,
      actor: context.actor.email ?? context.actor.id,
      action: "user.sessions_revoked",
      entityType: "user",
      entityId: target.id,
      detailsJson: JSON.stringify({ reason: "password_changed", selfService: true }),
      createdAt: nowIso,
    });
  });

  return { changed: true, requireSignIn: true };
}
