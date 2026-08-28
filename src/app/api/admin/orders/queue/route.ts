import { getOrderQueue } from "@/domain/orders";
import { failure, success } from "../../../response";
import { executeAdmin } from "../../module";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const result = await executeAdmin(request, { permission: "orders.read", parse: async () => new URL(request.url).searchParams, run: async (params, { database }) => getOrderQueue(database, { productId: params.get("productId") ?? undefined, seasonId: params.get("seasonId") ?? undefined, from: params.get("from") ?? undefined, to: params.get("to") ?? undefined }) });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
