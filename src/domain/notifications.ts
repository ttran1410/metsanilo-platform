import { randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray, isNotNull, isNull, like, notInArray, or, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, notifications } from "@/db/schema";
import { DomainError } from "./errors";
import { env } from "@/lib/env";

export type NotificationStateFilter = "ALL" | "UNREAD" | "READ";
export type NotificationSeverity = "HIGH" | "STANDARD" | "INFO";
export type NotificationFilters = {
  state?: NotificationStateFilter;
  category?: string;
  severity?: NotificationSeverity;
  query?: string;
};

const HIGH_CATEGORIES = ["NEW_ORDER_OVERDUE", "READY_REVIEW"];
const STANDARD_CATEGORIES = ["NEW_ORDER"];

export function getNotificationSeverity(category: string): NotificationSeverity {
  if (HIGH_CATEGORIES.includes(category)) return "HIGH";
  if (STANDARD_CATEGORIES.includes(category)) return "STANDARD";
  return "INFO";
}

export function getNotificationDeepLink(notification: { category: string; orderId: string | null }) {
  if (notification.orderId) return `/admin/orders/${notification.orderId}`;
  if (notification.category.includes("AVAILABILITY") || notification.category.includes("CAPACITY")) return "/admin/availability";
  if (notification.category.includes("REVIEW")) return "/admin/reviews";
  return null;
}

function notificationConditions(filters: NotificationFilters = {}) {
  const conditions: SQL[] = [eq(notifications.shopId, env().SHOP_ID)];
  if (filters.state === "UNREAD") conditions.push(isNull(notifications.readAt));
  if (filters.state === "READ") conditions.push(isNotNull(notifications.readAt));
  if (filters.category && filters.category !== "ALL") conditions.push(eq(notifications.category, filters.category));
  if (filters.severity === "HIGH") conditions.push(inArray(notifications.category, HIGH_CATEGORIES));
  if (filters.severity === "STANDARD") conditions.push(inArray(notifications.category, STANDARD_CATEGORIES));
  if (filters.severity === "INFO") conditions.push(notInArray(notifications.category, [...HIGH_CATEGORIES, ...STANDARD_CATEGORIES]));
  const query = filters.query?.trim();
  if (query) {
    const pattern = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    conditions.push(or(like(notifications.title, pattern), like(notifications.body, pattern))!);
  }
  return conditions;
}

export async function listNotifications(
  database: Database,
  input: NotificationFilters & { page?: number; pageSize?: number } = {},
) {
  const page = Math.max(1, Number.isFinite(input.page) ? Math.floor(input.page!) : 1);
  const pageSize = Math.max(1, Math.min(50, Number.isFinite(input.pageSize) ? Math.floor(input.pageSize!) : 20));
  const conditions = notificationConditions(input);
  const shopId = env().SHOP_ID;
  const [rows, totalRows, unreadRows, matchingUnreadRows, categoryRows] = await Promise.all([
    database
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(isNull(notifications.readAt)), desc(notifications.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    database.select({ count: count() }).from(notifications).where(and(...conditions)),
    database.select({ count: count() }).from(notifications).where(and(eq(notifications.shopId, shopId), isNull(notifications.readAt))),
    database.select({ count: count() }).from(notifications).where(and(...notificationConditions({ ...input, state: "UNREAD" }))),
    database.selectDistinct({ category: notifications.category }).from(notifications).where(eq(notifications.shopId, shopId)).orderBy(notifications.category),
  ]);
  return {
    items: rows.map((row) => ({
      ...row,
      severity: getNotificationSeverity(row.category),
      deepLink: getNotificationDeepLink(row),
    })),
    page,
    pageSize,
    total: Number(totalRows[0]?.count ?? 0),
    unreadCount: Number(unreadRows[0]?.count ?? 0),
    matchingUnreadCount: Number(matchingUnreadRows[0]?.count ?? 0),
    categories: categoryRows.map((row) => row.category),
  };
}

export async function markNotificationReadState(database: Database, id: string, read: boolean, actor: string) {
  const shopId = env().SHOP_ID;
  const current = await database.query.notifications.findFirst({
    where: and(eq(notifications.id, id), eq(notifications.shopId, shopId)),
  });
  if (!current) throw new DomainError("NOT_FOUND", "Notification not found", 404);
  const readAt = read ? new Date().toISOString() : null;
  const [updated] = await database
    .update(notifications)
    .set({ readAt })
    .where(and(eq(notifications.id, id), eq(notifications.shopId, shopId)))
    .returning();
  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId,
    actor,
    action: read ? "notification.marked_read" : "notification.marked_unread",
    entityType: "notification",
    entityId: id,
    detailsJson: JSON.stringify({ before: { readAt: current.readAt }, after: { readAt } }),
    createdAt: new Date().toISOString(),
  });
  return { ...updated, severity: getNotificationSeverity(updated.category), deepLink: getNotificationDeepLink(updated) };
}

export async function markFilteredNotificationsRead(database: Database, filters: NotificationFilters, actor: string) {
  const shopId = env().SHOP_ID;
  const rows = await database
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(...notificationConditions(filters), isNull(notifications.readAt)));
  if (!rows.length) return { count: 0 };
  const ids = rows.map((row) => row.id);
  const readAt = new Date().toISOString();
  await database.transaction(async (tx) => {
    await tx
      .update(notifications)
      .set({ readAt })
      .where(and(eq(notifications.shopId, shopId), inArray(notifications.id, ids)));
    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId,
      actor,
      action: "notification.filtered_set_marked_read",
      entityType: "notification",
      entityId: "filtered-set",
      detailsJson: JSON.stringify({ count: ids.length, filters }),
      createdAt: readAt,
    });
  });
  return { count: ids.length };
}
