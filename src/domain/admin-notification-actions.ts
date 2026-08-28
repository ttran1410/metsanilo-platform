import type { Database } from "@/db/client";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";
import { markFilteredNotificationsRead, markNotificationReadState, type NotificationFilters } from "./notifications";

export async function markAdminNotificationReadState(database: Database, context: AdminActionContext, id: string, read: boolean) { assertAdminActionContext(context); return markNotificationReadState(database, id, read, context.actor.email ?? context.actor.id); }
export async function markAdminFilteredNotificationsRead(database: Database, context: AdminActionContext, filters: NotificationFilters) { assertAdminActionContext(context); return markFilteredNotificationsRead(database, filters, context.actor.email ?? context.actor.id); }
