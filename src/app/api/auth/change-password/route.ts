import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEntries, authAccounts, users } from "@/db/schema";
import { currentUser } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { hashPassword, verifyPassword } from "@/domain/passwords";
import { env } from "@/lib/env";
import { failure, success } from "../../response";
import { createSession, SESSION_COOKIE, sessionMaxAge } from "@/domain/session";
import { betterAuthInstance } from "@/lib/better-auth";
const command = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
export const runtime = "nodejs";
export async function POST(request: Request) { try { const actor = await currentUser(db(), request); const parsed = command.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid password", 422); if (request.headers.get("cookie")?.includes("better-auth")) await betterAuthInstance.api.changePassword({ body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword, revokeOtherSessions: true }, headers: request.headers }); if (!verifyPassword(parsed.data.currentPassword, actor.passwordHash)) throw new DomainError("UNAUTHORIZED", "Current password is incorrect", 401); const now = new Date().toISOString(); const nextVersion = actor.sessionVersion + 1; const passwordHash = hashPassword(parsed.data.newPassword); await db().update(users).set({ passwordHash, mustChangePassword: false, sessionVersion: nextVersion }).where(and(eq(users.id, actor.id), eq(users.shopId, env().SHOP_ID))); await db().update(authAccounts).set({ password: passwordHash, updatedAt: new Date() }).where(and(eq(authAccounts.userId, actor.id), eq(authAccounts.providerId, "credential"))); await db().insert(auditEntries).values({ id: crypto.randomUUID(), shopId: env().SHOP_ID, actor: actor.email ?? actor.id, action: "user.password_changed", entityType: "user", entityId: actor.id, detailsJson: JSON.stringify({ selfService: true }), createdAt: now }); const response = success({ changed: true }); response.cookies.set(SESSION_COOKIE, createSession(actor.email!, nextVersion, false), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionMaxAge }); return response; } catch (error) { return failure(error); } }
