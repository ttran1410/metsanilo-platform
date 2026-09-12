import { z } from "zod";
import { db } from "@/db/client";
import { currentAuthContext, getUserSessions, revokeCurrentSession, revokeOtherUserSessions } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { readSession, SESSION_COOKIE, sessionMaxAge, touchLegacySession } from "@/domain/session";
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

    if (authContext.mechanism === "better_auth") {
      const sessions = await getUserSessions(db(), authContext.actor.id);
      const response = success({
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
      });
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    if (authContext.mechanism === "legacy_cookie") {
      const timing = authContext.timing;
      const sessions = timing
        ? [
            {
              id: "legacy-current",
              ipAddress: "Current Device",
              userAgent: "Legacy Browser Session",
              createdAt: new Date(timing.idleExpiresAt.getTime() - 60 * 60 * 1000).toISOString(),
              lastActivityAt: new Date(timing.idleExpiresAt.getTime() - 60 * 60 * 1000).toISOString(),
              idleExpiresAt: timing.idleExpiresAt.toISOString(),
              absoluteExpiresAt: timing.absoluteExpiresAt.toISOString(),
              effectiveExpiresAt: timing.effectiveExpiresAt.toISOString(),
              remainingSeconds: timing.remainingSeconds,
              warning: timing.warning,
            },
          ]
        : [];

      const response = success({
        mechanism: "legacy_cookie",
        user: {
          id: authContext.actor.id,
          displayName: authContext.actor.displayName,
          email: authContext.actor.email,
          role: authContext.actor.role,
        },
        currentSessionId: "legacy-current",
        serverNow,
        idleExpiresAt: timing?.idleExpiresAt.toISOString() ?? serverNow,
        absoluteExpiresAt: timing?.absoluteExpiresAt.toISOString() ?? serverNow,
        effectiveExpiresAt: timing?.effectiveExpiresAt.toISOString() ?? serverNow,
        expiryReason: timing?.expiryReason ?? null,
        remainingSeconds: timing?.remainingSeconds ?? 0,
        warning: timing?.warning ?? false,
        sessions,
      });
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    const response = success({
      mechanism: "http_basic",
      user: {
        id: authContext.actor.id,
        displayName: authContext.actor.displayName,
        email: authContext.actor.email,
        role: authContext.actor.role,
      },
      currentSessionId: null,
      serverNow,
      idleExpiresAt: serverNow,
      absoluteExpiresAt: serverNow,
      effectiveExpiresAt: serverNow,
      remainingSeconds: 0,
      warning: false,
      expiryReason: null,
      sessions: [],
    });
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

    if (authContext.mechanism === "better_auth") {
      if (!authContext.sessionId) {
        throw new DomainError("UNAUTHORIZED", "Missing session ID", 401);
      }
      const touched = await touchBetterAuthSession(db(), authContext.sessionId, authContext.actor.id, serverNow);
      if (!touched.valid) {
        throw new DomainError("UNAUTHORIZED", "Session expired", 401);
      }
      const response = success({
        mechanism: "better_auth",
        currentSessionId: authContext.sessionId,
        serverNow: serverNow.toISOString(),
        idleExpiresAt: touched.timing.idleExpiresAt.toISOString(),
        absoluteExpiresAt: touched.timing.absoluteExpiresAt.toISOString(),
        effectiveExpiresAt: touched.timing.effectiveExpiresAt.toISOString(),
        expiryReason: touched.timing.expiryReason,
        remainingSeconds: touched.timing.remainingSeconds,
        warning: touched.timing.warning,
      });
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    if (authContext.mechanism === "legacy_cookie") {
      const cookie = request.headers.get("cookie")?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
      const parsed = readSession(cookie, Math.floor(serverNow.getTime() / 1000));
      if (!parsed) {
        throw new DomainError("UNAUTHORIZED", "Session expired", 401);
      }
      const refreshedCookie = touchLegacySession(parsed, Math.floor(serverNow.getTime() / 1000));
      if (!refreshedCookie) {
        throw new DomainError("UNAUTHORIZED", "Session expired", 401);
      }
      const updatedSession = readSession(refreshedCookie, Math.floor(serverNow.getTime() / 1000))!;
      const response = success({
        mechanism: "legacy_cookie",
        currentSessionId: "legacy-current",
        serverNow: serverNow.toISOString(),
        idleExpiresAt: updatedSession.timing.idleExpiresAt.toISOString(),
        absoluteExpiresAt: updatedSession.timing.absoluteExpiresAt.toISOString(),
        effectiveExpiresAt: updatedSession.timing.effectiveExpiresAt.toISOString(),
        expiryReason: updatedSession.timing.expiryReason,
        remainingSeconds: updatedSession.timing.remainingSeconds,
        warning: updatedSession.timing.warning,
      });
      response.cookies.set(SESSION_COOKIE, refreshedCookie, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: sessionMaxAge,
      });
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    const response = success({
      mechanism: "http_basic",
      currentSessionId: null,
      serverNow: serverNow.toISOString(),
      remainingSeconds: 0,
      warning: false,
    });
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
      const response = success({ revoked: true, scope: "current" });
      response.cookies.delete(SESSION_COOKIE);
      response.cookies.delete("better-auth.session_token");
      response.cookies.delete("__Secure-better-auth.session_token");
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    if (parsed.data.scope === "others") {
      if (authContext.mechanism !== "better_auth" || !authContext.sessionId) {
        throw new DomainError(
          "UNSUPPORTED_SESSION_SCOPE",
          "Cannot revoke other sessions on stateless legacy authentication",
          422
        );
      }

      const result = await revokeOtherUserSessions(db(), request, authContext.sessionId);
      const response = success({
        revoked: true,
        scope: "others",
        affectedCount: result.affectedCount,
      });
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
