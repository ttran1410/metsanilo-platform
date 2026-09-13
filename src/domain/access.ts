import { randomUUID } from "node:crypto";
import { and, desc, eq, ne, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, authAccounts, authSessions, userPermissions, users } from "@/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "./errors";
import { assertPassword, hashPassword, verifyPassword } from "./passwords";
import {
  evaluateSessionTiming,
  getBetterAuthSession,
  maskIpAddress,
  normalizeUserAgent,
  provisionUserWithAuth,
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

export async function createUser(
  database: Database,
  request: Request,
  input: { email: string; displayName: string; role: Role; password: string }
) {
  const actor = await requirePermission(database, request, "shop_users.manage");
  if (actor.role !== "ADMIN" && input.role === "ADMIN") throw new DomainError("FORBIDDEN", "Only Admin can create an Admin", 403);
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!zodEmail(email) || displayName.length < 2 || displayName.length > 120)
    throw new DomainError("VALIDATION_ERROR", "Invalid user details", 422);
  try {
    assertPassword(input.password);
  } catch (error) {
    throw new DomainError("VALIDATION_ERROR", error instanceof Error ? error.message : "Invalid password", 422);
  }
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  try {
    await provisionUserWithAuth(database, { id, shopId: env().SHOP_ID, email, displayName, role: input.role, hashedPassword: hashPassword(input.password), createdAt, auditActor: actor.email ?? actor.username ?? actor.id });
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) throw new DomainError("DUPLICATE_USER", "Username already exists", 409);
    throw error;
  }
  return (await database.query.users.findFirst({ where: eq(users.id, id) }))!;
}

export async function setUserPermission(
  database: Database,
  request: Request,
  input: { userId: string; permission: Permission; granted: boolean }
) {
  const actor = await requirePermission(database, request, "shop_permissions.assign");
  const target = await database.query.users.findFirst({ where: and(eq(users.id, input.userId), eq(users.shopId, env().SHOP_ID)) });
  if (!target) throw new DomainError("NOT_FOUND", "User not found", 404);
  const permission = normalizePermission(input.permission);
  if (!permission) throw new DomainError("VALIDATION_ERROR", "Permission is not available", 422);

  // Hierarchy check: Non-admins cannot modify permissions of an Admin account
  if (actor.role !== "ADMIN" && target.role === "ADMIN") {
    throw new DomainError("FORBIDDEN", "Only Admin can modify permissions of an Admin account", 403);
  }
  if (actor.role !== "ADMIN" && target.role === "MANAGER") {
    throw new DomainError("FORBIDDEN", "Managers cannot modify permissions of another Manager", 403);
  }

  const updatedAt = new Date().toISOString();
  await database.transaction(async (tx) => {
    await tx
      .insert(userPermissions)
      .values({ id: randomUUID(), shopId: env().SHOP_ID, userId: target.id, permission, granted: input.granted, updatedAt })
      .onConflictDoUpdate({ target: [userPermissions.userId, userPermissions.permission], set: { granted: input.granted, updatedAt } });
    await revokeAllUserSessions(tx, target.id);
    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId: env().SHOP_ID,
      actor: actor.email ?? actor.username ?? actor.id,
      action: input.granted ? "user.permission_granted" : "user.permission_revoked",
      entityType: "user",
      entityId: target.id,
      detailsJson: JSON.stringify({ permission }),
      createdAt: updatedAt,
    });
  });
  return { userId: target.id, permission, granted: input.granted };
}

export async function updateUserProfile(
  database: Database,
  request: Request,
  input: { userId: string; displayName?: string; role?: Role }
) {
  const actor = await requirePermission(database, request, "shop_users.manage");
  const target = await database.query.users.findFirst({
    where: and(eq(users.id, input.userId), eq(users.shopId, env().SHOP_ID)),
  });
  if (!target) throw new DomainError("NOT_FOUND", "User not found", 404);

  // Hierarchy check: Non-admins cannot edit ADMIN accounts or elevate role to ADMIN
  if (actor.role !== "ADMIN") {
    if (target.role === "ADMIN") {
      throw new DomainError("FORBIDDEN", "Only Admin can modify an Admin account", 403);
    }
    if (input.role === "ADMIN") {
      throw new DomainError("FORBIDDEN", "Only Admin can set role to Admin", 403);
    }
  }

  // Prevent demoting self if actor is editing their own user record
  if (target.id === actor.id && input.role && input.role !== target.role) {
    throw new DomainError("FORBIDDEN", "Cannot change your own role", 403);
  }

  const updates: Partial<Pick<typeof users.$inferInsert, "displayName" | "email" | "role">> = {};
  if (input.displayName && input.displayName.trim()) {
    updates.displayName = input.displayName.trim();
  }
  if (input.role) {
    updates.role = input.role;
  }

  const roleChanged = input.role !== undefined && input.role !== target.role;

  if (Object.keys(updates).length > 0) {
    await database.transaction(async (tx) => {
      await tx
        .update(users)
        .set(updates)
        .where(and(eq(users.id, input.userId), eq(users.shopId, env().SHOP_ID)))
        .run();

      if (roleChanged) {
        await revokeAllUserSessions(tx, target.id);
      }

      await tx.insert(auditEntries).values({
        id: randomUUID(),
        shopId: env().SHOP_ID,
        actor: actor.email ?? actor.username ?? actor.id,
        action: "user.profile_updated",
        entityType: "user",
        entityId: target.id,
        detailsJson: JSON.stringify(updates),
        createdAt: new Date().toISOString(),
      });
    });
  }

  return (await database.query.users.findFirst({ where: eq(users.id, input.userId) }))!;
}

export async function updateUserRole(database: Database, request: Request, input: { userId: string; role: Role }) {
  const actor = await requirePermission(database, request, "shop_users.manage");
  if (input.userId === actor.id && (actor.role === "ADMIN" || actor.role === "MANAGER") && input.role !== actor.role) {
    throw new DomainError("FORBIDDEN", "Cannot change your own role", 403);
  }
  if (actor.role !== "ADMIN" && input.role === "ADMIN") throw new DomainError("FORBIDDEN", "Only Admin can set role to Admin", 403);
  const target = await database.query.users.findFirst({ where: and(eq(users.id, input.userId), eq(users.shopId, env().SHOP_ID)) });
  if (!target) throw new DomainError("NOT_FOUND", "User not found", 404);

  const updatedAt = new Date().toISOString();
  await database.transaction(async (tx) => {
    await tx.update(users).set({ role: input.role }).where(and(eq(users.id, input.userId), eq(users.shopId, env().SHOP_ID))).run();
    await revokeAllUserSessions(tx, input.userId);
  });

  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId: env().SHOP_ID,
    actor: actor.email ?? actor.username ?? actor.id,
    action: "user.role_updated",
    entityType: "user",
    entityId: target.id,
    detailsJson: JSON.stringify({ fromRole: target.role, toRole: input.role }),
    createdAt: updatedAt,
  });

  return (await database.query.users.findFirst({ where: eq(users.id, input.userId) }))!;
}

export async function toggleUserActive(database: Database, request: Request, input: { userId: string; active: boolean }) {
  const actor = await requirePermission(database, request, "shop_users.manage");
  const target = await database.query.users.findFirst({ where: and(eq(users.id, input.userId), eq(users.shopId, env().SHOP_ID)) });
  if (!target) throw new DomainError("NOT_FOUND", "User not found", 404);
  if (target.id === actor.id) throw new DomainError("FORBIDDEN", "Cannot suspend your own account", 403);

  const updatedAt = new Date().toISOString();
  await database.transaction(async (tx) => {
    await tx.update(users).set({ active: input.active }).where(and(eq(users.id, input.userId), eq(users.shopId, env().SHOP_ID))).run();
    await revokeAllUserSessions(tx, input.userId);
  });

  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId: env().SHOP_ID,
    actor: actor.email ?? actor.username ?? actor.id,
    action: input.active ? "user.activated" : "user.suspended",
    entityType: "user",
    entityId: target.id,
    detailsJson: JSON.stringify({ active: input.active }),
    createdAt: updatedAt,
  });

  return (await database.query.users.findFirst({ where: eq(users.id, input.userId) }))!;
}

export async function resetUserPermissionsToRole(database: Database, request: Request, userId: string) {
  const actor = await requirePermission(database, request, "shop_permissions.assign");
  const target = await database.query.users.findFirst({ where: and(eq(users.id, userId), eq(users.shopId, env().SHOP_ID)) });
  if (!target) throw new DomainError("NOT_FOUND", "User not found", 404);

  const updatedAt = new Date().toISOString();
  const defaults = defaultPermissionsForRole(target.role);
  await database.transaction(async (tx) => {
    await tx
      .delete(userPermissions)
      .where(and(eq(userPermissions.userId, userId), eq(userPermissions.shopId, env().SHOP_ID)))
      .run();

    if (defaults.length) {
      await tx.insert(userPermissions).values(
        defaults.map((permission) => ({
          id: randomUUID(),
          shopId: env().SHOP_ID,
          userId,
          permission,
          granted: true,
          updatedAt,
        }))
      );
    }

    await revokeAllUserSessions(tx, userId);

    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId: env().SHOP_ID,
      actor: actor.email ?? actor.username ?? actor.id,
      action: "user.permissions_reset_to_default",
      entityType: "user",
      entityId: userId,
      detailsJson: JSON.stringify({ role: target.role }),
      createdAt: updatedAt,
    });
  });

  return { userId, role: target.role, defaults };
}

export function assertCanManageUserSessions(
  actor: { id: string; role: Role },
  targetUser: { id: string; role: Role }
) {
  if (actor.id === targetUser.id) return; // Self-management always allowed
  if (actor.role === "ADMIN") return; // Admin can manage anyone
  if (targetUser.role === "ADMIN") {
    throw new DomainError("FORBIDDEN", "Only an ADMIN may manage an ADMIN user session", 403);
  }
  if (actor.role === "MANAGER" && targetUser.role === "MANAGER") {
    throw new DomainError("FORBIDDEN", "Managers may not manage sessions of other managers", 403);
  }
}

export async function getUserSessions(database: Database, userId: string, now: Date = new Date()) {
  const shopId = env().SHOP_ID;
  const targetUser = await database.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.shopId, shopId)),
  });
  if (!targetUser) {
    throw new DomainError("NOT_FOUND", "User not found", 404);
  }

  const sessions = await database
    .select()
    .from(authSessions)
    .where(eq(authSessions.userId, userId))
    .orderBy(desc(authSessions.updatedAt));

  return sessions
    .map((s) => {
      const timing = evaluateSessionTiming(
        {
          createdAt: s.createdAt,
          lastActivityAt: s.lastActivityAt,
          providerExpiresAt: s.expiresAt,
        },
        now
      );
      if (timing.expired) return null;

      const lastActivityDate = s.lastActivityAt ? new Date(s.lastActivityAt) : new Date(s.createdAt);

      return {
        id: s.id,
        ipAddress: maskIpAddress(s.ipAddress),
        userAgent: normalizeUserAgent(s.userAgent),
        createdAt: new Date(s.createdAt).toISOString(),
        lastActivityAt: lastActivityDate.toISOString(),
        idleExpiresAt: timing.idleExpiresAt.toISOString(),
        absoluteExpiresAt: timing.absoluteExpiresAt.toISOString(),
        effectiveExpiresAt: timing.effectiveExpiresAt.toISOString(),
        remainingSeconds: timing.remainingSeconds,
        warning: timing.warning,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
}

export async function revokeSingleSession(
  database: Database,
  request: Request,
  targetUserId: string,
  sessionId: string,
  reason?: string
) {
  const actor = await currentUser(database, request);
  const shopId = env().SHOP_ID;

  const targetUser = await database.query.users.findFirst({
    where: and(eq(users.id, targetUserId), eq(users.shopId, shopId)),
  });
  if (!targetUser) {
    throw new DomainError("NOT_FOUND", "User not found", 404);
  }

  if (actor.id !== targetUserId) {
    await requirePermission(database, request, "shop_users.manage");
    assertCanManageUserSessions(actor, targetUser);
  }

  const updatedAt = new Date().toISOString();
  let affectedCount = 0;

  await database.transaction(async (tx) => {
    const result = await tx
      .delete(authSessions)
      .where(and(eq(authSessions.id, sessionId), eq(authSessions.userId, targetUserId)))
      .run();
    affectedCount = result.rowsAffected;

    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId,
      actor: actor.email ?? actor.username ?? actor.id,
      action: "user.session_revoked",
      entityType: "user",
      entityId: targetUserId,
      detailsJson: JSON.stringify({
        sessionId,
        affectedCount,
        reason: reason ?? (actor.id === targetUserId ? "Self-revocation" : "Operator request"),
      }),
      createdAt: updatedAt,
    });
  });

  return { userId: targetUserId, sessionId, revoked: true, affectedCount };
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
  const shopId = env().SHOP_ID;

  const targetUser = await database.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.shopId, shopId)),
  });
  if (!targetUser) {
    throw new DomainError("NOT_FOUND", "User not found", 404);
  }

  if (actor.id !== userId) {
    await requirePermission(database, request, "shop_users.manage");
    assertCanManageUserSessions(actor, targetUser);
  }

  const updatedAt = new Date().toISOString();
  let affectedCount = 0;

  await database.transaction(async (tx) => {
    const result = await tx.delete(authSessions).where(eq(authSessions.userId, userId)).run();
    affectedCount = result.rowsAffected;
    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId,
      actor: actor.email ?? actor.username ?? actor.id,
      action: "user.sessions_revoked",
      entityType: "user",
      entityId: userId,
      detailsJson: JSON.stringify({
        revokedAll: true,
        affectedCount,
        reason: reason ?? (actor.id === userId ? "Self logout all" : "Operator request"),
      }),
      createdAt: updatedAt,
    });
  });

  return { userId, revoked: true, affectedCount };
}

export async function getUserAuditTrail(database: Database, userId: string) {
  return database
    .select({
      id: auditEntries.id,
      action: auditEntries.action,
      actor: auditEntries.actor,
      detailsJson: auditEntries.detailsJson,
      createdAt: auditEntries.createdAt,
    })
    .from(auditEntries)
    .where(
      and(
        eq(auditEntries.shopId, env().SHOP_ID),
        eq(auditEntries.entityType, "user"),
        eq(auditEntries.entityId, userId)
      )
    )
    .orderBy(desc(auditEntries.createdAt))
    .limit(30);
}

export async function getUserAccessDetail(database: Database, userId: string) {
  const shopId = env().SHOP_ID;
  const user = await database.query.users.findFirst({ where: and(eq(users.id, userId), eq(users.shopId, shopId)) });
  if (!user) throw new DomainError("NOT_FOUND", "User not found", 404);

  const grants = await database.select().from(userPermissions).where(and(eq(userPermissions.userId, userId), eq(userPermissions.shopId, shopId)));
  const defaults = defaultPermissionsForRole(user.role);
  const revoked = grants
    .filter((grant) => !grant.granted)
    .map((grant) => normalizePermission(grant.permission))
    .filter((permission): permission is Permission => Boolean(permission));
  const added = grants
    .filter((grant) => grant.granted)
    .map((grant) => normalizePermission(grant.permission))
    .filter((permission): permission is Permission => Boolean(permission));
  const effectivePermissions = [...new Set([...defaults.filter((permission) => !revoked.includes(permission)), ...added])];

  const [sessions, audit] = await Promise.all([getUserSessions(database, userId), getUserAuditTrail(database, userId)]);
  return {
    user,
    permissions: effectivePermissions,
    customOverrides: {
      granted: added.filter((permission) => !defaults.includes(permission)),
      revoked: [...new Set(revoked)],
    },
    sessions,
    audit,
  };
}

function zodEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
