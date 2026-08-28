import type { NextResponse } from "next/server";
import { db } from "@/db/client";
import { currentUser, hasUserPermission, type Permission } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";

export type AdminActor = Awaited<ReturnType<typeof currentUser>>;

export type AdminShopContext = Readonly<{ shopId: string }>;
export type AdminActorContext = Readonly<{ actor: AdminActor }>;
export type AdminExecutionContext = AdminActorContext & { shop: AdminShopContext };

export type AdminRequest = Readonly<{
  request: Request;
  database: ReturnType<typeof db>;
  context: AdminExecutionContext;
}>;

export type AdminDefinition<TInput, TResult> = Readonly<{
  permission: Permission;
  parse: (request: Request) => Promise<TInput>;
  run: (input: TInput, context: AdminRequest) => Promise<TResult>;
}>;

export async function parseJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new DomainError("VALIDATION_ERROR", "Invalid JSON request body", 422);
  }
}

export async function authenticateAdmin(request: Request, permission: Permission): Promise<AdminExecutionContext> {
  const database = db();
  const actor = await currentUser(database, request);
  if (!(await hasUserPermission(database, actor, permission))) {
    throw new DomainError("FORBIDDEN", `Permission required: ${permission}`, 403);
  }
  return { actor, shop: { shopId: env().SHOP_ID } };
}

export async function authenticateAdminAny(request: Request, permissions: readonly Permission[]): Promise<AdminExecutionContext> {
  const database = db();
  const actor = await currentUser(database, request);
  if (!(await Promise.all(permissions.map((permission) => hasUserPermission(database, actor, permission)))).some(Boolean)) {
    throw new DomainError("FORBIDDEN", "Admin permission required", 403);
  }
  return { actor, shop: { shopId: env().SHOP_ID } };
}

export async function executeAdmin<TInput, TResult>(
  request: Request,
  definition: AdminDefinition<TInput, TResult>,
): Promise<TResult> {
  const context = await authenticateAdmin(request, definition.permission);
  return definition.run(await definition.parse(request), {
    request,
    database: db(),
    context,
  });
}

export type AdminResponseAdapter = (result: unknown, status?: number) => NextResponse;
