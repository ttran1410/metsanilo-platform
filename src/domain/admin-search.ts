import { and, asc, count, desc, eq, gte, isNotNull, like, lte, or, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, orderPayments, orders, products, reviews, users, userPermissions } from "@/db/schema";
import { env } from "@/lib/env";
import type { AdminListQuery } from "@/lib/admin-list-query";
import { paged } from "@/lib/admin-list-query";
import { defaultPermissionsForRole, normalizePermission, type Permission } from "./access";
import { listManagerProducts } from "./products";

function contains(value: string) {
  return `%${value.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

export async function searchManagerReviews(database: Database, query: AdminListQuery, filters?: { status?: string; rating?: number; verification?: string; productId?: string; source?: string; featured?: boolean; hasReply?: boolean }) {
  const shopId = env().SHOP_ID;
  const filter = and(
    eq(reviews.shopId, shopId),
    filters?.status ? eq(reviews.status, filters.status as typeof reviews.status.enumValues[number]) : undefined,
    filters?.rating ? eq(reviews.rating, filters.rating) : undefined,
    filters?.verification ? eq(reviews.verificationType, filters.verification as typeof reviews.verificationType.enumValues[number]) : undefined,
    filters?.productId ? eq(reviews.productId, filters.productId) : undefined,
    filters?.source ? eq(reviews.source, filters.source as typeof reviews.source.enumValues[number]) : undefined,
    filters?.featured === undefined ? undefined : eq(reviews.featured, filters.featured),
    filters?.hasReply === true ? isNotNull(reviews.sellerReplyText) : undefined,
    query.q
      ? or(
          like(reviews.displayName, contains(query.q)),
          like(reviews.originalText, contains(query.q)),
          like(reviews.displayText, contains(query.q)),
          like(reviews.orderId, contains(query.q)),
          like(reviews.productId, contains(query.q)),
        )
      : undefined,
  );
  const [{ total }] = await database.select({ total: count() }).from(reviews).where(filter);
  const items = await database.select().from(reviews).where(filter).orderBy(desc(reviews.createdAt)).limit(query.pageSize).offset(query.offset);
  return paged(items, total, query);
}

export async function searchUsers(database: Database, query: AdminListQuery, filters?: { role?: string; active?: boolean }) {
  const shopId = env().SHOP_ID;
  const filter = and(
    eq(users.shopId, shopId),
    filters?.role ? eq(users.role, filters.role as typeof users.role.enumValues[number]) : undefined,
    filters?.active === undefined ? undefined : eq(users.active, filters.active),
    query.q ? or(like(users.displayName, contains(query.q)), like(users.email, contains(query.q)), like(users.username, contains(query.q))) : undefined,
  );
  const [{ total }] = await database.select({ total: count() }).from(users).where(filter);
  const rows = await database.select().from(users).where(filter).orderBy(asc(users.displayName)).limit(query.pageSize).offset(query.offset);
  const ids = rows.map((row) => row.id);
  const grants = ids.length ? await database.select().from(userPermissions).where(and(eq(userPermissions.shopId, shopId), inArray(userPermissions.userId, ids))) : [];
  const items = rows.map((user) => {
    const defaults = defaultPermissionsForRole(user.role);
    const userGrants = grants.filter((grant) => grant.userId === user.id);
    const revoked = new Set(userGrants.filter((grant) => !grant.granted).map((grant) => normalizePermission(grant.permission)).filter((permission): permission is Permission => Boolean(permission)));
    const added = userGrants.filter((grant) => grant.granted).map((grant) => normalizePermission(grant.permission)).filter((permission): permission is Permission => Boolean(permission));
    const permissions = [...new Set([...defaults.filter((permission) => !revoked.has(permission)), ...added])];
    return { ...user, permissions, customOverrides: { granted: added.filter((permission) => !defaults.includes(permission)), revoked: [...revoked] } };
  });
  return paged(items, total, query);
}

export async function searchManagerOrders(database: Database, query: AdminListQuery, filters?: { status?: string; fulfillmentMethod?: string; productId?: string; seasonId?: string; archived?: boolean; from?: string; to?: string }) {
  const shopId = env().SHOP_ID;
  const filter = and(
    eq(orders.shopId, shopId),
    filters?.status ? eq(orders.status, filters.status as typeof orders.status.enumValues[number]) : undefined,
    filters?.fulfillmentMethod ? eq(orders.fulfillmentMethod, filters.fulfillmentMethod as typeof orders.fulfillmentMethod.enumValues[number]) : undefined,
    filters?.productId ? eq(orders.productId, filters.productId) : undefined,
    filters?.seasonId ? eq(orders.seasonId, filters.seasonId) : undefined,
    filters?.archived === undefined ? undefined : eq(orders.archived, filters.archived),
    filters?.from ? gte(orders.fulfillmentDate, filters.from) : undefined,
    filters?.to ? lte(orders.fulfillmentDate, filters.to) : undefined,
    query.q
      ? or(
          like(orders.publicReference, contains(query.q)),
          like(orders.customerName, contains(query.q)),
          like(orders.mobile, contains(query.q)),
          like(orders.email, contains(query.q)),
        )
      : undefined,
  );
  const [{ total }] = await database.select({ total: count() }).from(orders).where(filter);
  const rows = await database.select().from(orders).where(filter).orderBy(desc(orders.createdAt)).limit(query.pageSize).offset(query.offset);
  const ids = rows.map((row) => row.id);
  const payments = ids.length ? await database.select().from(orderPayments).where(and(eq(orderPayments.shopId, shopId), inArray(orderPayments.orderId, ids))) : [];
  const paid = new Map<string, number>();
  for (const payment of payments) if (payment.kind === "PAYMENT") paid.set(payment.orderId, (paid.get(payment.orderId) ?? 0) + payment.amountCents);
  const items = rows.map((order) => {
    const paidCents = paid.get(order.id) ?? 0;
    const outstandingCents = order.finalTotalCents === null ? null : Math.max(0, order.finalTotalCents - paidCents);
    return { ...order, paidCents, outstandingCents, paymentStatus: outstandingCents === null ? "PENDING_FEE" : outstandingCents > 0 ? "UNPAID" : "PAID" };
  });
  return paged(items, total, query);
}

export async function searchManagerProducts(database: Database, query: AdminListQuery) {
  const shopId = env().SHOP_ID;
  const filter = and(
    eq(products.shopId, shopId),
    query.q ? or(like(products.nameFi, contains(query.q)), like(products.nameEn, contains(query.q)), like(products.code, contains(query.q)), like(products.slug, contains(query.q))) : undefined,
  );
  const [{ total }] = await database.select({ total: count() }).from(products).where(filter);
  const rows = await database.select({ id: products.id }).from(products).where(filter).orderBy(asc(products.sortOrder), asc(products.nameFi)).limit(query.pageSize).offset(query.offset);
  const all = rows.length ? await listManagerProducts(database, rows.map((row) => row.id)) : [];
  const byId = new Map(all.map((item) => [item.product.id, item]));
  return paged(rows.map((row) => byId.get(row.id)).filter((item): item is NonNullable<typeof item> => Boolean(item)), total, query);
}

export async function searchAuditEntries(database: Database, query: AdminListQuery) {
  const shopId = env().SHOP_ID;
  const filter = and(eq(auditEntries.shopId, shopId), query.q ? or(like(auditEntries.actor, contains(query.q)), like(auditEntries.action, contains(query.q)), like(auditEntries.entityType, contains(query.q)), like(auditEntries.entityId, contains(query.q)), like(auditEntries.detailsJson, contains(query.q))) : undefined);
  const [{ total }] = await database.select({ total: count() }).from(auditEntries).where(filter);
  const items = await database.select().from(auditEntries).where(filter).orderBy(desc(auditEntries.createdAt)).limit(query.pageSize).offset(query.offset);
  return paged(items, total, query);
}
