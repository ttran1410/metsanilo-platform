import { z } from "zod";
import { db } from "@/db/client";
import {
  getUserAuditTrail,
  getUserSessions,
  requirePermission,
  resetUserPermissionsToRole,
  revokeUserSessions,
  toggleUserActive,
  updateUserProfile,
  updateUserRole,
} from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";

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

    const sessions = await getUserSessions(db(), id);
    const audit = await getUserAuditTrail(db(), id);

    return success({
      sessions,
      audit,
    });
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
      return success(
        await updateUserProfile(db(), request, {
          userId: id,
          displayName: parsed.data.displayName,
          email: parsed.data.email,
          role: parsed.data.role,
        })
      );
    }

    if (parsed.data.action === "role") {
      if (!parsed.data.role) throw new DomainError("VALIDATION_ERROR", "Role is required", 422);
      return success(await updateUserRole(db(), request, { userId: id, role: parsed.data.role }));
    }

    if (parsed.data.action === "active") {
      if (parsed.data.active === undefined) throw new DomainError("VALIDATION_ERROR", "Active status is required", 422);
      return success(await toggleUserActive(db(), request, { userId: id, active: parsed.data.active }));
    }

    if (parsed.data.action === "reset_permissions") {
      return success(await resetUserPermissionsToRole(db(), request, id));
    }

    if (parsed.data.action === "revoke_sessions") {
      return success(await revokeUserSessions(db(), request, id));
    }

    throw new DomainError("VALIDATION_ERROR", "Unknown action", 422);
  } catch (error) {
    return failure(error);
  }
}
