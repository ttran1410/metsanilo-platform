import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { authAccounts, authSessions, authUsers, auditEntries, userPermissions, users } from "@/db/schema";
import { getBetterAuthInstance } from "./better-auth";
import { env } from "./env";
import { defaultPermissionsForRole, type Role } from "./permissions";
import { DomainError } from "@/domain/errors";

export const CANONICAL_UTC_ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isCanonicalIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !CANONICAL_UTC_ISO_REGEX.test(value)) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  return new Date(parsed).toISOString() === value;
}

export function isCredentialStateValid(user: {
  mustChangePassword?: boolean | null;
  temporaryPasswordIssuedAt?: string | null;
  temporaryPasswordExpiresAt?: string | null;
}): boolean {
  if (typeof user.mustChangePassword !== "boolean") {
    return false;
  }
  if (user.mustChangePassword) {
    if (!isCanonicalIsoDate(user.temporaryPasswordIssuedAt) || !isCanonicalIsoDate(user.temporaryPasswordExpiresAt)) {
      return false;
    }
    return Date.parse(user.temporaryPasswordIssuedAt) <= Date.parse(user.temporaryPasswordExpiresAt);
  }
  return user.temporaryPasswordIssuedAt === null && user.temporaryPasswordExpiresAt === null;
}

export function isTemporaryCredentialActive(
  user: {
    mustChangePassword?: boolean | null;
    temporaryPasswordIssuedAt?: string | null;
    temporaryPasswordExpiresAt?: string | null;
  },
  now: Date = new Date()
): boolean {
  if (!user.mustChangePassword || !isCredentialStateValid(user)) return false;
  return now.getTime() < new Date(user.temporaryPasswordExpiresAt!).getTime();
}

export function isTemporaryCredentialExpired(
  user: {
    mustChangePassword?: boolean | null;
    temporaryPasswordIssuedAt?: string | null;
    temporaryPasswordExpiresAt?: string | null;
  },
  now: Date = new Date()
): boolean {
  if (!user.mustChangePassword) return false;
  if (!isCredentialStateValid(user)) return true;
  return now.getTime() >= new Date(user.temporaryPasswordExpiresAt!).getTime();
}

/** Record an expiry observation once per temporary-credential issuance. */
export async function recordTemporaryCredentialExpired(
  database: Database,
  user: { id: string; shopId?: string | null; email?: string | null; temporaryPasswordExpiresAt?: string | null },
  now: Date = new Date(),
) {
  const existing = await database
    .select({ detailsJson: auditEntries.detailsJson })
    .from(auditEntries)
    .where(and(eq(auditEntries.shopId, user.shopId ?? env().SHOP_ID), eq(auditEntries.entityId, user.id), eq(auditEntries.action, "user.temporary_password_expired")))
    .all();
  const expiry = user.temporaryPasswordExpiresAt ?? null;
  if (existing.some((entry) => {
    try { return (JSON.parse(entry.detailsJson) as { expiresAt?: string | null }).expiresAt === expiry; } catch { return false; }
  })) return false;
  await database.insert(auditEntries).values({
    id: randomUUID(), shopId: env().SHOP_ID, actor: user.email ?? user.id,
    action: "user.temporary_password_expired", entityType: "user", entityId: user.id,
    detailsJson: JSON.stringify({ expiresAt: expiry, attemptedAt: now.toISOString() }), createdAt: now.toISOString(),
  });
  return true;
}

export async function getBetterAuthSession(request: Request) {
  return getBetterAuthInstance().api.getSession({ headers: request.headers });
}

export async function mapActiveShopUser(database: Database, userId: string, now: Date = new Date()) {
  const user = await database.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.shopId, env().SHOP_ID), eq(users.active, true)),
  });
  if (!user) return undefined;
  if (!isCredentialStateValid(user)) return undefined;
  if (user.mustChangePassword && !isTemporaryCredentialActive(user, now)) return undefined;
  const credential = await database.query.authAccounts.findFirst({
    where: and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, "credential")),
  });
  return credential?.password ? user : undefined;
}

export async function revokeAllUserSessions(database: Pick<Database, "delete">, userId: string) {
  await database.delete(authSessions).where(eq(authSessions.userId, userId)).run();
}

/** Phase 2/3 exception: credential writes are centralized until the Admin plugin is evaluated. */
export async function setCredentialHash(database: Pick<Database, "update">, userId: string, password: string) {
  const result = await database
    .update(authAccounts)
    .set({ password, updatedAt: new Date() })
    .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, "credential")))
    .run();
  if (result.rowsAffected !== 1) throw new Error("Better Auth credential account is missing");
}

export async function provisionUserWithAuth(
  database: Database,
  input: {
    id?: string;
    shopId: string;
    email: string;
    displayName: string;
    role: Role;
    passwordHash: string;
    createdAt?: string;
    auditActor?: string;
  },
  now: Date = new Date()
) {
  const id = input.id ?? randomUUID();
  const createdAt = input.createdAt ?? now.toISOString();
  const recordCreationDate = new Date(createdAt);
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  await database.transaction(async (tx) => {
    await tx.insert(users).values({
      id,
      shopId: input.shopId,
      username: input.email,
      email: input.email,
      passwordHash: input.passwordHash,
      mustChangePassword: true,
      temporaryPasswordIssuedAt: issuedAt,
      temporaryPasswordExpiresAt: expiresAt,
      sessionVersion: 1,
      displayName: input.displayName,
      role: input.role,
      active: true,
      createdAt,
    });
    await tx.insert(authUsers).values({
      id,
      name: input.displayName,
      email: input.email,
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
      password: input.passwordHash,
      createdAt: recordCreationDate,
      updatedAt: recordCreationDate,
    });
    const defaults = defaultPermissionsForRole(input.role);
    if (defaults.length) {
      await tx.insert(userPermissions).values(
        defaults.map((permission) => ({
          id: randomUUID(),
          shopId: input.shopId,
          userId: id,
          permission,
          granted: true,
          updatedAt: createdAt,
        }))
      );
    }
    if (input.auditActor) {
      await tx.insert(auditEntries).values({
        id: randomUUID(),
        shopId: input.shopId,
        actor: input.auditActor,
        action: "user.created",
        entityType: "user",
        entityId: id,
        detailsJson: JSON.stringify({ email: input.email, role: input.role, expiresAt }),
        createdAt,
      });
    }
  });
  return (await database.query.users.findFirst({ where: and(eq(users.id, id), eq(users.shopId, input.shopId)) }))!;
}

/** Reconcile the deterministic seed Admin identity atomically; never call this from login. */
export async function reconcileBootstrapAdmin(
  database: Database,
  input: { id: string; shopId: string; email: string; displayName: string; passwordHash: string; now?: Date }
) {
  const nowDate = input.now ?? new Date();
  const createdAt = nowDate.toISOString();

  await database.transaction(async (tx) => {
    const existing = await tx.query.users.findFirst({
      where: and(eq(users.id, input.id), eq(users.shopId, input.shopId)),
    });

    if (existing) {
      if (!isCredentialStateValid(existing) || existing.mustChangePassword) {
        throw new Error(`Bootstrap admin ${input.id} has invalid or temporary credential state. Remediation required.`);
      }

      if (existing.email !== input.email) {
        throw new Error(
          `Bootstrap admin ${input.id} email is immutable (existing: ${existing.email}, configured: ${input.email}). Remediation or explicit migration required.`
        );
      }

      await tx
        .update(users)
        .set({
          displayName: input.displayName,
          active: true,
        })
        .where(eq(users.id, input.id));

      await tx
        .insert(authUsers)
        .values({
          id: input.id,
          name: input.displayName,
          email: existing.email,
          emailVerified: false,
          image: null,
          createdAt: nowDate,
          updatedAt: nowDate,
        })
        .onConflictDoUpdate({
          target: authUsers.id,
          set: {
            name: input.displayName,
            emailVerified: false,
            updatedAt: nowDate,
          },
        });

      await tx
        .insert(authAccounts)
        .values({
          id: `credential-${input.id}`,
          accountId: input.id,
          providerId: "credential",
          userId: input.id,
          password: existing.passwordHash,
          createdAt: nowDate,
          updatedAt: nowDate,
        })
        .onConflictDoUpdate({
          target: authAccounts.id,
          set: {
            updatedAt: nowDate,
          },
        });
    } else {
      await tx.insert(users).values({
        id: input.id,
        shopId: input.shopId,
        username: input.email,
        email: input.email,
        passwordHash: input.passwordHash,
        mustChangePassword: false,
        temporaryPasswordIssuedAt: null,
        temporaryPasswordExpiresAt: null,
        sessionVersion: 1,
        displayName: input.displayName,
        role: "ADMIN",
        active: true,
        createdAt,
      });

      await tx.insert(authUsers).values({
        id: input.id,
        name: input.displayName,
        email: input.email,
        emailVerified: false,
        image: null,
        createdAt: nowDate,
        updatedAt: nowDate,
      });

      await tx.insert(authAccounts).values({
        id: `credential-${input.id}`,
        accountId: input.id,
        providerId: "credential",
        userId: input.id,
        password: input.passwordHash,
        createdAt: nowDate,
        updatedAt: nowDate,
      });
    }
  });
}

export async function assertNoOrphanedForcedChangeUsers(database: Database, shopId: string = env().SHOP_ID) {
  const forcedChangeUsers = await database.query.users.findMany({
    where: and(eq(users.shopId, shopId), eq(users.mustChangePassword, true), eq(users.active, true)),
  });
  const unTimestamped = forcedChangeUsers.filter((u) => !isCredentialStateValid(u));
  if (unTimestamped.length > 0) {
    throw new DomainError(
      "INVALID_CREDENTIAL_STATE",
      `Found ${unTimestamped.length} active forced-change user(s) with invalid temporary credential state. Remediation required.`,
      500
    );
  }
}
