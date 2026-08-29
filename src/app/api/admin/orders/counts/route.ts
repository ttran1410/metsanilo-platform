import { failure, success } from "../../../response";
import { getAdminOrderQuickViewCounts } from "@/domain/admin-order-actions";
import { env } from "@/lib/env";
import { executeAdmin } from "../../module";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const result = await executeAdmin(request, {
      permission: "orders.read",
      parse: async () => undefined,
      run: async (_input, { database, context }) => getAdminOrderQuickViewCounts(database, { actor: context.actor, shop: { id: env().SHOP_ID } }),
    });
    return success(result);
  } catch (error) {
    return failure(error, request);
  }
}
