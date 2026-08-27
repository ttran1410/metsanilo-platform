import { z } from "zod";
import { db } from "@/db/client";
import { PERMISSIONS, type Permission } from "@/domain/access";
import { updateUserPermission } from "@/domain/admin-users-actions";
import { requirePermission } from "@/domain/access";
import { env } from "@/lib/env";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";

export const runtime = "nodejs";
const command = z.object({ permission: z.enum(PERMISSIONS), granted: z.boolean() });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid permission", 422);
    const { id } = await params;
    const actor = await requirePermission(db(), request, "shop_permissions.assign");
    return success(await updateUserPermission(db(), { actor, shop: { id: env().SHOP_ID }, request }, { userId: id, permission: parsed.data.permission as Permission, granted: parsed.data.granted }));
  } catch (error) { return failure(error); }
}
