import { failure, success } from "../../response";
import { adminQueryParam, hasListQuery, parseAdminListQuery } from "@/lib/admin-list-query";
import { getAdminOrders } from "@/domain/admin-order-actions";
import { env } from "@/lib/env";
import { executeAdmin } from "../module";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const result = await executeAdmin(request, { permission: "orders.read", parse: async () => undefined, run: async (_input, { database, context }) => {
      const actionContext = { actor: context.actor, shop: { id: env().SHOP_ID } };
      if (hasListQuery(request)) return getAdminOrders(database, actionContext, { list: parseAdminListQuery(request), includeCounts: adminQueryParam(request, "includeCounts") === "true", filters: {
        status: adminQueryParam(request, "status"), fulfillmentMethod: adminQueryParam(request, "fulfillmentMethod"), productId: adminQueryParam(request, "productId"), seasonId: adminQueryParam(request, "seasonId"),
        archived: adminQueryParam(request, "archived") === undefined ? undefined : adminQueryParam(request, "archived") === "true", historicalEntry: adminQueryParam(request, "historicalEntry") === undefined ? undefined : adminQueryParam(request, "historicalEntry") === "true", source: adminQueryParam(request, "source"), from: adminQueryParam(request, "from"), to: adminQueryParam(request, "to"), triage: adminQueryParam(request, "triage") === "true", unpaid: adminQueryParam(request, "unpaid") === "true",
      } });
      return getAdminOrders(database, actionContext);
    } });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
