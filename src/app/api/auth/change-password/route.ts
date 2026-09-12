import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { auditEntries, users } from "@/db/schema";
import { currentUser } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { assertPassword, hashPassword, verifyPassword } from "@/domain/passwords";
import { env } from "@/lib/env";
import { failure, success } from "../../response";
import { revokeAllUserSessions, setCredentialHash } from "@/lib/auth-integration";

const command = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const database = db();
    const actor = await currentUser(database, request);
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid password format", 422);

    try {
      assertPassword(parsed.data.newPassword);
    } catch (err) {
      throw new DomainError(
        "VALIDATION_ERROR",
        err instanceof Error ? err.message : "Password does not meet security rules",
        422
      );
    }

    if (!verifyPassword(parsed.data.currentPassword, actor.passwordHash)) {
      throw new DomainError("UNAUTHORIZED", "Current password is incorrect", 401);
    }

    const now = new Date().toISOString();
    const passwordHash = hashPassword(parsed.data.newPassword);

    await database.transaction(async (tx) => {
      const updateResult = await tx
        .update(users)
        .set({
          passwordHash,
          mustChangePassword: false,
          temporaryPasswordIssuedAt: null,
          temporaryPasswordExpiresAt: null,
          sessionVersion: sql`${users.sessionVersion} + 1`,
        })
        .where(and(eq(users.id, actor.id), eq(users.shopId, env().SHOP_ID)))
        .run();

      if (updateResult.rowsAffected !== 1) {
        throw new DomainError("CONFLICT", "User was modified concurrently", 409);
      }

      await setCredentialHash(tx, actor.id, passwordHash);
      await revokeAllUserSessions(tx, actor.id);

      await tx.insert(auditEntries).values({
        id: randomUUID(),
        shopId: env().SHOP_ID,
        actor: actor.email ?? actor.id,
        action: "user.password_changed",
        entityType: "user",
        entityId: actor.id,
        detailsJson: JSON.stringify({ selfService: true }),
        createdAt: now,
      });

      await tx.insert(auditEntries).values({
        id: randomUUID(),
        shopId: env().SHOP_ID,
        actor: actor.email ?? actor.id,
        action: "user.sessions_revoked",
        entityType: "user",
        entityId: actor.id,
        detailsJson: JSON.stringify({ reason: "password_changed", selfService: true }),
        createdAt: now,
      });
    });

    const response = success({ changed: true, requireSignIn: true }, request);
    response.cookies.delete("better-auth.session_token");
    response.cookies.delete("__Secure-better-auth.session_token");
    response.cookies.delete("metsanilo_session");

    return response;
  } catch (error) {
    return failure(error, request);
  }
}
