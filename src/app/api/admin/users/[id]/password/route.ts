import { executeAdminRoute } from "../../../module";
import { resetAdminUserPassword } from "@/domain/admin-user-actions";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "shop_users.password_reset",
    parse: async () => (await context.params).id,
    run: async (userId, { database, context: { actor, shop } }) =>
      resetAdminUserPassword(database, { actor, shop: { id: shop.shopId } }, userId),
  });
}

