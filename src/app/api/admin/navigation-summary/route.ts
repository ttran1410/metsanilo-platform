import { currentUser, hasUserPermission } from "@/domain/access";
import { getAdminNavigationSummary } from "@/domain/admin-navigation-actions";
import { db } from "@/db/client";
import { env } from "@/lib/env";
import { failure, success } from "../../response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const database = db();
    const actor = await currentUser(database, request);
    const [dashboard, notifications] = await Promise.all([
      hasUserPermission(database, actor, "dashboard.read"),
      hasUserPermission(database, actor, "notifications.read"),
    ]);
    return success(await getAdminNavigationSummary(database, { actor, shop: { id: env().SHOP_ID } }, { dashboard, notifications }));
  } catch (error) {
    return failure(error, request);
  }
}
