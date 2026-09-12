import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { authAccounts, authSessions, authUsers, auditEntries, userPermissions, users } from "@/db/schema";
import { getBetterAuthInstance } from "./better-auth";
import { env } from "./env";
import { defaultPermissionsForRole, type Role } from "./permissions";

export async function getBetterAuthSession(request: Request) {
  return getBetterAuthInstance().api.getSession({ headers: request.headers });
}

export async function mapActiveShopUser(database: Database, userId: string) {
  const user = await database.query.users.findFirst({ where: and(eq(users.id, userId), eq(users.shopId, env().SHOP_ID), eq(users.active, true)) });
  if (!user) return undefined;
  const credential = await database.query.authAccounts.findFirst({ where: and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, "credential")) });
  return credential?.password ? user : undefined;
}

export async function revokeAllUserSessions(database: Pick<Database, "delete">, userId: string) {
  await database.delete(authSessions).where(eq(authSessions.userId, userId)).run();
}

/** Phase 2 exception: credential writes are centralized until the Admin plugin is evaluated. */
export async function setCredentialHash(database: Pick<Database, "update">, userId: string, password: string) {
  const result = await database.update(authAccounts).set({ password, updatedAt: new Date() }).where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, "credential"))).run();
  if (result.rowsAffected !== 1) throw new Error("Better Auth credential account is missing");
}

export async function provisionUserWithAuth(database: Database, input: { id?: string; shopId: string; email: string; displayName: string; role: Role; passwordHash: string; createdAt?: string; auditActor?: string }) {
  const id = input.id ?? randomUUID();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const now = new Date(createdAt);
  await database.transaction(async (tx) => {
    await tx.insert(users).values({ id, shopId: input.shopId, username: input.email, email: input.email, passwordHash: input.passwordHash, mustChangePassword: true, sessionVersion: 1, displayName: input.displayName, role: input.role, active: true, createdAt });
    await tx.insert(authUsers).values({ id, name: input.displayName, email: input.email, emailVerified: false, image: null, createdAt: now, updatedAt: now });
    await tx.insert(authAccounts).values({ id: `credential-${id}`, accountId: id, providerId: "credential", userId: id, password: input.passwordHash, createdAt: now, updatedAt: now });
    const defaults = defaultPermissionsForRole(input.role);
    if (defaults.length) await tx.insert(userPermissions).values(defaults.map((permission) => ({ id: randomUUID(), shopId: input.shopId, userId: id, permission, granted: true, updatedAt: createdAt })));
    if (input.auditActor) await tx.insert(auditEntries).values({ id: randomUUID(), shopId: input.shopId, actor: input.auditActor, action: "user.created", entityType: "user", entityId: id, detailsJson: JSON.stringify({ email: input.email, role: input.role }), createdAt });
  });
  return (await database.query.users.findFirst({ where: and(eq(users.id, id), eq(users.shopId, input.shopId)) }))!;
}
