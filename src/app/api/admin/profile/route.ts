import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { authUsers, users } from "@/db/schema";
import { currentUser } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { failure, success } from "@/app/api/response";
import { env } from "@/lib/env";

const update = z.object({ displayName: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254) });

async function actor(request: Request) { return currentUser(db(), request); }

export async function GET(request: Request) {
  try { const user = await actor(request); return success({ id: user.id, displayName: user.displayName, email: user.email, username: user.username, role: user.role, active: user.active }); } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await actor(request);
    const parsed = update.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid profile details", 422);
    const email = parsed.data.email.toLowerCase();
    const existing = await db().query.users.findFirst({ where: and(eq(users.shopId, env().SHOP_ID), eq(users.email, email)) });
    if (existing && existing.id !== user.id) throw new DomainError("DUPLICATE_USER", "Email is already in use", 409);
    const now = new Date().toISOString();
    const [updated] = await db().update(users).set({ displayName: parsed.data.displayName, email, username: email }).where(and(eq(users.id, user.id), eq(users.shopId, env().SHOP_ID))).returning();
    if (user.id !== "legacy-admin") await db().update(authUsers).set({ name: parsed.data.displayName, email, updatedAt: new Date() }).where(eq(authUsers.id, user.id));
    return success({ id: updated.id, displayName: updated.displayName, email: updated.email, username: updated.username, role: updated.role, active: updated.active, updatedAt: now });
  } catch (error) { return failure(error); }
}
