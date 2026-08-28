import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, authAccounts, authUsers, users } from "@/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "./errors";
import { hashPassword, randomPassword } from "./passwords";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";

export async function updateAdminProfile(database: Database, context: AdminActionContext, displayName: string) {
  assertAdminActionContext(context);
  const now = new Date().toISOString();
  const [updated] = await database.update(users).set({ displayName }).where(and(eq(users.id, context.actor.id), eq(users.shopId, context.shop.id))).returning();
  if (!updated) throw new DomainError("NOT_FOUND", "User profile not found", 404);
  if (context.actor.id !== "legacy-admin") await database.update(authUsers).set({ name: displayName, updatedAt: new Date() }).where(eq(authUsers.id, context.actor.id));
  return { id: updated.id, displayName: updated.displayName, email: updated.email, username: updated.username, role: updated.role, active: updated.active, updatedAt: now };
}

export async function resetAdminUserPassword(database: Database, context: AdminActionContext, id: string) {
  assertAdminActionContext(context);
  if (context.actor.id === id) throw new DomainError("FORBIDDEN", "Use change password for your own account", 403);
  const target = await database.query.users.findFirst({ where: and(eq(users.id, id), eq(users.shopId, context.shop.id), eq(users.active, true)) });
  if (!target) throw new DomainError("NOT_FOUND", "User not found", 404);
  if (context.actor.role === "MANAGER" && target.role === "ADMIN") throw new DomainError("FORBIDDEN", "Manager cannot reset an Admin password", 403);

  const temporaryPassword = randomPassword();
  const passwordHash = hashPassword(temporaryPassword);
  const now = new Date().toISOString();
  await database.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, sessionVersion: target.sessionVersion + 1 }).where(and(eq(users.id, target.id), eq(users.shopId, context.shop.id)));
    await tx.update(authAccounts).set({ password: passwordHash, updatedAt: new Date() }).where(and(eq(authAccounts.userId, target.id), eq(authAccounts.providerId, "credential")));
    await tx.insert(auditEntries).values({ id: randomUUID(), shopId: context.shop.id, actor: context.actor.email ?? context.actor.id, action: "user.password_reset", entityType: "user", entityId: target.id, detailsJson: JSON.stringify({ targetRole: target.role }), createdAt: now });
  });
  return { email: target.email, temporaryPassword };
}
