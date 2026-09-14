import { z } from "zod";
import { executeAdminUserCommand, getUserAccessDetail } from "@/domain/admin-user-actions";
import { DomainError } from "@/domain/errors";
import { executeAdminRoute, parseJson } from "../../module";

export const runtime = "nodejs";

const commandSchema = z.object({
  action: z.enum(["update", "role", "active", "reset_permissions", "revoke_sessions"]),
  displayName: z.string().min(2).max(120).optional(),
  email: z
    .preprocess(
      (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
      z.string().email().optional().nullable().or(z.literal(""))
    )
    .optional(),
  role: z.enum(["ADMIN", "MANAGER", "STAFF", "CONTENT_CREATOR"]).optional(),
  active: z.boolean().optional(),
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "shop_users.read",
    parse: async () => (await context.params).id,
    run: async (userId, { database, context: execContext }) => {
      return getUserAccessDetail(
        database,
        { actor: execContext.actor, shop: { id: execContext.shop.shopId } },
        userId
      );
    },
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permissions: ["shop_users.manage", "shop_permissions.assign"],
    parse: async (incoming) => {
      const parsed = commandSchema.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid command payload", 422);
      return parsed.data;
    },
    run: async (input, { database, context: execContext }) => {
      const { id } = await context.params;
      const actionContext = { actor: execContext.actor, shop: { id: execContext.shop.shopId } };

      if (input.action === "update") {
        if (input.email !== undefined) throw new DomainError("FORBIDDEN", "Email address cannot be changed from User & Permissions", 403);
        return executeAdminUserCommand(database, actionContext, { action: "update", userId: id, displayName: input.displayName, role: input.role });
      }

      if (input.action === "role") {
        if (!input.role) throw new DomainError("VALIDATION_ERROR", "Role is required", 422);
        return executeAdminUserCommand(database, actionContext, { action: "role", userId: id, role: input.role });
      }

      if (input.action === "active") {
        if (input.active === undefined) throw new DomainError("VALIDATION_ERROR", "Active status is required", 422);
        return executeAdminUserCommand(database, actionContext, { action: "active", userId: id, active: input.active });
      }

      if (input.action === "reset_permissions") {
        return executeAdminUserCommand(database, actionContext, { action: "reset_permissions", userId: id });
      }

      if (input.action === "revoke_sessions") {
        return executeAdminUserCommand(database, actionContext, { action: "revoke_sessions", userId: id });
      }

      throw new DomainError("VALIDATION_ERROR", "Unknown action", 422);
    },
  });
}

