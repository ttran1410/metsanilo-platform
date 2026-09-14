import { z } from "zod";
import { db } from "@/db/client";
import { currentAuthContext, getUserSessions, revokeCurrentSession, revokeOtherUserSessions } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { touchBetterAuthSession } from "@/lib/auth-integration";
import { failure, success } from "../../response";

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

const deleteSchema = z.object({
  scope: z.enum(["current", "others"]),
});

export async function GET(request: Request) {
  try {
    const authContext = await currentAuthContext(db(), request);
    const serverNow = new Date().toISOString();

    const sessions = await getUserSessions(db(), authContext.actor, authContext.actor.id);
    const response = success(
      {
        mechanism: "better_auth",
        user: {
          id: authContext.actor.id,
          displayName: authContext.actor.displayName,
          email: authContext.actor.email,
          role: authContext.actor.role,
        },
        currentSessionId: authContext.sessionId ?? null,
        serverNow,
        idleExpiresAt: authContext.timing?.idleExpiresAt.toISOString() ?? serverNow,
        absoluteExpiresAt: authContext.timing?.absoluteExpiresAt.toISOString() ?? serverNow,
        effectiveExpiresAt: authContext.timing?.effectiveExpiresAt.toISOString() ?? serverNow,
        expiryReason: authContext.timing?.expiryReason ?? null,
        remainingSeconds: authContext.timing?.remainingSeconds ?? 0,
        warning: authContext.timing?.warning ?? false,
        sessions,
      },
      request,
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const response = failure(error, request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const authContext = await currentAuthContext(db(), request);
    const serverNow = new Date();

    if (!authContext.sessionId) {
      throw new DomainError("UNAUTHORIZED", "Missing session ID", 401);
    }
    const touched = await touchBetterAuthSession(db(), authContext.sessionId, authContext.actor.id, serverNow);
    if (!touched.valid) {
      throw new DomainError("UNAUTHORIZED", "Session expired", 401);
    }
    const response = success(
      {
        mechanism: "better_auth",
        currentSessionId: authContext.sessionId,
        serverNow: serverNow.toISOString(),
        idleExpiresAt: touched.timing.idleExpiresAt.toISOString(),
        absoluteExpiresAt: touched.timing.absoluteExpiresAt.toISOString(),
        effectiveExpiresAt: touched.timing.effectiveExpiresAt.toISOString(),
        expiryReason: touched.timing.expiryReason,
        remainingSeconds: touched.timing.remainingSeconds,
        warning: touched.timing.warning,
      },
      request,
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const response = failure(error, request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    let bodyJson: unknown;
    try {
      bodyJson = await request.json();
    } catch {
      throw new DomainError("VALIDATION_ERROR", "Invalid JSON payload", 422);
    }

    const parsed = deleteSchema.safeParse(bodyJson);
    if (!parsed.success) {
      throw new DomainError("VALIDATION_ERROR", "Invalid session delete scope", 422);
    }

    const authContext = await currentAuthContext(db(), request);

    if (parsed.data.scope === "current") {
      await revokeCurrentSession(db(), request);
      const response = success({ revoked: true, scope: "current" }, request);
      response.cookies.delete("better-auth.session_token");
      response.cookies.delete("__Secure-better-auth.session_token");
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    if (parsed.data.scope === "others") {
      if (!authContext.sessionId) {
        throw new DomainError(
          "UNSUPPORTED_SESSION_SCOPE",
          "Cannot revoke other sessions without active session ID",
          422,
        );
      }

      const result = await revokeOtherUserSessions(db(), request, authContext.sessionId);
      const response = success(
        {
          revoked: true,
          scope: "others",
          affectedCount: result.affectedCount,
        },
        request,
      );
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    throw new DomainError("VALIDATION_ERROR", "Unsupported scope", 422);
  } catch (error) {
    const response = failure(error, request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
