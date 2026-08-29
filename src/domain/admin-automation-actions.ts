import type { Database } from "@/db/client";
import { runAutomation } from "./operations";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";

export async function runAdminAutomation(database: Database, context: AdminActionContext) {
  assertAdminActionContext(context);
  return runAutomation(database);
}
