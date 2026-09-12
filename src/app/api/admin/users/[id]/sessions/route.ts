import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { users } from "@/db/schema";
import {
  assertCanManageUserSessions,
  getUserSessions,
  revokeSingleSession,
  revokeUserSessions,
} from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { SESSION_COOKIE } from "@/domain/session";
import { currentAuthContext } from "@/domain/access";
import { env } from "@/lib/env";
import { failure, success } from "../../../../response";
import { authenticateAdmin, parseJson } from "../../../module";

export const runtime = "nodejs";

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  if (!origin) {
    throw new DomainError("FORBIDDEN", "Same-origin request required", 403);
  }
  try {
    const originUrl = new URL(origin);
    if (host && originUrl.host !== host) {
      throw new DomainError("FORBIDDEN", "Cross-origin request forbidden", 403);
    }
  } catch (e) {
    if (e instanceof DomainError) throw e;
    throw new DomainError("FORBIDDEN", "Invalid origin header", 403);
  }
}

const deleteSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("single"),
    sessionId: z.string().min(1),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    scope: z.literal("all"),
    reason: z.string().max(500).optional(),
  }),
]);

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { actor, database } = await authenticateAdmin(request, "shop_users.read").then(async (ctx) => ({
      actor: ctx.actor,
      database: (await import("@/db/client")).db(),
    }));

    const targetUser = await database.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.shopId, env().SHOP_ID)),
    });
    if (!targetUser) {
      throw new DomainError("NOT_FOUND", "User not found", 404);
    }

    assertCanManageUserSessions(actor, targetUser);

    const sessions = await getUserSessions(database, id);
    const response = success(sessions);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const response = failure(error, request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const { actor, database } = await authenticateAdmin(request, "shop_users.manage").then(async (ctx) => ({
      actor: ctx.actor,
      database: (await import("@/db/client")).db(),
    }));

    const targetUser = await database.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.shopId, env().SHOP_ID)),
    });
    if (!targetUser) {
      throw new DomainError("NOT_FOUND", "User not found", 404);
    }

    assertCanManageUserSessions(actor, targetUser);

    const body = await parseJson<unknown>(request);
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError("VALIDATION_ERROR", "Invalid session revocation payload", 422);
    }

    const currentContext = await currentAuthContext(database, request);
    let result: { userId: string; sessionId?: string; revoked: boolean; affectedCount?: number };

    if (parsed.data.scope === "single") {
      result = await revokeSingleSession(
        database,
        request,
        id,
        parsed.data.sessionId,
        parsed.data.reason
      );
    } else {
      result = await revokeUserSessions(database, request, id, parsed.data.reason);
    }

    const response = success(result);
    if (actor.id === id && (parsed.data.scope === "all" || currentContext.sessionId === parsed.data.sessionId)) {
      response.cookies.delete(SESSION_COOKIE);
      response.cookies.delete("better-auth.session_token");
      response.cookies.delete("__Secure-better-auth.session_token");
    }
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const response = failure(error, request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
