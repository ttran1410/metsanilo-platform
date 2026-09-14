import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, authAccounts, authSessions, authUsers, userPermissions, users } from "@/db/schema";
import { DomainError } from "./errors";
import { assertPassword, hashPassword, randomPassword } from "./passwords";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";
import {
  evaluateSessionTiming,
  maskIpAddress,
  normalizeUserAgent,
  revokeAllUserSessions,
  setCredentialPassword,
} from "@/lib/auth-integration";
import { defaultPermissionsForRole, normalizePermission, type Permission, type Role } from "@/lib/permissions";
import { normalizeEmail } from "@/lib/email";
import { searchUsers } from "./admin-search";

export async function getScopedUserOrThrow(database: Database, shopId: string, userId: string) {
  const user = await database.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.shopId, shopId)),
  });
  if (!user) throw new DomainError("NOT_FOUND", "User not found", 404);
  return user;
}

export function assertCanManageTarget(
  actor: { id: string; role: Role },
  target: { id: string; role: Role }
) {
  if (actor.id === target.id) return;
  if (actor.role === "ADMIN") return;
  if (target.role === "ADMIN") {
    throw new DomainError("FORBIDDEN", "Only an ADMIN may manage an ADMIN user session", 403);
  }
  if (actor.role === "MANAGER" && target.role === "MANAGER") {
    throw new DomainError("FORBIDDEN", "Managers may not manage sessions of other managers", 403);
  }
}

export async function getAdminUsers(
  database: Database,
  context: AdminActionContext,
  query: Parameters<typeof searchUsers>[1],
  filters?: Parameters<typeof searchUsers>[2]
) {
  assertAdminActionContext(context);
  return searchUsers(database, query, filters, context.shop.id);
}

export type AdminUserCommand =
  | { action: "update"; userId: string; displayName?: string; role?: Role }
  | { action: "role"; userId: string; role: Role }
  | { action: "active"; userId: string; active: boolean }
  | { action: "reset_permissions"; userId: string }
  | { action: "revoke_sessions"; userId: string };

export async function executeAdminUserCommand(
  database: Database,
  context: AdminActionContext,
  command: AdminUserCommand
) {
  assertAdminActionContext(context);
  switch (command.action) {
    case "update":
      return updateUserProfileAndRole(database, context, command);
    case "role":
      return updateUserRole(database, context, command);
    case "active":
      return toggleUserActive(database, context, command);
    case "reset_permissions":
      return resetUserPermissionsToRole(database, context, command.userId);
    case "revoke_sessions":
      return revokeUserSessions(database, context, { targetUserId: command.userId });
  }
}

export async function createUser(
  database: Database,
  context: AdminActionContext,
  input: { email: string; displayName: string; role: Role; password: string },
  now: Date = new Date()
) {
  assertAdminActionContext(context);
  const VALID_ROLES: Role[] = ["ADMIN", "MANAGER", "STAFF", "CONTENT_CREATOR"];
  if (!VALID_ROLES.includes(input.role)) {
    throw new DomainError("VALIDATION_ERROR", "Invalid role", 422);
  }
  if (context.actor.role !== "ADMIN" && input.role === "ADMIN") {
    throw new DomainError("FORBIDDEN", "Only Admin can set role to Admin", 403);
  }

  const email = normalizeEmail(input.email);
  if (!email) {
    throw new DomainError("VALIDATION_ERROR", "Invalid email address", 422);
  }

  const displayName = typeof input.displayName === "string" ? input.displayName.trim() : "";
  if (displayName.length < 2 || displayName.length > 120) {
    throw new DomainError("VALIDATION_ERROR", "Display name must be between 2 and 120 characters", 422);
  }

  try {
    assertPassword(input.password);
  } catch (error) {
    throw new DomainError("VALIDATION_ERROR", error instanceof Error ? error.message : "Invalid password", 422);
  }

  const [existingUser, existingAuthUser] = await Promise.all([
    database.query.users.findFirst({
      where: and(eq(users.shopId, context.shop.id), eq(users.email, email)),
    }),
    database.query.authUsers.findFirst({
      where: eq(authUsers.email, email),
    }),
  ]);
  if (existingUser || existingAuthUser) {
    throw new DomainError("CONFLICT", "User with this email already exists", 409);
  }

  const id = randomUUID();
  const createdAt = now.toISOString();
  const recordCreationDate = new Date(createdAt);
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const hashedPassword = hashPassword(input.password);
  const defaults = defaultPermissionsForRole(input.role);

  try {
    await database.transaction(async (tx) => {
      await tx.insert(users).values({
        id,
        shopId: context.shop.id,
        username: email,
        email,
        mustChangePassword: true,
        temporaryPasswordIssuedAt: issuedAt,
        temporaryPasswordExpiresAt: expiresAt,
        displayName,
        role: input.role,
        active: true,
        createdAt,
      });

      await tx.insert(authUsers).values({
        id,
        name: displayName,
        email,
        emailVerified: false,
        image: null,
        createdAt: recordCreationDate,
        updatedAt: recordCreationDate,
      });

      await tx.insert(authAccounts).values({
        id: `credential-${id}`,
        accountId: id,
        providerId: "credential",
        userId: id,
        password: hashedPassword,
        createdAt: recordCreationDate,
        updatedAt: recordCreationDate,
      });

      if (defaults.length) {
        await tx.insert(userPermissions).values(
          defaults.map((permission) => ({
            id: randomUUID(),
            shopId: context.shop.id,
            userId: id,
            permission,
            granted: true,
            updatedAt: createdAt,
          }))
        );
      }

      await tx.insert(auditEntries).values({
        id: randomUUID(),
        shopId: context.shop.id,
        actor: context.actor.email ?? context.actor.id,
        action: "user.created",
        entityType: "user",
        entityId: id,
        detailsJson: JSON.stringify({ email, role: input.role, expiresAt }),
        createdAt,
      });
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("UNIQUE") || msg.includes("constraint") || msg.includes("already exists")) {
      throw new DomainError("CONFLICT", "User with this email already exists", 409);
    }
    throw error;
  }

  return getScopedUserOrThrow(database, context.shop.id, id);
}

export async function updateUserProfileAndRole(
  database: Database,
  context: AdminActionContext,
  input: { userId: string; displayName?: string; role?: Role }
) {
  assertAdminActionContext(context);
  const target = await getScopedUserOrThrow(database, context.shop.id, input.userId);
  assertCanManageTarget(context.actor, target);

  const nextRole = input.role ?? target.role;
  const nextName = input.displayName !== undefined ? input.displayName.trim() : target.displayName;

  const roleChanged = nextRole !== target.role;
  const nameChanged = nextName !== target.displayName;

  if (roleChanged) {
    if (input.userId === context.actor.id) {
      throw new DomainError("FORBIDDEN", "Cannot change your own role", 403);
    }
    if (context.actor.role !== "ADMIN" && nextRole === "ADMIN") {
      throw new DomainError("FORBIDDEN", "Only Admin can set role to Admin", 403);
    }
    if (context.actor.role !== "ADMIN") {
      if (target.role === "ADMIN") throw new DomainError("FORBIDDEN", "Only Admin can set role to Admin", 403);
      if (context.actor.role === "MANAGER" && target.role === "MANAGER") {
        throw new DomainError("FORBIDDEN", "Managers cannot modify role of another Manager", 403);
      }
    }
  }

  if (nameChanged && context.actor.role !== "ADMIN") {
    if (target.role === "ADMIN" && context.actor.id !== target.id) {
      throw new DomainError("FORBIDDEN", "Only Admin can modify an Admin account", 403);
    }
    if (context.actor.role === "MANAGER" && target.role === "MANAGER" && context.actor.id !== target.id) {
      throw new DomainError("FORBIDDEN", "Managers cannot modify profile of another Manager", 403);
    }
  }

  if (!roleChanged && !nameChanged) {
    return target;
  }

  const updatedAt = new Date().toISOString();
  await database.transaction(async (tx) => {
    const userUpdate = await tx
      .update(users)
      .set({ displayName: nextName, role: nextRole })
      .where(and(eq(users.id, input.userId), eq(users.shopId, context.shop.id)))
      .run();

    if (userUpdate.rowsAffected !== 1) {
      throw new DomainError("NOT_FOUND", "User not found", 404);
    }

    if (nameChanged) {
      const authUpdate = await tx
        .update(authUsers)
        .set({ name: nextName, updatedAt: new Date() })
        .where(eq(authUsers.id, input.userId))
        .run();

      if (authUpdate.rowsAffected !== 1) {
        throw new DomainError("NOT_FOUND", "Authentication profile record missing", 404);
      }

      await tx.insert(auditEntries).values({
        id: randomUUID(),
        shopId: context.shop.id,
        actor: context.actor.email ?? context.actor.id,
        action: "user.profile_updated",
        entityType: "user",
        entityId: target.id,
        detailsJson: JSON.stringify({ displayName: nextName }),
        createdAt: updatedAt,
      });
    }

    if (roleChanged) {
      await revokeAllUserSessions(tx, target.id);

      await tx.insert(auditEntries).values({
        id: randomUUID(),
        shopId: context.shop.id,
        actor: context.actor.email ?? context.actor.id,
        action: "user.role_updated",
        entityType: "user",
        entityId: target.id,
        detailsJson: JSON.stringify({ fromRole: target.role, toRole: nextRole }),
        createdAt: updatedAt,
      });
    }
  });

  return getScopedUserOrThrow(database, context.shop.id, input.userId);
}

export async function updateUserRole(
  database: Database,
  context: AdminActionContext,
  input: { userId: string; role: Role }
) {
  return updateUserProfileAndRole(database, context, input);
}

export async function toggleUserActive(
  database: Database,
  context: AdminActionContext,
  input: { userId: string; active: boolean }
) {
  assertAdminActionContext(context);
  if (input.userId === context.actor.id) {
    throw new DomainError("FORBIDDEN", "Cannot suspend your own account", 403);
  }

  const target = await getScopedUserOrThrow(database, context.shop.id, input.userId);

  if (context.actor.role !== "ADMIN") {
    if (target.role === "ADMIN") throw new DomainError("FORBIDDEN", "Managers cannot modify active status of an Admin", 403);
    if (context.actor.role === "MANAGER" && target.role === "MANAGER") {
      throw new DomainError("FORBIDDEN", "Managers cannot modify active status of another Manager", 403);
    }
  }

  if (target.active === input.active) {
    return target;
  }

  const updatedAt = new Date().toISOString();
  await database.transaction(async (tx) => {
    const updateResult = await tx
      .update(users)
      .set({ active: input.active })
      .where(and(eq(users.id, input.userId), eq(users.shopId, context.shop.id)))
      .run();

    if (updateResult.rowsAffected !== 1) {
      throw new DomainError("NOT_FOUND", "User not found", 404);
    }

    await revokeAllUserSessions(tx, input.userId);
    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId: context.shop.id,
      actor: context.actor.email ?? context.actor.id,
      action: input.active ? "user.activated" : "user.suspended",
      entityType: "user",
      entityId: target.id,
      detailsJson: JSON.stringify({ active: input.active }),
      createdAt: updatedAt,
    });
  });

  return getScopedUserOrThrow(database, context.shop.id, input.userId);
}

export async function updateUserProfile(
  database: Database,
  context: AdminActionContext,
  input: { userId: string; displayName?: string }
) {
  return updateUserProfileAndRole(database, context, input);
}

export async function updateUserPermission(
  database: Database,
  context: AdminActionContext,
  input: { userId: string; permission: Permission; granted: boolean }
) {
  assertAdminActionContext(context);
  if (input.userId === context.actor.id) {
    throw new DomainError("FORBIDDEN", "Cannot modify your own permissions", 403);
  }

  const target = await getScopedUserOrThrow(database, context.shop.id, input.userId);

  if (context.actor.role !== "ADMIN") {
    if (target.role === "ADMIN") throw new DomainError("FORBIDDEN", "Managers cannot modify permissions of an Admin", 403);
    if (context.actor.role === "MANAGER" && target.role === "MANAGER") {
      throw new DomainError("FORBIDDEN", "Managers cannot modify permissions of another Manager", 403);
    }
  }

  const normalizedPermission = normalizePermission(input.permission);
  if (!normalizedPermission) {
    throw new DomainError("VALIDATION_ERROR", "Permission is not available", 422);
  }

  const existingGrant = await database.query.userPermissions.findFirst({
    where: and(
      eq(userPermissions.userId, input.userId),
      eq(userPermissions.shopId, context.shop.id),
      eq(userPermissions.permission, normalizedPermission)
    ),
  });

  const isRoleDefault = defaultPermissionsForRole(target.role).includes(normalizedPermission);

  // Idempotent No-Op
  if ((existingGrant && existingGrant.granted === input.granted) || (!existingGrant && isRoleDefault === input.granted)) {
    return { userId: target.id, permission: normalizedPermission, granted: input.granted };
  }

  const updatedAt = new Date().toISOString();
  await database.transaction(async (tx) => {
    await tx
      .insert(userPermissions)
      .values({
        id: randomUUID(),
        shopId: context.shop.id,
        userId: target.id,
        permission: normalizedPermission,
        granted: input.granted,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: [userPermissions.userId, userPermissions.permission],
        set: { granted: input.granted, updatedAt },
      });

    await revokeAllUserSessions(tx, target.id);
    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId: context.shop.id,
      actor: context.actor.email ?? context.actor.id,
      action: input.granted ? "user.permission_granted" : "user.permission_revoked",
      entityType: "user",
      entityId: target.id,
      detailsJson: JSON.stringify({ permission: normalizedPermission }),
      createdAt: updatedAt,
    });
  });

  return { userId: target.id, permission: normalizedPermission, granted: input.granted };
}

export async function resetUserPermissionsToRole(
  database: Database,
  context: AdminActionContext,
  userId: string
) {
  assertAdminActionContext(context);
  if (userId === context.actor.id) {
    throw new DomainError("FORBIDDEN", "Cannot reset your own permissions", 403);
  }

  const target = await getScopedUserOrThrow(database, context.shop.id, userId);

  if (context.actor.role !== "ADMIN") {
    if (target.role === "ADMIN") throw new DomainError("FORBIDDEN", "Managers cannot reset permissions of an Admin", 403);
    if (context.actor.role === "MANAGER" && target.role === "MANAGER") {
      throw new DomainError("FORBIDDEN", "Managers cannot reset permissions of another Manager", 403);
    }
  }

  const updatedAt = new Date().toISOString();
  const defaults = defaultPermissionsForRole(target.role);

  await database.transaction(async (tx) => {
    await tx
      .delete(userPermissions)
      .where(and(eq(userPermissions.userId, userId), eq(userPermissions.shopId, context.shop.id)))
      .run();

    if (defaults.length) {
      await tx.insert(userPermissions).values(
        defaults.map((permission) => ({
          id: randomUUID(),
          shopId: context.shop.id,
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
      shopId: context.shop.id,
      actor: context.actor.email ?? context.actor.id,
      action: "user.permissions_reset_to_default",
      entityType: "user",
      entityId: userId,
      detailsJson: JSON.stringify({ role: target.role }),
      createdAt: updatedAt,
    });
  });

  return { userId, role: target.role, defaults };
}

export type CredentialMutationDependencies = {
  setCredentialPassword: (database: Pick<Database, "update">, userId: string, password: string) => Promise<void>;
  revokeAllUserSessions: (database: Pick<Database, "delete">, userId: string) => Promise<void>;
};

export async function resetAdminUserPassword(
  database: Database,
  context: AdminActionContext,
  id: string,
  now: Date = new Date(),
  overrides: Partial<CredentialMutationDependencies> = {}
) {
  assertAdminActionContext(context);
  if (context.actor.id === id) {
    throw new DomainError("FORBIDDEN", "Use change password for your own account", 403);
  }

  const target = await database.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.shopId, context.shop.id), eq(users.active, true)),
  });
  if (!target) throw new DomainError("NOT_FOUND", "User not found", 404);

  if (context.actor.role !== "ADMIN") {
    if (target.role === "ADMIN") throw new DomainError("FORBIDDEN", "Manager cannot reset an Admin password", 403);
    if (context.actor.role === "MANAGER" && target.role === "MANAGER") {
      throw new DomainError("FORBIDDEN", "Manager cannot reset another Manager password", 403);
    }
  }

  const temporaryPassword = randomPassword();
  const hashedPassword = hashPassword(temporaryPassword);
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const auditAction = target.mustChangePassword ? "user.temporary_password_regenerated" : "user.temporary_password_issued";

  await database.transaction(async (tx) => {
    const updateResult = await tx
      .update(users)
      .set({
        mustChangePassword: true,
        temporaryPasswordIssuedAt: issuedAt,
        temporaryPasswordExpiresAt: expiresAt,
      })
      .where(and(eq(users.id, target.id), eq(users.shopId, context.shop.id), eq(users.active, true)))
      .run();

    if (updateResult.rowsAffected !== 1) {
      throw new DomainError("CONFLICT", "User was modified concurrently", 409);
    }

    const setCredential = overrides.setCredentialPassword ?? setCredentialPassword;
    const revokeSessions = overrides.revokeAllUserSessions ?? revokeAllUserSessions;

    await setCredential(tx, target.id, hashedPassword);
    await revokeSessions(tx, target.id);
    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId: context.shop.id,
      actor: context.actor.email ?? context.actor.id,
      action: auditAction,
      entityType: "user",
      entityId: target.id,
      detailsJson: JSON.stringify({ targetRole: target.role, expiresAt }),
      createdAt: issuedAt,
    });
    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId: context.shop.id,
      actor: context.actor.email ?? context.actor.id,
      action: "user.sessions_revoked",
      entityType: "user",
      entityId: target.id,
      detailsJson: JSON.stringify({ reason: "credential_reset" }),
      createdAt: issuedAt,
    });
  });

  return { email: target.email, temporaryPassword, temporaryPasswordExpiresAt: expiresAt };
}

export async function updateAdminProfile(
  database: Database,
  context: AdminActionContext,
  displayName: string
) {
  assertAdminActionContext(context);
  const trimmedName = displayName.trim();
  const now = new Date().toISOString();

  if (trimmedName === context.actor.displayName) {
    const current = await database.query.users.findFirst({
      where: and(eq(users.id, context.actor.id), eq(users.shopId, context.shop.id)),
    });
    if (!current) throw new DomainError("NOT_FOUND", "User profile not found", 404);
    return {
      id: current.id,
      displayName: current.displayName,
      email: current.email,
      username: current.username,
      role: current.role,
      active: current.active,
    };
  }

  let updatedUser: typeof users.$inferSelect | undefined;

  await database.transaction(async (tx) => {
    const [user] = await tx
      .update(users)
      .set({ displayName: trimmedName })
      .where(and(eq(users.id, context.actor.id), eq(users.shopId, context.shop.id)))
      .returning();

    if (!user) throw new DomainError("NOT_FOUND", "User profile not found", 404);
    updatedUser = user;

    const authUpdate = await tx
      .update(authUsers)
      .set({ name: trimmedName, updatedAt: new Date() })
      .where(eq(authUsers.id, context.actor.id))
      .run();

    if (authUpdate.rowsAffected !== 1) {
      throw new DomainError("NOT_FOUND", "Authentication profile record missing", 404);
    }

    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId: context.shop.id,
      actor: context.actor.email ?? context.actor.id,
      action: "user.profile_updated",
      entityType: "user",
      entityId: context.actor.id,
      detailsJson: JSON.stringify({ displayName: trimmedName }),
      createdAt: now,
    });
  });

  return {
    id: updatedUser!.id,
    displayName: updatedUser!.displayName,
    email: updatedUser!.email,
    username: updatedUser!.username,
    role: updatedUser!.role,
    active: updatedUser!.active,
  };
}

export async function getUserSessions(
  database: Database,
  context: AdminActionContext,
  userId: string,
  now: Date = new Date()
) {
  assertAdminActionContext(context);
  const targetUser = await getScopedUserOrThrow(database, context.shop.id, userId);
  assertCanManageTarget(context.actor, targetUser);

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
  context: AdminActionContext,
  input: { targetUserId: string; sessionId: string; reason?: string }
) {
  assertAdminActionContext(context);
  const targetUser = await getScopedUserOrThrow(database, context.shop.id, input.targetUserId);
  assertCanManageTarget(context.actor, targetUser);

  const updatedAt = new Date().toISOString();
  let affectedCount = 0;

  await database.transaction(async (tx) => {
    const result = await tx
      .delete(authSessions)
      .where(and(eq(authSessions.id, input.sessionId), eq(authSessions.userId, input.targetUserId)))
      .run();
    affectedCount = result.rowsAffected;

    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId: context.shop.id,
      actor: context.actor.email ?? context.actor.id,
      action: "user.session_revoked",
      entityType: "user",
      entityId: input.targetUserId,
      detailsJson: JSON.stringify({
        sessionId: input.sessionId,
        affectedCount,
        reason: input.reason ?? (context.actor.id === input.targetUserId ? "Self-revocation" : "Operator request"),
      }),
      createdAt: updatedAt,
    });
  });

  return { userId: input.targetUserId, sessionId: input.sessionId, revoked: true, affectedCount };
}

export async function revokeUserSessions(
  database: Database,
  context: AdminActionContext,
  input: { targetUserId: string; reason?: string }
) {
  assertAdminActionContext(context);
  const targetUser = await getScopedUserOrThrow(database, context.shop.id, input.targetUserId);
  assertCanManageTarget(context.actor, targetUser);

  const updatedAt = new Date().toISOString();
  let affectedCount = 0;

  await database.transaction(async (tx) => {
    const result = await tx.delete(authSessions).where(eq(authSessions.userId, input.targetUserId)).run();
    affectedCount = result.rowsAffected;

    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId: context.shop.id,
      actor: context.actor.email ?? context.actor.id,
      action: "user.sessions_revoked",
      entityType: "user",
      entityId: input.targetUserId,
      detailsJson: JSON.stringify({
        revokedAll: true,
        affectedCount,
        reason: input.reason ?? (context.actor.id === input.targetUserId ? "Self logout all" : "Operator request"),
      }),
      createdAt: updatedAt,
    });
  });

  return { userId: input.targetUserId, revoked: true, affectedCount };
}

export async function getUserAuditTrail(
  database: Database,
  context: AdminActionContext,
  userId: string
) {
  assertAdminActionContext(context);
  const target = await getScopedUserOrThrow(database, context.shop.id, userId);
  assertCanManageTarget(context.actor, target);

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
        eq(auditEntries.shopId, context.shop.id),
        eq(auditEntries.entityType, "user"),
        eq(auditEntries.entityId, userId)
      )
    )
    .orderBy(desc(auditEntries.createdAt))
    .limit(30);
}

export async function getUserAccessDetail(
  database: Database,
  context: AdminActionContext,
  userId: string,
  now: Date = new Date()
) {
  assertAdminActionContext(context);
  const target = await getScopedUserOrThrow(database, context.shop.id, userId);
  assertCanManageTarget(context.actor, target);

  const [grants, rawSessions, audit] = await Promise.all([
    database
      .select()
      .from(userPermissions)
      .where(and(eq(userPermissions.userId, userId), eq(userPermissions.shopId, context.shop.id))),
    database
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, userId))
      .orderBy(desc(authSessions.updatedAt)),
    database
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
          eq(auditEntries.shopId, context.shop.id),
          eq(auditEntries.entityType, "user"),
          eq(auditEntries.entityId, userId)
        )
      )
      .orderBy(desc(auditEntries.createdAt))
      .limit(30),
  ]);

  const defaults = defaultPermissionsForRole(target.role);
  const revoked = grants
    .filter((g) => !g.granted)
    .map((g) => normalizePermission(g.permission))
    .filter((p): p is Permission => Boolean(p));
  const added = grants
    .filter((g) => g.granted)
    .map((g) => normalizePermission(g.permission))
    .filter((p): p is Permission => Boolean(p));
  const effectivePermissions = [...new Set([...defaults.filter((p) => !revoked.includes(p)), ...added])];

  const sessions = rawSessions
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

  return {
    user: target,
    permissions: effectivePermissions,
    customOverrides: {
      granted: added.filter((p) => !defaults.includes(p)),
      revoked: [...new Set(revoked)],
    },
    sessions,
    audit,
  };
}
