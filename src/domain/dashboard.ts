import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, availability, notifications, orderPayments, orders, products } from "@/db/schema";
import { env } from "@/lib/env";
import { todayInTimezone } from "@/lib/format";
import { getOrderTriageReasons } from "./order-triage";

export async function getDashboard(database: Database) {
  const shopId = env().SHOP_ID;
  const shop = await database.query.shops.findFirst({ where: (table, { eq }) => eq(table.id, shopId) });
  const date = shop ? todayInTimezone(shop.timezone) : new Date().toISOString().slice(0, 10);
  const rows = await database.select().from(orders).where(eq(orders.shopId, shopId));
  const payments = await database.select().from(orderPayments).where(eq(orderPayments.shopId, shopId));
  const paidByOrder = new Map<string, number>();
  for (const payment of payments) if (payment.kind === "PAYMENT") paidByOrder.set(payment.orderId, (paidByOrder.get(payment.orderId) ?? 0) + payment.amountCents);
  const rowsWithPayment = rows.map((row) => { const outstandingCents = row.finalTotalCents == null ? null : Math.max(0, row.finalTotalCents - (paidByOrder.get(row.id) ?? 0)); return { ...row, outstandingCents, paymentStatus: outstandingCents == null ? "PENDING_FEE" : outstandingCents > 0 ? "UNPAID" : "PAID" }; });
  const today = rowsWithPayment.filter((row) => row.fulfillmentDate === date);
  const capacity = await database.select({ availability, product: products }).from(availability).innerJoin(products, eq(products.id, availability.productId)).where(and(eq(availability.shopId, shopId), gte(availability.businessDate, date))).limit(50);
  const unread = await database.select({ count: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.shopId, shopId), sql`${notifications.readAt} IS NULL`));
  const count = (status: string) => today.filter((row) => row.status === status).length;
  const exceptionStatuses = ["CANCELLED", "REJECTED", "NO_SHOW", "CUSTOMER_DECLINED", "CANCELLED_BY_CUSTOMER"];
  const now = Date.now();
  const overdueOrders = today.filter((row) => row.status === "NEW" && now - new Date(row.createdAt).getTime() >= 15 * 60 * 1000).map((row) => ({ id: row.id, publicReference: row.publicReference, customerName: row.customerName, createdAt: row.createdAt, ageMinutes: Math.floor((now - new Date(row.createdAt).getTime()) / 60000) }));
  const actionableOrders = today.filter((row) => ["NEW", "CONFIRMED", "PICKING", "READY"].includes(row.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 10).map((row) => ({ id: row.id, publicReference: row.publicReference, customerName: row.customerName, productNameFi: row.productNameFi, status: row.status, fulfillmentMethod: row.fulfillmentMethod, fulfillmentDate: row.fulfillmentDate }));
  const completedToday = today.filter((row) => ["PICKED_UP", "DELIVERED"].includes(row.status)).length;
  const dueToday = today.filter((row) => !["CANCELLED", "CANCELLED_BY_CUSTOMER", "CUSTOMER_DECLINED", "REJECTED"].includes(row.status)).length;
  const attention = rowsWithPayment.flatMap((row) => getOrderTriageReasons(row).map((reason) => ({ id: `${row.id}-${reason.code}`, orderId: row.id, publicReference: row.publicReference, customerName: row.customerName, fulfillmentDate: row.fulfillmentDate, status: row.status, ...reason }))).sort((a, b) => b.score - a.score).slice(0, 12);
  const audits = await database.select().from(auditEntries).where(eq(auditEntries.shopId, shopId)).orderBy(desc(auditEntries.createdAt)).limit(15);
  const byId = new Map(rows.map((row) => [row.id, row.publicReference]));
  const activity = audits.map((entry) => ({ id: entry.id, actor: entry.actor, action: entry.action, entityType: entry.entityType, entityId: entry.entityId, reference: entry.entityType === "order" ? byId.get(entry.entityId) ?? null : null, createdAt: entry.createdAt }));
  const tomorrow = new Date(`${date}T00:00:00.000Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1); const tomorrowDate = tomorrow.toISOString().slice(0, 10);
  const capacitySummary = [date, tomorrowDate].map((businessDate) => { const matching = capacity.filter((row) => row.availability.businessDate === businessDate); return { date: businessDate, capacityLitres: matching.reduce((sum, row) => sum + row.availability.capacityMl, 0) / 1000, reservedLitres: matching.reduce((sum, row) => sum + row.availability.reservedMl, 0) / 1000, remainingLitres: matching.reduce((sum, row) => sum + Math.max(0, row.availability.capacityMl - row.availability.reservedMl), 0) / 1000 }; });
  return { businessDate: date, asOf: new Date().toISOString(), counts: { new: count("NEW"), confirmed: count("CONFIRMED"), picking: count("PICKING"), ready: count("READY"), completed: completedToday, exceptions: today.filter((row) => exceptionStatuses.includes(row.status)).length, refunded: count("REFUNDED") }, fulfillment: { completed: completedToday, due: dueToday, rate: dueToday === 0 ? 100 : Math.round(completedToday / dueToday * 100) }, attentionCount: rowsWithPayment.filter((row) => getOrderTriageReasons(row).length > 0).length, attention, activity, capacitySummary, overdueNew: overdueOrders, actionableOrders, unreadNotifications: Number(unread[0]?.count ?? 0), capacity: capacity.map((row) => ({ date: row.availability.businessDate, productId: row.product.id, productNameFi: row.product.nameFi, capacityLitres: row.availability.capacityMl / 1000, reservedLitres: row.availability.reservedMl / 1000, remainingLitres: Math.max(0, row.availability.capacityMl - row.availability.reservedMl) / 1000, soldOut: row.availability.manualSoldOut || !row.availability.acceptsOrders || row.availability.capacityMl === row.availability.reservedMl })) };
}
