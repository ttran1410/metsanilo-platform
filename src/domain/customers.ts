import { and, desc, eq, like, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, customers, orders } from "@/db/schema";
import { env } from "@/lib/env";

export async function searchCustomers(database: Database, query: string) {
  const value = query.trim();
  if (value.length < 2) return [];
  return database.select().from(customers).where(and(eq(customers.shopId, env().SHOP_ID), or(like(customers.mobile, `%${value}%`), like(customers.email, `%${value.toLowerCase()}%`), like(customers.name, `%${value}%`)))).limit(25);
}

export async function listCustomers(database: Database) {
  return database.select().from(customers).where(eq(customers.shopId, env().SHOP_ID)).orderBy(desc(customers.updatedAt)).limit(100);
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
  const audit = await database.select({
    id: auditEntries.id,
    action: auditEntries.action,
    actor: auditEntries.actor,
    detailsJson: auditEntries.detailsJson,
    createdAt: auditEntries.createdAt,
  }).from(auditEntries).where(and(eq(auditEntries.shopId, env().SHOP_ID), eq(auditEntries.entityType, "customer"), eq(auditEntries.entityId, customerId))).orderBy(desc(auditEntries.createdAt)).limit(30);
  return { customer, orders: customerOrders, audit };
}
