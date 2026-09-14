import { hasUserPermission } from "@/domain/access";
import { getAdminNavigationSummary } from "@/domain/admin-navigation-actions";
import { executeAdminRoute } from "../module";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return executeAdminRoute(request, {
    permission: "dashboard.read",
    parse: async () => undefined,
    run: async (_input, { database, context }) => {
      const notifications = await hasUserPermission(database, context.actor, "notifications.read");
      return getAdminNavigationSummary(database, { actor: context.actor, shop: { id: context.shop.shopId } }, { dashboard: true, notifications });
    },
  });
}

