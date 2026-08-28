import { z } from "zod";
import { PERMISSIONS, type Permission } from "@/domain/access";
import { updateUserPermission } from "@/domain/admin-users-actions";
import { env } from "@/lib/env";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";
import { authenticateAdminAny, executeAdmin, parseJson } from "../../../module";

export const runtime = "nodejs";
const command = z.object({ permission: z.enum(PERMISSIONS), granted: z.boolean() });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authenticateAdminAny(request, ["shop_permissions.assign"]);
    const parsed = command.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid permission", 422);
    const { id } = await params;
    const result = await executeAdmin(request, { permission: "shop_permissions.assign", parse: async () => ({ userId: id, permission: parsed.data.permission as Permission, granted: parsed.data.granted }), run: async (input, { database, context: { actor } }) => updateUserPermission(database, { actor, shop: { id: env().SHOP_ID }, request }, input) });
    return success(result);
  } catch (error) { return failure(error, request); }
}
