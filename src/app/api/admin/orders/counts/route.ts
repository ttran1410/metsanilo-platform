import { getAdminOrderQuickViewCounts } from "@/domain/admin-order-actions";
import { executeAdminRoute } from "../../module";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return executeAdminRoute(request, {
    permission: "orders.read",
    run: async (_input, { database, context }) =>
      getAdminOrderQuickViewCounts(database, { actor: context.actor, shop: { id: context.shop.shopId } }),
  });
}

