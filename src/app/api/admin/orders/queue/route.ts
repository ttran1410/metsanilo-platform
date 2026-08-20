import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { getOrderQueue } from "@/domain/orders";
import { failure, success } from "../../../response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requirePermission(db(), request, "orders.read");
    const url = new URL(request.url);
    return success(await getOrderQueue(db(), {
      productId: url.searchParams.get("productId") ?? undefined,
      seasonId: url.searchParams.get("seasonId") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    }));
  } catch (error) {
    return failure(error);
  }
}
