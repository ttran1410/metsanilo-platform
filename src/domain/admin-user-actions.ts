import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, authUsers, users } from "@/db/schema";
import { DomainError } from "./errors";
import { hashPassword, randomPassword } from "./passwords";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";
import { revokeAllUserSessions, setCredentialHash } from "@/lib/auth-integration";

export async function updateAdminProfile(database: Database, context: AdminActionContext, displayName: string) {
  assertAdminActionContext(context);
  const now = new Date().toISOString();
  const [updated] = await database.update(users).set({ displayName }).where(and(eq(users.id, context.actor.id), eq(users.shopId, context.shop.id))).returning();
  if (!updated) throw new DomainError("NOT_FOUND", "User profile not found", 404);
  if (context.actor.id !== "legacy-admin") await database.update(authUsers).set({ name: displayName, updatedAt: new Date() }).where(eq(authUsers.id, context.actor.id));
  return { id: updated.id, displayName: updated.displayName, email: updated.email, username: updated.username, role: updated.role, active: updated.active, updatedAt: now };
}

export async function resetAdminUserPassword(
  database: Database,
  context: AdminActionContext,
  id: string,
  now: Date = new Date()
) {
  assertAdminActionContext(context);
  if (context.actor.id === id) throw new DomainError("FORBIDDEN", "Use change password for your own account", 403);
  const target = await database.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.shopId, context.shop.id), eq(users.active, true)),
  });
  if (!target) throw new DomainError("NOT_FOUND", "User not found", 404);
  if (context.actor.role === "MANAGER" && target.role === "ADMIN") throw new DomainError("FORBIDDEN", "Manager cannot reset an Admin password", 403);

  const temporaryPassword = randomPassword();
  const passwordHash = hashPassword(temporaryPassword);
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const auditAction = target.mustChangePassword ? "user.temporary_password_regenerated" : "user.temporary_password_issued";

  await database.transaction(async (tx) => {
    const updateResult = await tx
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: true,
        temporaryPasswordIssuedAt: issuedAt,
        temporaryPasswordExpiresAt: expiresAt,
        sessionVersion: sql`${users.sessionVersion} + 1`,
      })
      .where(and(eq(users.id, target.id), eq(users.shopId, context.shop.id), eq(users.active, true)))
      .run();

    if (updateResult.rowsAffected !== 1) {
      throw new DomainError("CONFLICT", "User was modified concurrently", 409);
    }

    await setCredentialHash(tx, target.id, passwordHash);
    await revokeAllUserSessions(tx, target.id);
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
