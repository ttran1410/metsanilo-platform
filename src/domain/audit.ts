import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, users } from "@/db/schema";
import { env } from "@/lib/env";

export type AuditSeverity = "HIGH" | "MEDIUM" | "STANDARD";
export type AuditCategory = "ORDERS" | "USERS" | "CUSTOMERS" | "AVAILABILITY" | "SYSTEM";

export interface AuditDiff {
  summary: string;
  reason?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  changes?: Array<{ field: string; oldVal: any; newVal: any }>;
  rawPayload?: Record<string, any>;
}

export interface FormattedAuditItem {
  id: string;
  actor: string;
  actorDisplayName?: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  detailsJson: string;
  createdAt: string;
  severity: AuditSeverity;
  category: AuditCategory;
  diff: AuditDiff;
}

export function getAuditSeverity(action: string): AuditSeverity {
  const act = action.toLowerCase();
  if (
    act.includes("grant_perm") ||
    act.includes("assign_perm") ||
    act.includes("change_role") ||
    act.includes("password_reset") ||
    act.includes("anonymize") ||
    act.includes("orders.export") ||
    act.includes("settings.update") ||
    act.includes("delete")
  ) {
    return "HIGH";
  }

  if (
    act.includes("price_override") ||
    act.includes("refund") ||
    act.includes("sold_out") ||
    act.includes("delivery_fee") ||
    act.includes("visibility") ||
    act.includes("rejection") ||
    act.includes("archive")
  ) {
    return "MEDIUM";
  }

  return "STANDARD";
}

export function getAuditCategory(entityType: string): AuditCategory {
  const type = entityType.toLowerCase();
  if (type === "order") return "ORDERS";
  if (type === "user" || type === "permission" || type === "role") return "USERS";
  if (type === "customer") return "CUSTOMERS";
  if (type === "product" || type === "availability" || type === "package") return "AVAILABILITY";
  return "SYSTEM";
}

export function parseAuditDiff(detailsJson: string): AuditDiff {
  try {
    const parsed = JSON.parse(detailsJson);
    const result: AuditDiff = {
      summary: parsed.summary ?? parsed.message ?? parsed.action ?? "System action recorded",
      reason: parsed.reason ?? parsed.moderationReason ?? parsed.notes ?? undefined,
      rawPayload: parsed,
    };

    if (parsed.before || parsed.after) {
      result.before = parsed.before;
      result.after = parsed.after;
      const keys = new Set([...Object.keys(parsed.before ?? {}), ...Object.keys(parsed.after ?? {})]);
      const changes: Array<{ field: string; oldVal: any; newVal: any }> = [];

      for (const key of keys) {
        const oldV = parsed.before?.[key];
        const newV = parsed.after?.[key];
        if (JSON.stringify(oldV) !== JSON.stringify(newV)) {
          changes.push({ field: key, oldVal: oldV, newVal: newV });
        }
      }
      result.changes = changes;
    } else {
      // Look for standard before/after patterns in flat payloads
      const changes: Array<{ field: string; oldVal: any; newVal: any }> = [];
      for (const [key, val] of Object.entries(parsed)) {
        if (key === "summary" || key === "reason") continue;
        if (key.endsWith("Before") || key.endsWith("Old")) {
          const baseKey = key.replace(/(Before|Old)$/, "");
          const afterKey = `${baseKey}After` in parsed ? `${baseKey}After` : `${baseKey}New`;
          if (afterKey in parsed) {
            changes.push({ field: baseKey, oldVal: val, newVal: parsed[afterKey] });
          }
        }
      }
      if (changes.length > 0) {
        result.changes = changes;
      }
    }

    return result;
  } catch {
    return {
      summary: detailsJson || "Action logged",
      rawPayload: { raw: detailsJson },
    };
  }
}

export async function getAuditMetrics(database: Database) {
  const shopId = env().SHOP_ID;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const entries = await database
    .select()
    .from(auditEntries)
    .where(and(eq(auditEntries.shopId, shopId), gte(auditEntries.createdAt, sevenDaysAgo)));

  let highRisk = 0;
  let sensitiveEdits = 0;
  let opsActions = 0;
  let failedLogins = 0;

  for (const entry of entries) {
    const sev = getAuditSeverity(entry.action);
    if (sev === "HIGH") highRisk++;
    else if (sev === "MEDIUM") sensitiveEdits++;
    else opsActions++;

    if (entry.action.toLowerCase().includes("failed_login") || entry.action.toLowerCase().includes("auth_fail")) {
      failedLogins++;
    }
  }

  return {
    highRisk,
    sensitiveEdits,
    opsActions,
    failedLogins,
    total7Days: entries.length,
  };
}

export async function listAuditEntries(
  database: Database,
  filters?: {
    page?: number;
    limit?: number;
    search?: string;
    severity?: AuditSeverity | "ALL";
    category?: AuditCategory | "ALL";
    actor?: string;
    dateRange?: "24h" | "7d" | "30d" | "all";
  }
) {
  const shopId = env().SHOP_ID;
  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 15;
  const offset = (page - 1) * limit;

  let query = database
    .select()
    .from(auditEntries)
    .where(eq(auditEntries.shopId, shopId))
    .orderBy(desc(auditEntries.createdAt));

  const allEntries = await query;

  // Load user directory for actor display names
  const allUsers = await database.select().from(users).where(eq(users.shopId, shopId));
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  // Date filtering threshold
  let dateThreshold = "";
  const now = Date.now();
  if (filters?.dateRange === "24h") dateThreshold = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  else if (filters?.dateRange === "7d") dateThreshold = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  else if (filters?.dateRange === "30d") dateThreshold = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  // In-memory filter
  const filtered = allEntries.filter((entry) => {
    if (dateThreshold && entry.createdAt < dateThreshold) return false;

    const severity = getAuditSeverity(entry.action);
    if (filters?.severity && filters.severity !== "ALL" && severity !== filters.severity) {
      return false;
    }

    const category = getAuditCategory(entry.entityType);
    if (filters?.category && filters.category !== "ALL" && category !== filters.category) {
      return false;
    }

    if (filters?.actor && filters.actor !== "ALL" && entry.actor !== filters.actor) {
      return false;
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      const text = `${entry.actor} ${entry.action} ${entry.entityType} ${entry.entityId} ${entry.detailsJson}`.toLowerCase();
      if (!text.includes(q)) return false;
    }

    return true;
  });

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  const formatted: FormattedAuditItem[] = paginated.map((entry) => {
    const matchedUser = userMap.get(entry.actor);
    return {
      ...entry,
      actorDisplayName: matchedUser?.displayName ?? entry.actor,
      actorEmail: matchedUser?.email ?? undefined,
      severity: getAuditSeverity(entry.action),
      category: getAuditCategory(entry.entityType),
      diff: parseAuditDiff(entry.detailsJson),
    };
  });

  return {
    items: formatted,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    actors: Array.from(new Set(allEntries.map((e) => e.actor))),
  };
}
