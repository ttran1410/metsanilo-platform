import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEntries, authAccounts, users } from "@/db/schema";
import { requirePermission } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { hashPassword, randomPassword } from "@/domain/passwords";
import { env } from "@/lib/env";
import { failure, success } from "../../../../response";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission(db(), request, "shop_users.password_reset");
    const { id } = await context.params;
    if (actor.id === id) throw new DomainError("FORBIDDEN", "Use change password for your own account", 403);
    const target = await db().query.users.findFirst({ where: and(eq(users.id, id), eq(users.shopId, env().SHOP_ID), eq(users.active, true)) });
    if (!target) throw new DomainError("NOT_FOUND", "User not found", 404);
    if (actor.role === "MANAGER" && target.role === "ADMIN") throw new DomainError("FORBIDDEN", "Manager cannot reset an Admin password", 403);
    const temporaryPassword = randomPassword();
    const passwordHash = hashPassword(temporaryPassword);
    const now = new Date().toISOString();
    await db().update(users).set({ passwordHash, sessionVersion: target.sessionVersion + 1 }).where(eq(users.id, target.id));
    await db().update(authAccounts).set({ password: passwordHash, updatedAt: new Date() }).where(and(eq(authAccounts.userId, target.id), eq(authAccounts.providerId, "credential")));
    await db().insert(auditEntries).values({ id: randomUUID(), shopId: env().SHOP_ID, actor: actor.email ?? actor.id, action: "user.password_reset", entityType: "user", entityId: target.id, detailsJson: JSON.stringify({ targetRole: target.role }), createdAt: now });
    return success({ email: target.email, temporaryPassword });
  } catch (error) { return failure(error); }
}
