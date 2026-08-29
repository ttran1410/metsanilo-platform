import { runAdminAutomation } from "@/domain/admin-automation-actions";
import { failure, success } from "../../../response";
import { executeAdmin } from "../../module";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await executeAdmin(request, {
      permission: "orders.transition",
      parse: async () => undefined,
      run: async (_input, { database, context }) => runAdminAutomation(database, { actor: context.actor, shop: { id: context.shop.shopId } }),
    });
    return success(result);
  } catch (error) {
    return failure(error, request);
  }
}
