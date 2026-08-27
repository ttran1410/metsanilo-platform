import { z } from "zod";
import { db } from "@/db/client";
import {
  getUserAccessDetail,
  requirePermission,
} from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";
import { resetUserPermissions, revokeUserSessions, updateUserProfile, updateUserRole as updateUserRoleAction, updateUserStatus } from "@/domain/admin-users-actions";
import { env } from "@/lib/env";

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
    await requirePermission(db(), request, "shop_users.read");
    const { id } = await context.params;

    return success(await getUserAccessDetail(db(), id));
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const parsed = commandSchema.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid command payload", 422);

    if (parsed.data.action === "update") {
      if (parsed.data.email !== undefined) throw new DomainError("FORBIDDEN", "Email address cannot be changed from User & Permissions", 403);
      return success(
        await updateUserProfile(db(), { actor: await requirePermission(db(), request, "shop_users.manage"), shop: { id: env().SHOP_ID }, request }, {
          userId: id,
          displayName: parsed.data.displayName,
          role: parsed.data.role,
        })
      );
    }

    if (parsed.data.action === "role") {
      if (!parsed.data.role) throw new DomainError("VALIDATION_ERROR", "Role is required", 422);
      const actor = await requirePermission(db(), request, "shop_users.manage");
      return success(await updateUserRoleAction(db(), { actor, shop: { id: env().SHOP_ID }, request }, { userId: id, role: parsed.data.role }));
    }

    if (parsed.data.action === "active") {
      if (parsed.data.active === undefined) throw new DomainError("VALIDATION_ERROR", "Active status is required", 422);
      const actor = await requirePermission(db(), request, "shop_users.manage");
      return success(await updateUserStatus(db(), { actor, shop: { id: env().SHOP_ID }, request }, { userId: id, active: parsed.data.active }));
    }

    if (parsed.data.action === "reset_permissions") {
      const actor = await requirePermission(db(), request, "shop_permissions.assign");
      return success(await resetUserPermissions(db(), { actor, shop: { id: env().SHOP_ID }, request }, id));
    }

    if (parsed.data.action === "revoke_sessions") {
      const actor = await requirePermission(db(), request, "shop_users.manage");
      return success(await revokeUserSessions(db(), { actor, shop: { id: env().SHOP_ID }, request }, id));
    }

    throw new DomainError("VALIDATION_ERROR", "Unknown action", 422);
  } catch (error) {
    return failure(error);
  }
}
