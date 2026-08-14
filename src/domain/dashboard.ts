import { and, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { availability, notifications, orders, products } from "@/db/schema";
import { env } from "@/lib/env";
import { todayInTimezone } from "@/lib/format";

export async function getDashboard(database: Database) {
  const shopId = env().SHOP_ID;
  const shop = await database.query.shops.findFirst({ where: (table, { eq }) => eq(table.id, shopId) });
  const date = shop ? todayInTimezone(shop.timezone) : new Date().toISOString().slice(0, 10);
  const rows = await database.select().from(orders).where(eq(orders.shopId, shopId));
  const today = rows.filter((row) => row.fulfillmentDate === date);
  const capacity = await database.select({ availability, product: products }).from(availability).innerJoin(products, eq(products.id, availability.productId)).where(and(eq(availability.shopId, shopId), gte(availability.businessDate, date))).limit(50);
  const unread = await database.select({ count: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.shopId, shopId), sql`${notifications.readAt} IS NULL`));
  const count = (status: string) => today.filter((row) => row.status === status).length;
  const exceptionStatuses = ["CANCELLED", "REJECTED", "NO_SHOW", "CUSTOMER_DECLINED", "CANCELLED_BY_CUSTOMER"];
  const now = Date.now();
  const overdueOrders = today.filter((row) => row.status === "NEW" && now - new Date(row.createdAt).getTime() >= 15 * 60 * 1000).map((row) => ({ id: row.id, publicReference: row.publicReference, customerName: row.customerName, createdAt: row.createdAt, ageMinutes: Math.floor((now - new Date(row.createdAt).getTime()) / 60000) }));
  const actionableOrders = today.filter((row) => ["NEW", "CONFIRMED", "PICKING", "READY"].includes(row.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 10).map((row) => ({ id: row.id, publicReference: row.publicReference, customerName: row.customerName, productNameFi: row.productNameFi, status: row.status, fulfillmentMethod: row.fulfillmentMethod, fulfillmentDate: row.fulfillmentDate }));
  return { businessDate: date, asOf: new Date().toISOString(), counts: { new: count("NEW"), confirmed: count("CONFIRMED"), picking: count("PICKING"), ready: count("READY"), completed: today.filter((row) => ["PICKED_UP", "DELIVERED"].includes(row.status)).length, exceptions: today.filter((row) => exceptionStatuses.includes(row.status)).length, refunded: count("REFUNDED") }, overdueNew: overdueOrders, actionableOrders, unreadNotifications: Number(unread[0]?.count ?? 0), capacity: capacity.map((row) => ({ date: row.availability.businessDate, productId: row.product.id, productNameFi: row.product.nameFi, capacityLitres: row.availability.capacityMl / 1000, reservedLitres: row.availability.reservedMl / 1000, remainingLitres: Math.max(0, row.availability.capacityMl - row.availability.reservedMl) / 1000, soldOut: row.availability.manualSoldOut || !row.availability.acceptsOrders || row.availability.capacityMl === row.availability.reservedMl })) };
}
