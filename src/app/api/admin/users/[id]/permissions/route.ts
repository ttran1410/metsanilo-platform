import { z } from "zod";
import { updateUserPermission } from "@/domain/admin-user-actions";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { DomainError } from "@/domain/errors";
import { executeAdminRoute, parseJson } from "../../../module";

export const runtime = "nodejs";
const command = z.object({ permission: z.enum(PERMISSIONS), granted: z.boolean() });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "shop_permissions.assign",
    parse: async (incoming) => {
      const parsed = command.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid permission", 422);
      const { id } = await params;
      return { userId: id, permission: parsed.data.permission as Permission, granted: parsed.data.granted };
    },
    run: async (input, { database, context: { actor, shop } }) =>
      updateUserPermission(database, { actor, shop: { id: shop.shopId } }, input),
  });
}

