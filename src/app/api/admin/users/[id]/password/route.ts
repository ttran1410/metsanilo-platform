import { executeAdmin } from "../../../module";
import { resetAdminUserPassword } from "@/domain/admin-user-actions";
import { env } from "@/lib/env";
import { failure, success } from "../../../../response";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await executeAdmin(request, { permission: "shop_users.password_reset", parse: async () => id, run: async (userId, { database, context: { actor } }) => resetAdminUserPassword(database, { actor, shop: { id: env().SHOP_ID } }, userId) });
    return success(result);
  } catch (error) { return failure(error, request); }
}
