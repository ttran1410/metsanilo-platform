import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { listManagerOrdersWithPaymentSummary } from "@/domain/orders";
import { failure, success } from "../../response";
import { adminQueryParam, hasListQuery, parseAdminListQuery } from "@/lib/admin-list-query";
import { searchManagerOrders } from "@/domain/admin-search";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requirePermission(db(), request, "orders.read");
    if (hasListQuery(request)) return success(await searchManagerOrders(db(), parseAdminListQuery(request), {
      status: adminQueryParam(request, "status"),
      fulfillmentMethod: adminQueryParam(request, "fulfillmentMethod"),
      productId: adminQueryParam(request, "productId"),
      seasonId: adminQueryParam(request, "seasonId"),
      archived: adminQueryParam(request, "archived") === undefined ? undefined : adminQueryParam(request, "archived") === "true",
      from: adminQueryParam(request, "from"),
      to: adminQueryParam(request, "to"),
    }));
    return success(await listManagerOrdersWithPaymentSummary(db()));
  } catch (error) {
    return failure(error);
  }
}
