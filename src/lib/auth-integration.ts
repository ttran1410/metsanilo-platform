import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull, lte, ne, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { authAccounts, authSessions, authUsers, auditEntries, userPermissions, users } from "@/db/schema";
import { getBetterAuthInstance } from "./better-auth";
import { env } from "./env";
import { defaultPermissionsForRole, type Role } from "./permissions";
import { DomainError } from "@/domain/errors";
import {
  evaluateSessionTiming,
  IDLE_TIMEOUT_MS,
  ABSOLUTE_LIFETIME_MS,
  WARNING_THRESHOLD_MS,
  SESSION_TOUCH_THROTTLE_MS,
  type SessionTiming,
  type SessionTimingInput,
} from "./session-timing";

export {
  evaluateSessionTiming,
  IDLE_TIMEOUT_MS,
  ABSOLUTE_LIFETIME_MS,
  WARNING_THRESHOLD_MS,
  SESSION_TOUCH_THROTTLE_MS,
  type SessionTiming,
  type SessionTimingInput,
};

export const CANONICAL_UTC_ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isCanonicalIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !CANONICAL_UTC_ISO_REGEX.test(value)) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  return new Date(parsed).toISOString() === value;
}

export function maskIpAddress(ip: string | null | undefined): string {
  if (!ip) return "Unknown IP";
  const trimmed = ip.trim();
  if (trimmed === "127.0.0.1" || trimmed === "::1" || trimmed === "localhost") {
    return "127.0.0.***";
  }
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) {
    const parts = trimmed.split(".");
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    return parts.length >= 3 ? `${parts[0]}:${parts[1]}:${parts[2]}:****` : "IPv6:****";
  }
  return "Masked IP";
}

export function normalizeUserAgent(ua: string | null | undefined): string {
  if (!ua || typeof ua !== "string") return "Unknown device";
  const str = ua.trim();
  if (!str) return "Unknown device";

  let browser = "Browser";
  if (str.includes("Edg/")) browser = "Edge";
  else if (str.includes("Chrome/") && !str.includes("Chromium/")) browser = "Chrome";
  else if (str.includes("Firefox/")) browser = "Firefox";
  else if (str.includes("Safari/") && !str.includes("Chrome/")) browser = "Safari";
  else if (str.includes("Opera/") || str.includes("OPR/")) browser = "Opera";

  let os = "Desktop";
  if (/iPhone/i.test(str)) os = "iOS";
  else if (/iPad/i.test(str)) os = "iPadOS";
  else if (/Android/i.test(str)) os = "Android";
  else if (/Mac OS X|Macintosh/i.test(str)) os = "macOS";
  else if (/Windows/i.test(str)) os = "Windows";
  else if (/Linux/i.test(str)) os = "Linux";

  return `${browser} on ${os}`;
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

export type ValidatedBetterAuthSession = {
  valid: true;
  user: typeof users.$inferSelect;
  session: typeof authSessions.$inferSelect;
  timing: SessionTiming;
};

export type InvalidBetterAuthSession = {
  valid: false;
  user?: undefined;
  session?: undefined;
  timing: SessionTiming;
  reason: "expired" | "not_found" | "inactive_user" | "invalid_credentials";
};

export type BetterAuthSessionValidationResult =
  | ValidatedBetterAuthSession
  | InvalidBetterAuthSession;

export async function validateBetterAuthSession(
  database: Database,
  sessionId: string,
  userId: string,
  now: Date = new Date()
): Promise<BetterAuthSessionValidationResult> {
  const session = await database.query.authSessions.findFirst({
    where: and(eq(authSessions.id, sessionId), eq(authSessions.userId, userId)),
  });
  if (!session) {
    const timing = evaluateSessionTiming({ createdAt: 0 }, now);
    return { valid: false, timing, reason: "not_found" };
  }

  const timing = evaluateSessionTiming(
    {
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      providerExpiresAt: session.expiresAt,
    },
    now
  );

  if (timing.expired) {
    try {
      await database.delete(authSessions).where(eq(authSessions.id, sessionId)).run();
    } catch {
      // Best-effort cleanup
    }
    return { valid: false, timing, reason: "expired" };
  }

  const user = await mapActiveShopUser(database, userId, now);
  if (!user) {
    return { valid: false, timing, reason: "inactive_user" };
  }

  return {
    valid: true,
    user,
    session,
    timing,
  };
}

export async function touchBetterAuthSession(
  database: Database,
  sessionId: string,
  userId: string,
  now: Date = new Date()
): Promise<BetterAuthSessionValidationResult> {
  const validated = await validateBetterAuthSession(database, sessionId, userId, now);
  if (!validated.valid) return validated;

  const currentActivityMs = validated.session.lastActivityAt
    ? new Date(validated.session.lastActivityAt).getTime()
    : new Date(validated.session.createdAt).getTime();

  if (now.getTime() - currentActivityMs >= SESSION_TOUCH_THROTTLE_MS) {
    await database
      .update(authSessions)
      .set({
        lastActivityAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(authSessions.id, sessionId),
          eq(authSessions.userId, userId),
          gt(authSessions.expiresAt, now),
          or(
            isNull(authSessions.lastActivityAt),
            lte(authSessions.lastActivityAt, new Date(now.getTime() - SESSION_TOUCH_THROTTLE_MS))
          )
        )
      )
      .run();

    const refreshedSession = await database.query.authSessions.findFirst({
      where: and(eq(authSessions.id, sessionId), eq(authSessions.userId, userId)),
    });

    if (!refreshedSession) {
      const timing = evaluateSessionTiming({ createdAt: 0 }, now);
      return { valid: false, timing, reason: "not_found" };
    }

    const updatedTiming = evaluateSessionTiming(
      {
        createdAt: refreshedSession.createdAt,
        lastActivityAt: refreshedSession.lastActivityAt,
        providerExpiresAt: refreshedSession.expiresAt,
      },
      now
    );

    return {
      valid: true,
      user: validated.user,
      session: refreshedSession,
      timing: updatedTiming,
    };
  }

  return validated;
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

export async function revokeSessionById(database: Database, targetUserId: string, sessionId: string) {
  const result = await database
    .delete(authSessions)
    .where(and(eq(authSessions.id, sessionId), eq(authSessions.userId, targetUserId)))
    .run();
  return result.rowsAffected;
}

export async function revokeOtherSessions(database: Database, userId: string, keepSessionId: string) {
  const result = await database
    .delete(authSessions)
    .where(and(eq(authSessions.userId, userId), ne(authSessions.id, keepSessionId)))
    .run();
  return result.rowsAffected;
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

export type ProvisionUserDependencies = {
  beforeCredentialInsert?: () => void | Promise<void>;
};

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
  now: Date = new Date(),
  overrides: Partial<ProvisionUserDependencies> = {}
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
    if (overrides.beforeCredentialInsert) {
      await overrides.beforeCredentialInsert();
    }
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
