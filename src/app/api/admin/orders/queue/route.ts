import { getAdminOrderQueue } from "@/domain/admin-order-actions";
import { executeAdminRoute } from "../../module";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return executeAdminRoute(request, {
    permission: "orders.read",
    parse: async () => new URL(request.url).searchParams,
    run: async (params, { database, context }) =>
      getAdminOrderQueue(
        database,
        { actor: context.actor, shop: { id: context.shop.shopId } },
        {
          productId: params.get("productId") ?? undefined,
          seasonId: params.get("seasonId") ?? undefined,
          from: params.get("from") ?? undefined,
          to: params.get("to") ?? undefined,
        },
      ),
  });
}

