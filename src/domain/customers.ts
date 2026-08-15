import { and, desc, eq, like, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, customers, orders } from "@/db/schema";
import { env } from "@/lib/env";
import { normalizeMobile } from "./order-input";

export async function searchCustomers(database: Database, query: string) {
  const value = query.trim();
  if (value.length < 2) return [];
  let normalizedMobile = value;
  try { normalizedMobile = normalizeMobile(value); } catch { /* Search may be a name or email. */ }
  return database.select().from(customers).where(and(eq(customers.shopId, env().SHOP_ID), or(like(customers.mobile, `%${normalizedMobile}%`), like(customers.mobile, `%${value}%`), like(customers.email, `%${value.toLowerCase()}%`), like(customers.name, `%${value}%`)))).limit(25);
}

export async function listCustomers(database: Database) {
  const rows = await database.select().from(customers).where(eq(customers.shopId, env().SHOP_ID)).orderBy(desc(customers.updatedAt)).limit(100);
  const customerOrders = await database.select({ customerId: orders.customerId, status: orders.status, volumeMl: orders.volumeMl, finalTotalCents: orders.finalTotalCents, fulfillmentDate: orders.fulfillmentDate }).from(orders).where(eq(orders.shopId, env().SHOP_ID));
  return rows.map((customer) => { const related = customerOrders.filter((order) => order.customerId === customer.id && !["CANCELLED", "REJECTED", "NO_SHOW", "CUSTOMER_DECLINED"].includes(order.status)); return { ...customer, metrics: { totalOrders: related.length, lifetimeLitres: related.reduce((sum, order) => sum + order.volumeMl, 0), totalSpendCents: related.reduce((sum, order) => sum + (order.finalTotalCents ?? 0), 0), lastFulfillmentDate: related[0]?.fulfillmentDate ?? null } }; });
}

export async function getCustomerProfile(database: Database, customerId: string) {
  const customer = await database.query.customers.findFirst({
    where: and(eq(customers.id, customerId), eq(customers.shopId, env().SHOP_ID)),
  });
  if (!customer) return null;
  const customerOrders = await database.select({
    id: orders.id,
    publicReference: orders.publicReference,
    status: orders.status,
    fulfillmentDate: orders.fulfillmentDate,
    fulfillmentMethod: orders.fulfillmentMethod,
    volumeMl: orders.volumeMl,
    finalTotalCents: orders.finalTotalCents,
    createdAt: orders.createdAt,
  }).from(orders).where(and(eq(orders.shopId, env().SHOP_ID), eq(orders.customerId, customerId))).orderBy(desc(orders.createdAt)).limit(50);
  const identityConflicts = await database.select({ id: customers.id, name: customers.name, mobile: customers.mobile, email: customers.email }).from(customers).where(and(eq(customers.shopId, env().SHOP_ID), eq(customers.mobile, customer.mobile))).limit(20);
  const audit = await database.select({
    id: auditEntries.id,
    action: auditEntries.action,
    actor: auditEntries.actor,
    detailsJson: auditEntries.detailsJson,
    createdAt: auditEntries.createdAt,
  }).from(auditEntries).where(and(eq(auditEntries.shopId, env().SHOP_ID), eq(auditEntries.entityType, "customer"), eq(auditEntries.entityId, customerId))).orderBy(desc(auditEntries.createdAt)).limit(30);
  const completedOrders = customerOrders.filter((order) => !["CANCELLED", "REJECTED", "NO_SHOW", "CUSTOMER_DECLINED"].includes(order.status));
  return {
    customer,
    orders: customerOrders,
    audit,
    metrics: {
      lifetimeLitres: completedOrders.reduce((total, order) => total + order.volumeMl, 0),
      totalSpendCents: completedOrders.reduce((total, order) => total + (order.finalTotalCents ?? 0), 0),
      totalOrders: completedOrders.length,
      lastFulfillmentDate: completedOrders[0]?.fulfillmentDate ?? null,
    },
    identityConflicts,
  };
}
