import { db } from "@/db/client";
import { authenticateAdmin } from "../../../module";
import { resetAdminUserPassword } from "@/domain/admin-user-actions";
import { env } from "@/lib/env";
import { failure, success } from "../../../../response";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = (await authenticateAdmin(request, "shop_users.password_reset")).actor;
    const { id } = await context.params;
    return success(await resetAdminUserPassword(db(), { actor, shop: { id: env().SHOP_ID } }, id));
  } catch (error) { return failure(error); }
}
