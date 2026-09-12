import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/db/client";
import { auditEntries } from "@/db/schema";
import { authenticateUser } from "@/domain/access";
import { createSession, SESSION_COOKIE, sessionMaxAge } from "@/domain/session";
import { failure, success } from "../../response";
import { recordLegacyAuthUsage } from "@/lib/auth-telemetry";
import { isCredentialStateValid, isTemporaryCredentialActive } from "@/lib/auth-integration";
import { env } from "@/lib/env";

export const runtime = "nodejs";
const inputSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      recordLegacyAuthUsage(request, "login_endpoint", 401);
      return new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "Invalid email or password" }), { status: 401, headers: { "content-type": "application/json" } });
    }
    const user = await authenticateUser(db(), parsed.data.email, parsed.data.password);
    if (!isCredentialStateValid(user)) {
      recordLegacyAuthUsage(request, "login_endpoint", 403);
      return new Response(JSON.stringify({ code: "FORBIDDEN", message: "Invalid credential state" }), { status: 403, headers: { "content-type": "application/json" } });
    }
    if (user.mustChangePassword && !isTemporaryCredentialActive(user)) {
      try {
        await db().insert(auditEntries).values({
          id: randomUUID(),
          shopId: env().SHOP_ID,
          actor: user.email ?? user.id,
          action: "user.temporary_password_expired",
          entityType: "user",
          entityId: user.id,
          detailsJson: JSON.stringify({
            expiresAt: user.temporaryPasswordExpiresAt,
            attemptedAt: new Date().toISOString(),
          }),
          createdAt: new Date().toISOString(),
        });
      } catch {
        // Non-blocking for audit insert failure
      }
      recordLegacyAuthUsage(request, "login_endpoint", 403);
      return new Response(JSON.stringify({ code: "FORBIDDEN", message: "Temporary credential expired" }), { status: 403, headers: { "content-type": "application/json" } });
    }
    const response = success({ email: user.email, mustChangePassword: user.mustChangePassword });
    response.cookies.set(SESSION_COOKIE, createSession(user.email!, user.sessionVersion, user.mustChangePassword), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionMaxAge });
    recordLegacyAuthUsage(request, "login_endpoint", 200);
    return response;
  } catch (error) {
    const response = failure(error, request);
    recordLegacyAuthUsage(request, "login_endpoint", response.status);
    return response;
  }
}
