import type { Database } from "@/db/client";
import { getAuditMetrics, listAuditEntries, type AuditCategory, type AuditSeverity } from "./audit";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";

export type AdminAuditQuery = {
  page: number;
  limit: number;
  search: string;
  severity: AuditSeverity | "ALL";
  category: AuditCategory | "ALL";
  actor: string;
  dateRange: "24h" | "7d" | "30d" | "all";
};

export async function getAdminAuditData(database: Database, context: AdminActionContext, query: AdminAuditQuery) {
  assertAdminActionContext(context);
  const [entries, metrics] = await Promise.all([listAuditEntries(database, query), getAuditMetrics(database)]);
  return { ...entries, metrics };
}
