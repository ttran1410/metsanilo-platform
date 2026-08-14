import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, authAccounts, authUsers, userPermissions, users } from "@/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "./errors";
import { readSession, SESSION_COOKIE } from "./session";
import { assertPassword, hashPassword, verifyPassword } from "./passwords";
import { betterAuthInstance } from "@/lib/better-auth";

export const PERMISSIONS = [
  "orders.read", "orders.create", "orders.update", "orders.transition", "orders.payment.write",
  "catalog.product.write", "catalog.product.delete_unreferenced", "catalog.package.write",
  "availability.write", "availability.sold_out", "delivery.override", "cms.edit", "cms.publish",
  "media.write", "invoices.issue", "invoices.download", "picking.write", "pickers.manage",
  "customers.read", "customers.write", "shop_users.manage", "shop_permissions.assign", "settings.operational", "audit.read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type Role = "ADMIN" | "MANAGER" | "STAFF" | "CONTENT_CREATOR";

/** Admin and Manager receive the full implemented operational catalogue.
 * Staff and Content Creator start empty and require explicit grants. */
export function defaultPermissionsForRole(role: Role): Permission[] {
  return role === "ADMIN" || role === "MANAGER" ? [...PERMISSIONS] : [];
}

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
  // Better Auth is now the source of session truth. The shop users table remains
  // authoritative for active status and role/permission mapping.
  try {
    const betterSession = await betterAuthInstance.api.getSession({ headers: request.headers });
    if (betterSession?.user?.id) {
      const mapped = await database.query.users.findFirst({ where: and(eq(users.id, betterSession.user.id), eq(users.shopId, shopId), eq(users.active, true)) });
      if (mapped) return mapped;
    }
  } catch {
    // Fall through for legacy Basic Auth during the rollout window.
  }
  const cookie = request.headers.get("cookie")?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
  const session = readSession(cookie);
  const identifier = session?.email ?? usernameFromRequest(request);
  const user = await database.query.users.findFirst({ where: and(eq(users.shopId, shopId), eq(users.email, identifier), eq(users.active, true)) }) ?? await database.query.users.findFirst({ where: and(eq(users.shopId, shopId), eq(users.username, identifier), eq(users.active, true)) });
  if (session && user && user.sessionVersion !== session.sessionVersion) throw new DomainError("UNAUTHORIZED", "Session expired", 401);
  if (user) return user;
  if (identifier === "manager") return { id: "legacy-admin", shopId, email: null, username: null, passwordHash: "", mustChangePassword: false, sessionVersion: 1, displayName: "Legacy admin", role: "ADMIN" as const, active: true, createdAt: "legacy" };
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
  return rows.map((user) => ({ ...user, permissions: [...new Set([...grants.filter((grant) => grant.userId === user.id && grant.granted).map((grant) => grant.permission as Permission), ...defaultPermissionsForRole(user.role)])] }));
}

export async function createUser(database: Database, request: Request, input: { email: string; displayName: string; role: Role; password: string }) {
  const actor = await requirePermission(database, request, "shop_users.manage");
  if (actor.role !== "ADMIN" && input.role === "ADMIN") throw new DomainError("FORBIDDEN", "Only Admin can create an Admin", 403);
  const email = input.email.trim().toLowerCase(); const displayName = input.displayName.trim();
  if (!zodEmail(email) || displayName.length < 2 || displayName.length > 120) throw new DomainError("VALIDATION_ERROR", "Invalid user details", 422);
  try { assertPassword(input.password); } catch (error) { throw new DomainError("VALIDATION_ERROR", error instanceof Error ? error.message : "Invalid password", 422); }
  const id = randomUUID(); const createdAt = new Date().toISOString();
  try {
    const passwordHash = hashPassword(input.password);
    await database.insert(users).values({ id, shopId: env().SHOP_ID, username: email, email, passwordHash, mustChangePassword: false, displayName, role: input.role, active: true, createdAt });
    const now = new Date();
    await database.insert(authUsers).values({ id, name: displayName, email, emailVerified: true, image: null, createdAt: now, updatedAt: now });
    await database.insert(authAccounts).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: passwordHash, createdAt: now, updatedAt: now });
    const defaults = defaultPermissionsForRole(input.role);
    if (defaults.length) await database.insert(userPermissions).values(defaults.map((permission) => ({ id: randomUUID(), shopId: env().SHOP_ID, userId: id, permission, granted: true, updatedAt: createdAt })));
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) throw new DomainError("DUPLICATE_USER", "Username already exists", 409);
    throw error;
  }
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: env().SHOP_ID, actor: actor.email ?? actor.username ?? actor.id, action: "user.created", entityType: "user", entityId: id, detailsJson: JSON.stringify({ email, role: input.role }), createdAt });
  return (await database.query.users.findFirst({ where: eq(users.id, id) }))!;
}

export async function setUserPermission(database: Database, request: Request, input: { userId: string; permission: Permission; granted: boolean }) {
  const actor = await requirePermission(database, request, "shop_permissions.assign");
  const target = await database.query.users.findFirst({ where: and(eq(users.id, input.userId), eq(users.shopId, env().SHOP_ID)) });
  if (!target) throw new DomainError("NOT_FOUND", "User not found", 404);
  if (target.role !== "STAFF" && target.role !== "CONTENT_CREATOR") throw new DomainError("FORBIDDEN", "Only Staff and Content Creator permissions are assignable", 403);
  const updatedAt = new Date().toISOString();
  await database.insert(userPermissions).values({ id: randomUUID(), shopId: env().SHOP_ID, userId: target.id, permission: input.permission, granted: input.granted, updatedAt }).onConflictDoUpdate({ target: [userPermissions.userId, userPermissions.permission], set: { granted: input.granted, updatedAt } });
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: env().SHOP_ID, actor: actor.email ?? actor.username ?? actor.id, action: input.granted ? "user.permission_granted" : "user.permission_revoked", entityType: "user", entityId: target.id, detailsJson: JSON.stringify({ permission: input.permission }), createdAt: updatedAt });
  return { userId: target.id, permission: input.permission, granted: input.granted };
}

function zodEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

export async function authenticateUser(database: Database, email: string, password: string) {
  const user = await database.query.users.findFirst({ where: and(eq(users.email, email.trim().toLowerCase()), eq(users.shopId, env().SHOP_ID), eq(users.active, true)) });
  if (!user || !verifyPassword(password, user.passwordHash)) throw new DomainError("UNAUTHORIZED", "Invalid email or password", 401);
  return user;
}
