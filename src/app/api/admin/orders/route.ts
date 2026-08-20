import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { listManagerOrdersWithPaymentSummary } from "@/domain/orders";
import { failure, success } from "../../response";
import { hasListQuery, parseAdminListQuery } from "@/lib/admin-list-query";
import { searchManagerOrders } from "@/domain/admin-search";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requirePermission(db(), request, "orders.read");
    if (hasListQuery(request)) return success(await searchManagerOrders(db(), parseAdminListQuery(request)));
    return success(await listManagerOrdersWithPaymentSummary(db()));
  } catch (error) {
    return failure(error);
  }
}
