import { z } from "zod";
import { db } from "@/db/client";
import { getUserAccessDetail } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";
import { executeAdminUserCommand } from "@/domain/admin-users-actions";
import { env } from "@/lib/env";
import { authenticateAdmin, authenticateAdminAny, executeAdmin, parseJson } from "../../module";

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
      const actor = (await authenticateAdmin(request, "shop_users.manage")).actor;
      return success(await executeAdminUserCommand(db(), { actor, shop: { id: env().SHOP_ID }, request }, { action: "update", userId: id, displayName: parsed.data.displayName, role: parsed.data.role }));
    }

    if (parsed.data.action === "role") {
      if (!parsed.data.role) throw new DomainError("VALIDATION_ERROR", "Role is required", 422);
      const actor = (await authenticateAdmin(request, "shop_users.manage")).actor;
      return success(await executeAdminUserCommand(db(), { actor, shop: { id: env().SHOP_ID }, request }, { action: "role", userId: id, role: parsed.data.role }));
    }

    if (parsed.data.action === "active") {
      if (parsed.data.active === undefined) throw new DomainError("VALIDATION_ERROR", "Active status is required", 422);
      const actor = (await authenticateAdmin(request, "shop_users.manage")).actor;
      return success(await executeAdminUserCommand(db(), { actor, shop: { id: env().SHOP_ID }, request }, { action: "active", userId: id, active: parsed.data.active }));
    }

    if (parsed.data.action === "reset_permissions") {
      const actor = (await authenticateAdmin(request, "shop_permissions.assign")).actor;
      return success(await executeAdminUserCommand(db(), { actor, shop: { id: env().SHOP_ID }, request }, { action: "reset_permissions", userId: id }));
    }

    if (parsed.data.action === "revoke_sessions") {
      const actor = (await authenticateAdmin(request, "shop_users.manage")).actor;
      return success(await executeAdminUserCommand(db(), { actor, shop: { id: env().SHOP_ID }, request }, { action: "revoke_sessions", userId: id }));
    }

    throw new DomainError("VALIDATION_ERROR", "Unknown action", 422);
  } catch (error) {
    return failure(error, request);
  }
}
