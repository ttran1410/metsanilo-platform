import type { Database } from "@/db/client";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";
import { listNotifications, markFilteredNotificationsRead, markNotificationReadState, type NotificationFilters } from "./notifications";

export type AdminNotificationQuery = NotificationFilters & { page?: number; pageSize?: number; recent?: boolean };

export async function getAdminNotifications(database: Database, context: AdminActionContext, input: AdminNotificationQuery) {
  assertAdminActionContext(context);
  const data = await listNotifications(database, input);
  return input.recent ? data.items : data;
}

export async function markAdminNotificationReadState(database: Database, context: AdminActionContext, id: string, read: boolean) { assertAdminActionContext(context); return markNotificationReadState(database, id, read, context.actor.email ?? context.actor.id); }
export async function markAdminFilteredNotificationsRead(database: Database, context: AdminActionContext, filters: NotificationFilters) { assertAdminActionContext(context); return markFilteredNotificationsRead(database, filters, context.actor.email ?? context.actor.id); }
