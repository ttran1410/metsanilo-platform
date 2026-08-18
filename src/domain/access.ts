import { randomUUID } from "node:crypto";
import { and, desc, eq, or, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, authAccounts, authSessions, authUsers, userPermissions, users } from "@/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "./errors";
import { readSession, SESSION_COOKIE } from "./session";
import { assertPassword, hashPassword, verifyPassword } from "./passwords";
import { betterAuthInstance } from "@/lib/better-auth";
import { COMING_SOON_PERMISSIONS, defaultPermissionsForRole, PERMISSIONS, type Permission, type Role } from "@/lib/permissions";

export { COMING_SOON_PERMISSIONS, PERMISSIONS, defaultPermissionsForRole } from "@/lib/permissions";
export type { Permission, Role } from "@/lib/permissions";

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

function usernameFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) throw new DomainError("UNAUTHORIZED", "Authentication required", 401);
  const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator <= 0) throw new DomainError("UNAUTHORIZED", "Authentication required", 401);
  return decoded.slice(0, separator);
}

export async function currentUser(database: Database, request: Request) {
  const shopId = env().SHOP_ID;
  try {
    const betterSession = await betterAuthInstance.api.getSession({ headers: request.headers });
    if (betterSession?.user?.id) {
      const mapped = await database.query.users.findFirst({
        where: and(eq(users.id, betterSession.user.id), eq(users.shopId, shopId), eq(users.active, true)),
      });
      if (mapped) return mapped;
    }
  } catch {
    /* Fall through */
  }
  const cookie = request.headers.get("cookie")?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
  const session = readSession(cookie);
  const identifier = session?.email ?? usernameFromRequest(request);
  const user =
    (await database.query.users.findFirst({
      where: and(eq(users.shopId, shopId), eq(users.email, identifier), eq(users.active, true)),
    })) ??
    (await database.query.users.findFirst({
      where: and(eq(users.shopId, shopId), eq(users.username, identifier), eq(users.active, true)),
    }));
  if (session && user && user.sessionVersion !== session.sessionVersion) throw new DomainError("UNAUTHORIZED", "Session expired", 401);
  if (user) return user;
  if (identifier === "manager")
    return {
      id: "legacy-admin",
      shopId,
      email: null,
      username: null,
      passwordHash: "",
      mustChangePassword: false,
      sessionVersion: 1,
      displayName: "Legacy admin",
      role: "ADMIN" as const,
      active: true,
      createdAt: "legacy",
    };
  throw new DomainError("FORBIDDEN", "User is not active in this shop", 403);
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
    const passwordHash = hashPassword(input.password);
    await database.insert(users).values({
      id,
      shopId: env().SHOP_ID,
      username: email,
      email,
      passwordHash,
      mustChangePassword: true,
      sessionVersion: 1,
      displayName,
      role: input.role,
      active: true,
      createdAt,
    });
    const now = new Date();
    await database.insert(authUsers).values({ id, name: displayName, email, emailVerified: true, image: null, createdAt: now, updatedAt: now });
    await database.insert(authAccounts).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: passwordHash, createdAt: now, updatedAt: now });
    const defaults = defaultPermissionsForRole(input.role);
    if (defaults.length)
      await database.insert(userPermissions).values(
        defaults.map((permission) => ({
          id: randomUUID(),
          shopId: env().SHOP_ID,
          userId: id,
          permission,
          granted: true,
          updatedAt: createdAt,
        }))
      );
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) throw new DomainError("DUPLICATE_USER", "Username already exists", 409);
    throw error;
  }
  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId: env().SHOP_ID,
    actor: actor.email ?? actor.username ?? actor.id,
    action: "user.created",
    entityType: "user",
    entityId: id,
    detailsJson: JSON.stringify({ email, role: input.role }),
    createdAt,
  });
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
  await database
    .insert(userPermissions)
    .values({ id: randomUUID(), shopId: env().SHOP_ID, userId: target.id, permission, granted: input.granted, updatedAt })
    .onConflictDoUpdate({ target: [userPermissions.userId, userPermissions.permission], set: { granted: input.granted, updatedAt } });
  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId: env().SHOP_ID,
    actor: actor.email ?? actor.username ?? actor.id,
    action: input.granted ? "user.permission_granted" : "user.permission_revoked",
    entityType: "user",
    entityId: target.id,
    detailsJson: JSON.stringify({ permission }),
    createdAt: updatedAt,
  });
  return { userId: target.id, permission, granted: input.granted };
}

export async function updateUserProfile(
  database: Database,
  request: Request,
  input: { userId: string; displayName?: string; email?: string | null; role?: Role }
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

  const updates: Record<string, any> = {};
  if (input.displayName && input.displayName.trim()) {
    updates.displayName = input.displayName.trim();
  }
  if (input.email !== undefined) {
    const emailVal = input.email && input.email.trim() ? input.email.trim().toLowerCase() : null;
    if (emailVal && emailVal !== target.email) {
      const existing = await database.query.users.findFirst({
        where: and(eq(users.email, emailVal), eq(users.shopId, env().SHOP_ID)),
      });
      if (existing) {
        throw new DomainError("CONFLICT", "Email is already in use by another user", 409);
      }
    }
    updates.email = emailVal;
  }
  if (input.role) {
    updates.role = input.role;
  }

  if (Object.keys(updates).length > 0) {
    await database
      .update(users)
      .set(updates)
      .where(and(eq(users.id, input.userId), eq(users.shopId, env().SHOP_ID)))
      .run();

    await database.insert(auditEntries).values({
      id: randomUUID(),
      shopId: env().SHOP_ID,
      actor: actor.email ?? actor.username ?? actor.id,
      action: "user.profile_updated",
      entityType: "user",
      entityId: target.id,
      detailsJson: JSON.stringify(updates),
      createdAt: new Date().toISOString(),
    });
  }

  return (await database.query.users.findFirst({ where: eq(users.id, input.userId) }))!;
}

export async function updateUserRole(database: Database, request: Request, input: { userId: string; role: Role }) {
  const actor = await requirePermission(database, request, "shop_users.manage");
  if (actor.role !== "ADMIN" && input.role === "ADMIN") throw new DomainError("FORBIDDEN", "Only Admin can set role to Admin", 403);
  const target = await database.query.users.findFirst({ where: and(eq(users.id, input.userId), eq(users.shopId, env().SHOP_ID)) });
  if (!target) throw new DomainError("NOT_FOUND", "User not found", 404);

  const updatedAt = new Date().toISOString();
  await database
    .update(users)
    .set({ role: input.role })
    .where(and(eq(users.id, input.userId), eq(users.shopId, env().SHOP_ID)))
    .run();

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
  await database
    .update(users)
    .set({ active: input.active, sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(and(eq(users.id, input.userId), eq(users.shopId, env().SHOP_ID)))
    .run();

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
  await database
    .delete(userPermissions)
    .where(and(eq(userPermissions.userId, userId), eq(userPermissions.shopId, env().SHOP_ID)))
    .run();

  const defaults = defaultPermissionsForRole(target.role);
  if (defaults.length) {
    await database.insert(userPermissions).values(
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

  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId: env().SHOP_ID,
    actor: actor.email ?? actor.username ?? actor.id,
    action: "user.permissions_reset_to_default",
    entityType: "user",
    entityId: userId,
    detailsJson: JSON.stringify({ role: target.role }),
    createdAt: updatedAt,
  });

  return { userId, role: target.role, defaults };
}

export async function getUserSessions(database: Database, userId: string) {
  const sessions = await database
    .select()
    .from(authSessions)
    .where(eq(authSessions.userId, userId))
    .orderBy(desc(authSessions.updatedAt));

  return sessions.map((s) => ({
    id: s.id,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    createdAt: new Date(s.createdAt).toISOString(),
    expiresAt: new Date(s.expiresAt).toISOString(),
  }));
}

export async function revokeUserSessions(database: Database, request: Request, userId: string) {
  const actor = await requirePermission(database, request, "shop_users.manage");
  const updatedAt = new Date().toISOString();

  await database.delete(authSessions).where(eq(authSessions.userId, userId)).run();
  await database
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(and(eq(users.id, userId), eq(users.shopId, env().SHOP_ID)))
    .run();

  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId: env().SHOP_ID,
    actor: actor.email ?? actor.username ?? actor.id,
    action: "user.sessions_revoked",
    entityType: "user",
    entityId: userId,
    detailsJson: JSON.stringify({ revokedAll: true }),
    createdAt: updatedAt,
  });

  return { userId, revoked: true };
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

function zodEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function authenticateUser(database: Database, email: string, password: string) {
  const user = await database.query.users.findFirst({
    where: and(eq(users.email, email.trim().toLowerCase()), eq(users.shopId, env().SHOP_ID), eq(users.active, true)),
  });
  if (!user || !verifyPassword(password, user.passwordHash)) throw new DomainError("UNAUTHORIZED", "Invalid email or password", 401);
  return user;
}
