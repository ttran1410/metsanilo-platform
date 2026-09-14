import { runAdminAutomation } from "@/domain/admin-automation-actions";
import { executeAdminRoute } from "../../module";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return executeAdminRoute(request, {
    permission: "orders.transition",
    parse: async () => undefined,
    run: async (_input, { database, context }) => runAdminAutomation(database, { actor: context.actor, shop: { id: context.shop.shopId } }),
  });
}

