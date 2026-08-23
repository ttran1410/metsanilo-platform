import { and, desc, eq, gte } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, customers, orders, products, users } from "@/db/schema";
import { env } from "@/lib/env";

export type AuditSeverity = "HIGH" | "MEDIUM" | "STANDARD";
export type AuditCategory = "ORDERS" | "USERS" | "CUSTOMERS" | "AVAILABILITY" | "SYSTEM";

export interface AuditDiff {
  summary: string;
  reason?: string;
  correlationId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changes?: Array<{ field: string; oldVal: unknown; newVal: unknown }>;
  rawPayload?: Record<string, unknown>;
}

export interface FormattedAuditItem {
  id: string;
  actor: string;
  actorDisplayName?: string;
  actorEmail?: string;
  actorInfo: { name: string; subtitle?: string; type: "SYSTEM" | "PUBLIC" | "STAFF" };
  action: string;
  actionTitle: string;
  actionIcon: string;
  entityType: string;
  entityId: string;
  targetInfo: { label: string; href?: string };
  detailsJson: string;
  createdAt: string;
  severity: AuditSeverity;
  category: AuditCategory;
  diff: AuditDiff;
  correlationId?: string;
}

export function formatAuditActionTitle(action: string): { title: string; icon: string } {
  const act = action.toLowerCase();
  if (act === "order.payment_recorded" || act.includes("payment")) return { title: "Payment recorded", icon: "CreditCard" };
  if (act === "order.status_transition" || act.includes("status")) return { title: "Status changed", icon: "RefreshCw" };
  if (act === "order.price_adjusted" || act.includes("price")) return { title: "Price adjusted", icon: "Tag" };
  if (act === "order.refund_recorded" || act.includes("refund")) return { title: "Refund processed", icon: "ReceiptRefund" };
  if (act.includes("created")) return { title: "Record created", icon: "PlusCircle" };
  if (act.includes("permission_granted") || act.includes("grant")) return { title: "Permission granted", icon: "KeyRound" };
  if (act.includes("permission_revoked") || act.includes("revoke")) return { title: "Permission revoked", icon: "Lock" };
  if (act.includes("role")) return { title: "Role updated", icon: "UserCheck" };
  if (act.includes("merged")) return { title: "Profiles merged", icon: "GitMerge" };
  if (act.includes("availability")) return { title: "Availability updated", icon: "Calendar" };
  if (act.includes("note")) return { title: "Note added", icon: "FileText" };
  if (act.includes("updated")) return { title: "Record updated", icon: "Pencil" };
  if (act.includes("delete")) return { title: "Record deleted", icon: "Trash2" };
  return { title: action.replaceAll(".", " ").replaceAll("_", " "), icon: "Activity" };
}

export function formatAuditActor(
  actor: string,
  matchedUser?: { displayName: string; email?: string | null; role: string }
) {
  const norm = actor.toLowerCase().trim();
  if (norm === "system" || norm === "webhook" || norm.includes("cron")) {
    return { name: "System / Webhook", type: "SYSTEM" as const };
  }
  if (norm === "public" || norm === "guest" || norm === "customer") {
    return { name: "Online Customer", type: "PUBLIC" as const };
  }
  if (matchedUser) {
    return {
      name: matchedUser.displayName,
      subtitle: matchedUser.email ?? matchedUser.role,
      type: "STAFF" as const,
    };
  }
  if (actor.includes("@")) {
    return { name: actor.split("@")[0], subtitle: actor, type: "STAFF" as const };
  }
  return { name: actor, type: "STAFF" as const };
}

export function resolveAuditTargetLabel(
  entityType: string,
  entityId: string,
  detailsJson: string,
  orderMap?: Map<string, string>,
  customerMap?: Map<string, { name: string; email?: string | null }>,
  productMap?: Map<string, string>,
  userMap?: Map<string, { displayName: string }>
): { label: string; href?: string } {
  const type = entityType.toLowerCase();
  try {
    const details = JSON.parse(detailsJson);
    if (type === "order") {
      const ref = details.publicReference ?? details.orderRef ?? orderMap?.get(entityId);
      if (ref) return { label: `Order #${ref}`, href: `/admin/orders/${entityId}` };
      return { label: `Order #${entityId.slice(0, 8)}`, href: `/admin/orders/${entityId}` };
    }
    if (type === "customer") {
      const cust = customerMap?.get(entityId);
      const name = details.customerName ?? cust?.name;
      if (name) return { label: `Customer: ${name}`, href: `/admin/customers` };
      return { label: `Customer #${entityId.slice(0, 8)}`, href: `/admin/customers` };
    }
    if (type === "product") {
      const prodName = details.productName ?? productMap?.get(entityId);
      if (prodName) return { label: `Product: ${prodName}`, href: `/admin/products` };
      return { label: `Product #${entityId.slice(0, 8)}`, href: `/admin/products` };
    }
    if (type === "user") {
      const u = userMap?.get(entityId);
      const name = details.displayName ?? u?.displayName;
      if (name) return { label: `User: ${name}`, href: `/admin/users` };
      return { label: `User #${entityId.slice(0, 8)}`, href: `/admin/users` };
    }
  } catch {
    /* fallback */
  }
  return { label: `${entityType}: ${entityId.slice(0, 8)}` };
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
    const correlationId = parsed.correlationId ?? parsed.traceId ?? parsed.requestId ?? undefined;
    const result: AuditDiff = {
      summary: parsed.summary ?? parsed.message ?? parsed.action ?? "System action recorded",
      reason: parsed.reason ?? parsed.moderationReason ?? parsed.notes ?? undefined,
      correlationId,
      rawPayload: parsed,
    };

    if (parsed.before || parsed.after) {
      result.before = parsed.before;
      result.after = parsed.after;
      const keys = new Set([...Object.keys(parsed.before ?? {}), ...Object.keys(parsed.after ?? {})]);
      const changes: Array<{ field: string; oldVal: unknown; newVal: unknown }> = [];

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
      const changes: Array<{ field: string; oldVal: unknown; newVal: unknown }> = [];
      for (const [key, val] of Object.entries(parsed)) {
        if (key === "summary" || key === "reason" || key === "correlationId" || key === "traceId") continue;
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

  const query = database
    .select()
    .from(auditEntries)
    .where(eq(auditEntries.shopId, shopId))
    .orderBy(desc(auditEntries.createdAt));

  const allEntries = await query;

  // Load entity lookup directories for human-friendly target titles
  const [allUsers, allOrders, allCustomers, allProducts] = await Promise.all([
    database.select().from(users).where(eq(users.shopId, shopId)),
    database.select({ id: orders.id, publicReference: orders.publicReference }).from(orders).where(eq(orders.shopId, shopId)),
    database.select({ id: customers.id, name: customers.name, email: customers.email }).from(customers).where(eq(customers.shopId, shopId)),
    database.select({ id: products.id, nameFi: products.nameFi }).from(products).where(eq(products.shopId, shopId)),
  ]);

  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const orderMap = new Map(allOrders.map((o) => [o.id, o.publicReference]));
  const customerMap = new Map(allCustomers.map((c) => [c.id, c]));
  const productMap = new Map(allProducts.map((p) => [p.id, p.nameFi]));

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
    const actionMeta = formatAuditActionTitle(entry.action);
    const actorInfo = formatAuditActor(entry.actor, matchedUser);
    const targetInfo = resolveAuditTargetLabel(
      entry.entityType,
      entry.entityId,
      entry.detailsJson,
      orderMap,
      customerMap,
      productMap,
      userMap
    );
    const diff = parseAuditDiff(entry.detailsJson);

    return {
      ...entry,
      actorDisplayName: matchedUser?.displayName ?? entry.actor,
      actorEmail: matchedUser?.email ?? undefined,
      actorInfo,
      actionTitle: actionMeta.title,
      actionIcon: actionMeta.icon,
      targetInfo,
      severity: getAuditSeverity(entry.action),
      category: getAuditCategory(entry.entityType),
      diff,
      correlationId: diff.correlationId,
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
