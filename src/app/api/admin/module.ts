import type { NextResponse } from "next/server";
import { db } from "@/db/client";
import { assertOperationalAccess, currentUser, hasUserPermission, type Permission } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";
import { success, failure } from "@/app/api/response";

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

const requestAuthCache = new WeakMap<Request, Promise<AdminExecutionContext>>();

export async function authenticateAdmin(request: Request, permission: Permission): Promise<AdminExecutionContext> {
  let authentication = requestAuthCache.get(request);
  if (!authentication) {
    const startedAt = Date.now();
    authentication = authenticateAdminContext(request).then((context) => {
      console.info("[admin-timing]", JSON.stringify({ route: new URL(request.url).pathname, phase: "auth", durationMs: Date.now() - startedAt, correlationId: request.headers.get("x-correlation-id") ?? "none" }));
      return context;
    });
    requestAuthCache.set(request, authentication);
  }
  const context = await authentication;
  const permissionStartedAt = Date.now();
  if (!(await hasUserPermission(db(), context.actor, permission))) {
    throw new DomainError("FORBIDDEN", `Permission required: ${permission}`, 403);
  }
  console.info("[admin-timing]", JSON.stringify({ route: new URL(request.url).pathname, phase: "permission", durationMs: Date.now() - permissionStartedAt, correlationId: request.headers.get("x-correlation-id") ?? "none" }));
  return context;
}

async function authenticateAdminContext(request: Request): Promise<AdminExecutionContext> {
  const database = db();
  const actor = await currentUser(database, request);
  const shop = { shopId: env().SHOP_ID };
  if (actor.shopId !== shop.shopId) {
    throw new DomainError("FORBIDDEN", "Admin account is not active in this shop", 403);
  }
  assertOperationalAccess(actor);
  return { actor, shop };
}

export async function authenticateAdminAny(request: Request, permissions: readonly Permission[]): Promise<AdminExecutionContext> {
  const context = await authenticateAdminContext(request);
  const database = db();
  if (!(await Promise.all(permissions.map((permission) => hasUserPermission(database, context.actor, permission)))).some(Boolean)) {
    throw new DomainError("FORBIDDEN", "Admin permission required", 403);
  }
  return context;
}

export async function assertAdminPermission(context: AdminExecutionContext, permission: Permission): Promise<void> {
  if (!(await hasUserPermission(db(), context.actor, permission))) {
    throw new DomainError("FORBIDDEN", `Permission required: ${permission}`, 403);
  }
}

export async function executeAdmin<TInput, TResult>(
  request: Request,
  definition: AdminDefinition<TInput, TResult>,
): Promise<TResult> {
  const context = await authenticateAdmin(request, definition.permission);
  const input = await definition.parse(request);
  const startedAt = Date.now();
  const result = await definition.run(input, {
    request,
    database: db(),
    context,
  });
  console.info("[admin-timing]", JSON.stringify({ route: new URL(request.url).pathname, phase: "application", durationMs: Date.now() - startedAt, correlationId: request.headers.get("x-correlation-id") ?? "none" }));
  return result;
}


export type AdminResponseAdapter = (result: unknown, status?: number) => NextResponse;

export type AdminRouteDefinition<TInput, TResult> = Readonly<
  (
    | { permission: Permission; permissions?: never }
    | { permissions: readonly Permission[]; permission?: never }
  ) & {
    parse?: (request: Request) => Promise<TInput>;
    authorize?: (input: TInput, context: AdminRequest) => Promise<void>;
    run: (input: TInput, context: AdminRequest) => Promise<TResult>;
    status?: number;
    headers?: Record<string, string> | Headers;
  }
>;

export async function executeAdminRoute<TInput = void, TResult = unknown>(
  request: Request,
  definition: AdminRouteDefinition<TInput, TResult>,
): Promise<NextResponse> {
  try {
    const context = definition.permissions
      ? await authenticateAdminAny(request, definition.permissions)
      : await authenticateAdmin(request, definition.permission);


    const input = definition.parse ? await definition.parse(request) : (undefined as unknown as TInput);
    const adminRequest = {
      request,
      database: db(),
      context,
    };
    if (definition.authorize) await definition.authorize(input, adminRequest);
    const startedAt = Date.now();
    const result = await definition.run(input, adminRequest);
    console.info("[admin-timing]", JSON.stringify({
      route: new URL(request.url).pathname,
      phase: "application",
      durationMs: Date.now() - startedAt,
      correlationId: request.headers.get("x-correlation-id") ?? "none",
    }));

    const response = success(result, request, definition.status ?? 200);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    if (definition.headers) {
      if (definition.headers instanceof Headers) {
        definition.headers.forEach((value, key) => {
          response.headers.set(key, value);
        });
      } else {
        for (const [key, value] of Object.entries(definition.headers)) {
          response.headers.set(key, value);
        }
      }
    }
    return response;
  } catch (error) {
    return failure(error, request);
  }
}
