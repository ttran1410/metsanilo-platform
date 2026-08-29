import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { notifications, orders, shops } from "@/db/schema";
import { todayInTimezone } from "@/lib/format";
import { getOrderTriageReasons } from "./order-triage";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";

export async function getAdminNavigationSummary(database: Database, context: AdminActionContext, permissions: { dashboard: boolean; notifications: boolean }) {
  assertAdminActionContext(context);
  const [shop] = await database.select({ timezone: shops.timezone }).from(shops).where(eq(shops.id, context.shop.id)).limit(1);
  const date = shop ? todayInTimezone(shop.timezone) : new Date().toISOString().slice(0, 10);
  const [orderRows, unreadRows] = await Promise.all([
    permissions.dashboard ? database.select().from(orders).where(and(eq(orders.shopId, context.shop.id), eq(orders.fulfillmentDate, date))) : Promise.resolve([]),
    permissions.notifications ? database.select({ count: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.shopId, context.shop.id), sql`${notifications.readAt} IS NULL`)) : Promise.resolve([{ count: 0 }]),
  ]);
  return {
    triageCount: permissions.dashboard ? orderRows.filter((order) => getOrderTriageReasons(order).length > 0).length : 0,
    unreadCount: permissions.notifications ? Number(unreadRows[0]?.count ?? 0) : 0,
  };
}
