import type { Database } from "@/db/client";
import { hasUserPermission } from "./access";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";
import { createExternalOrder, createHistoricalOrder } from "./operations";

export async function createAdminHistoricalOrder(database: Database, context: AdminActionContext, input: Parameters<typeof createHistoricalOrder>[1]) {
  assertAdminActionContext(context);
  return createHistoricalOrder(database, input);
}

export async function createAdminExternalOrder(database: Database, context: AdminActionContext, input: Parameters<typeof createExternalOrder>[1]) {
  assertAdminActionContext(context);
  const allowDateOverride = await hasUserPermission(database, context.actor, "orders.override_closed_date");
  return createExternalOrder(database, { ...input, allowDateOverride });
}
