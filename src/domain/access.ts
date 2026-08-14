import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, userPermissions, users } from "@/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "./errors";
import { readSession, SESSION_COOKIE } from "./session";

export const PERMISSIONS = [
  "orders.read", "orders.create", "orders.update", "orders.transition", "orders.payment.write",
  "catalog.product.write", "catalog.product.delete_unreferenced", "catalog.package.write",
  "availability.write", "availability.sold_out", "delivery.override", "cms.edit", "cms.publish",
  "media.write", "invoices.issue", "invoices.download", "picking.write", "pickers.manage",
  "customers.read", "customers.write", "shop_users.manage", "shop_permissions.assign", "settings.operational", "audit.read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type Role = "ADMIN" | "MANAGER" | "STAFF" | "CONTENT_CREATOR";

function usernameFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) throw new DomainError("UNAUTHORIZED", "Authentication required", 401);
  const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator <= 0) throw new DomainError("UNAUTHORIZED", "Authentication required", 401);
  return decoded.slice(0, separator);
}

export async function currentUser(database: Database, request: Request) {
  const shopId = env().SHOP_ID;
  const cookie = request.headers.get("cookie")?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
  const username = readSession(cookie) ?? usernameFromRequest(request);
  const user = await database.query.users.findFirst({ where: and(eq(users.shopId, shopId), eq(users.username, username), eq(users.active, true)) });
  if (user) return user;
  if (username === env().MANAGER_USERNAME) return { id: "legacy-admin", shopId, username, displayName: username, role: "ADMIN" as const, active: true, createdAt: "legacy" };
  throw new DomainError("FORBIDDEN", "User is not active in this shop", 403);
}

export async function requirePermission(database: Database, request: Request, permission: Permission) {
  const actor = await currentUser(database, request);
  if (actor.role === "ADMIN" || actor.role === "MANAGER") return actor;
  const grant = await database.query.userPermissions.findFirst({ where: and(eq(userPermissions.userId, actor.id), eq(userPermissions.shopId, actor.shopId), eq(userPermissions.permission, permission), eq(userPermissions.granted, true)) });
  if (!grant) throw new DomainError("FORBIDDEN", `Permission required: ${permission}`, 403);
  return actor;
}

export async function listUsers(database: Database, request: Request) {
  await requirePermission(database, request, "shop_users.manage");
  const shopId = env().SHOP_ID;
  const rows = await database.select().from(users).where(eq(users.shopId, shopId));
  const grants = await database.select().from(userPermissions).where(eq(userPermissions.shopId, shopId));
  return rows.map((user) => ({ ...user, permissions: grants.filter((grant) => grant.userId === user.id && grant.granted).map((grant) => grant.permission) }));
}

export async function createUser(database: Database, request: Request, input: { username: string; displayName: string; role: Role }) {
  const actor = await requirePermission(database, request, "shop_users.manage");
  if (actor.role !== "ADMIN" && input.role === "ADMIN") throw new DomainError("FORBIDDEN", "Only Admin can create an Admin", 403);
  const username = input.username.trim(); const displayName = input.displayName.trim();
  if (!/^[a-zA-Z0-9._-]{2,80}$/.test(username) || displayName.length < 2 || displayName.length > 120) throw new DomainError("VALIDATION_ERROR", "Invalid user details", 422);
  const id = randomUUID(); const createdAt = new Date().toISOString();
  try {
    await database.insert(users).values({ id, shopId: env().SHOP_ID, username, displayName, role: input.role, active: true, createdAt });
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) throw new DomainError("DUPLICATE_USER", "Username already exists", 409);
    throw error;
  }
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: env().SHOP_ID, actor: actor.username, action: "user.created", entityType: "user", entityId: id, detailsJson: JSON.stringify({ username, role: input.role }), createdAt });
  return (await database.query.users.findFirst({ where: eq(users.id, id) }))!;
}

export async function setUserPermission(database: Database, request: Request, input: { userId: string; permission: Permission; granted: boolean }) {
  const actor = await requirePermission(database, request, "shop_permissions.assign");
  const target = await database.query.users.findFirst({ where: and(eq(users.id, input.userId), eq(users.shopId, env().SHOP_ID)) });
  if (!target) throw new DomainError("NOT_FOUND", "User not found", 404);
  if (target.role !== "STAFF" && target.role !== "CONTENT_CREATOR") throw new DomainError("FORBIDDEN", "Only Staff and Content Creator permissions are assignable", 403);
  const updatedAt = new Date().toISOString();
  await database.insert(userPermissions).values({ id: randomUUID(), shopId: env().SHOP_ID, userId: target.id, permission: input.permission, granted: input.granted, updatedAt }).onConflictDoUpdate({ target: [userPermissions.userId, userPermissions.permission], set: { granted: input.granted, updatedAt } });
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: env().SHOP_ID, actor: actor.username, action: input.granted ? "user.permission_granted" : "user.permission_revoked", entityType: "user", entityId: target.id, detailsJson: JSON.stringify({ permission: input.permission }), createdAt: updatedAt });
  return { userId: target.id, permission: input.permission, granted: input.granted };
}
