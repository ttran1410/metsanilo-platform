import { listManagerOrdersWithPaymentSummary } from "@/domain/orders";
import { failure, success } from "../../response";
import { adminQueryParam, hasListQuery, parseAdminListQuery } from "@/lib/admin-list-query";
import { searchManagerOrders } from "@/domain/admin-search";
import { executeAdmin } from "../module";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const result = await executeAdmin(request, { permission: "orders.read", parse: async () => undefined, run: async (_input, { database }) => {
      if (hasListQuery(request)) return searchManagerOrders(database, parseAdminListQuery(request), {
        status: adminQueryParam(request, "status"), fulfillmentMethod: adminQueryParam(request, "fulfillmentMethod"), productId: adminQueryParam(request, "productId"), seasonId: adminQueryParam(request, "seasonId"),
        archived: adminQueryParam(request, "archived") === undefined ? undefined : adminQueryParam(request, "archived") === "true", from: adminQueryParam(request, "from"), to: adminQueryParam(request, "to"),
      });
      return listManagerOrdersWithPaymentSummary(database);
    } });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
