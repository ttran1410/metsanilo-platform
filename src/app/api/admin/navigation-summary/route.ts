import { hasUserPermission } from "@/domain/access";
import { getAdminNavigationSummary } from "@/domain/admin-navigation-actions";
import { env } from "@/lib/env";
import { failure, success } from "../../response";
import { executeAdmin } from "../module";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const result = await executeAdmin(request, {
      permission: "dashboard.read",
      parse: async () => undefined,
      run: async (_input, { database, context }) => {
        const notifications = await hasUserPermission(database, context.actor, "notifications.read");
        return getAdminNavigationSummary(database, { actor: context.actor, shop: { id: env().SHOP_ID } }, { dashboard: true, notifications });
      },
    });
    return success(await result);
  } catch (error) {
    return failure(error, request);
  }
}
