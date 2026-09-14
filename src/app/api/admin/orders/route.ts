import { adminQueryParam, hasListQuery, parseAdminListQuery } from "@/lib/admin-list-query";
import { getAdminOrders } from "@/domain/admin-order-actions";
import { executeAdminRoute } from "../module";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return executeAdminRoute(request, {
    permission: "orders.read",
    run: async (_input, { database, context }) => {
      const actionContext = { actor: context.actor, shop: { id: context.shop.shopId } };
      if (hasListQuery(request)) {
        return getAdminOrders(database, actionContext, {
          list: parseAdminListQuery(request),
          filters: {
            status: adminQueryParam(request, "status"),
            fulfillmentMethod: adminQueryParam(request, "fulfillmentMethod"),
            productId: adminQueryParam(request, "productId"),
            seasonId: adminQueryParam(request, "seasonId"),
            archived: adminQueryParam(request, "archived") === undefined ? undefined : adminQueryParam(request, "archived") === "true",
            historicalEntry: adminQueryParam(request, "historicalEntry") === undefined ? undefined : adminQueryParam(request, "historicalEntry") === "true",
            source: adminQueryParam(request, "source"),
            from: adminQueryParam(request, "from"),
            to: adminQueryParam(request, "to"),
            triage: adminQueryParam(request, "triage") === "true",
            unpaid: adminQueryParam(request, "unpaid") === "true",
          },
        });
      }
      return getAdminOrders(database, actionContext);
    },
  });
}

