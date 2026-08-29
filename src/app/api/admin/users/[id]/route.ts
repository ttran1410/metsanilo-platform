import { z } from "zod";
import { getUserAccessDetail } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";
import { executeAdminUserCommand } from "@/domain/admin-users-actions";
import { authenticateAdminAny, executeAdmin, parseJson } from "../../module";

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
  try {
    const { id } = await context.params;
    const result = await executeAdmin(request, { permission: "shop_users.read", parse: async () => id, run: async (userId, { database }) => getUserAccessDetail(database, userId) });
    return success(result);
  } catch (error) {
    return failure(error, request);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await authenticateAdminAny(request, ["shop_users.manage", "shop_permissions.assign"]);
    const parsed = commandSchema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid command payload", 422);

    if (parsed.data.action === "update") {
      if (parsed.data.email !== undefined) throw new DomainError("FORBIDDEN", "Email address cannot be changed from User & Permissions", 403);
      const result = await executeAdmin(request, { permission: "shop_users.manage", parse: async () => parsed.data, run: async (input, { database, context }) => executeAdminUserCommand(database, { actor: context.actor, shop: { id: context.shop.shopId }, request }, { action: "update", userId: id, displayName: input.displayName, role: input.role }) });
      return success(result);
    }

    if (parsed.data.action === "role") {
      if (!parsed.data.role) throw new DomainError("VALIDATION_ERROR", "Role is required", 422);
      const result = await executeAdmin(request, { permission: "shop_users.manage", parse: async () => parsed.data.role!, run: async (role, { database, context }) => executeAdminUserCommand(database, { actor: context.actor, shop: { id: context.shop.shopId }, request }, { action: "role", userId: id, role }) });
      return success(result);
    }

    if (parsed.data.action === "active") {
      if (parsed.data.active === undefined) throw new DomainError("VALIDATION_ERROR", "Active status is required", 422);
      const result = await executeAdmin(request, { permission: "shop_users.manage", parse: async () => parsed.data.active!, run: async (active, { database, context }) => executeAdminUserCommand(database, { actor: context.actor, shop: { id: context.shop.shopId }, request }, { action: "active", userId: id, active }) });
      return success(result);
    }

    if (parsed.data.action === "reset_permissions") {
      const result = await executeAdmin(request, { permission: "shop_permissions.assign", parse: async () => undefined, run: async (_input, { database, context }) => executeAdminUserCommand(database, { actor: context.actor, shop: { id: context.shop.shopId }, request }, { action: "reset_permissions", userId: id }) });
      return success(result);
    }

    if (parsed.data.action === "revoke_sessions") {
      const result = await executeAdmin(request, { permission: "shop_users.manage", parse: async () => undefined, run: async (_input, { database, context }) => executeAdminUserCommand(database, { actor: context.actor, shop: { id: context.shop.shopId }, request }, { action: "revoke_sessions", userId: id }) });
      return success(result);
    }

    throw new DomainError("VALIDATION_ERROR", "Unknown action", 422);
  } catch (error) {
    return failure(error, request);
  }
}
