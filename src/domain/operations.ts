import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, customers, notifications, orderPayments, orders, outboxJobs, packages, products, shops } from "@/db/schema";
import { env } from "@/lib/env";
import { todayInTimezone } from "@/lib/format";
import { DomainError } from "./errors";
import { submitOrder, transitionOrder } from "./orders";
import { normalizeEmail, normalizeMobile } from "./order-input";

const nowIso = () => new Date().toISOString();

export async function createExternalOrder(database: Database, input: {
  productId: string; packageId: string; quantity: number; fulfillmentDate: string; fulfillmentMethod: "PICKUP" | "DELIVERY";
  customerName: string; mobile: string; email?: string; streetAddress?: string; postalCode?: string; city?: string; notes?: string;
  status: "NEW" | "CONFIRMED"; source: "PHONE" | "SMS" | "WHATSAPP" | "FACEBOOK" | "WEBSITE" | "OTHER"; deliveryFeeCents?: number;
}) {
  const receipt = await submitOrder(database, {
    locale: "fi", ...input, idempotencyKey: `external-${randomBytes(12).toString("hex")}`,
  });
  const order = await database.query.orders.findFirst({ where: eq(orders.publicReference, receipt.publicReference) });
  if (!order) throw new DomainError("NOT_FOUND", "External order was not created", 404);
  await database.update(orders).set({ orderSource: input.source, notes: input.notes?.trim() || order.notes }).where(eq(orders.id, order.id));
  if (input.deliveryFeeCents !== undefined && input.fulfillmentMethod === "DELIVERY") {
    await database.update(orders).set({ deliveryFeeCents: input.deliveryFeeCents, finalTotalCents: order.itemSubtotalCents + input.deliveryFeeCents }).where(eq(orders.id, order.id));
  }
  if (input.status === "CONFIRMED") await transitionOrder(database, { orderId: order.id, status: "CONFIRMED", expectedVersion: order.version });
  return (await database.query.orders.findFirst({ where: eq(orders.id, order.id) }))!;
}

export async function createHistoricalOrder(database: Database, input: {
  productId: string; packageId: string; quantity: number; fulfillmentDate: string; fulfillmentMethod: "PICKUP" | "DELIVERY";
  customerName: string; mobile: string; email?: string; streetAddress?: string; postalCode?: string; city?: string;
  itemSubtotalCents?: number; deliveryFeeCents?: number; completedStatus: "PICKED_UP" | "DELIVERED"; completedAt: string;
  source: "PHONE" | "SMS" | "WHATSAPP" | "FACEBOOK" | "WEBSITE" | "OTHER"; reason: string; paymentAmountCents?: number;
}) {
  const shopId = env().SHOP_ID;
  if (input.reason.trim().length < 2 || input.quantity < 1) throw new DomainError("VALIDATION_ERROR", "Historical reason and quantity are required", 422);
  if ((input.completedStatus === "PICKED_UP" && input.fulfillmentMethod !== "PICKUP") || (input.completedStatus === "DELIVERED" && input.fulfillmentMethod !== "DELIVERY")) throw new DomainError("INVALID_ORDER", "Historical status does not match fulfillment method", 409);
  return database.transaction(async (tx) => {
    const row = (await tx.select({ product: products, package: packages, shop: shops }).from(products).innerJoin(packages, and(eq(packages.id, input.packageId), eq(packages.productId, products.id), eq(packages.shopId, shopId))).innerJoin(shops, eq(shops.id, shopId)).where(and(eq(products.id, input.productId), eq(products.shopId, shopId))).limit(1))[0];
    if (!row) throw new DomainError("NOT_FOUND", "Product or package not found", 404);
    if (row.package.volumeMl !== 10000 && input.quantity !== 1) throw new DomainError("INVALID_QUANTITY", "Only the 10 litre package supports quantity", 422);
    const volumeMl = row.package.volumeMl * input.quantity;
    const subtotal = input.itemSubtotalCents ?? row.package.priceCents * input.quantity;
    const deliveryFee = input.fulfillmentMethod === "PICKUP" ? 0 : input.deliveryFeeCents ?? null;
    const id = randomUUID(); const createdAt = nowIso(); const normalizedEmail = normalizeEmail(input.email); let normalizedMobile: string;
    try { normalizedMobile = normalizeMobile(input.mobile); } catch { throw new DomainError("VALIDATION_ERROR", "Invalid phone", 422, { mobile: "INVALID_PHONE" }); }
    const mobileMatch = await tx.query.customers.findFirst({ where: and(eq(customers.shopId, shopId), eq(customers.mobile, normalizedMobile)) });
    const emailMatch = normalizedEmail ? await tx.query.customers.findFirst({ where: and(eq(customers.shopId, shopId), eq(customers.email, normalizedEmail)) }) : undefined;
    const conflict = Boolean(mobileMatch && emailMatch && mobileMatch.id !== emailMatch.id);
    const customer = (conflict || (!mobileMatch && !emailMatch)) ? { id: randomUUID(), shopId, name: input.customerName.trim(), mobile: normalizedMobile, email: normalizedEmail, matchStatus: conflict ? "CONFLICT_REVIEW" as const : "ACTIVE" as const, notes: conflict ? "Conflicting customer identifiers require staff review." : null, createdAt, updatedAt: createdAt } : (mobileMatch ?? emailMatch)!;
    if (conflict || (!mobileMatch && !emailMatch)) await tx.insert(customers).values(customer);
    await tx.insert(orders).values({ id, shopId, publicReference: `H-${randomBytes(5).toString("hex").toUpperCase()}`, idempotencyKey: `historical-${id}`, productId: row.product.id, packageId: row.package.id, customerId: customer.id, productNameFi: row.product.nameFi, productNameEn: row.product.nameEn, packageLabelFi: row.package.labelFi, packageLabelEn: row.package.labelEn, quantity: input.quantity, volumeMl, itemSubtotalCents: subtotal, deliveryFeeCents: deliveryFee, finalTotalCents: deliveryFee === null ? null : subtotal + deliveryFee, fulfillmentDate: input.fulfillmentDate, fulfillmentMethod: input.fulfillmentMethod, customerName: input.customerName.trim(), mobile: normalizedMobile, email: normalizedEmail, streetAddress: input.streetAddress || null, postalCode: input.postalCode || null, city: input.city || null, pickupName: null, pickupAddress: null, pickupInstructions: null, pickupTime: null, notes: input.reason.trim(), statusReason: input.reason.trim(), contactedAt: null, contactedBy: null, contactChannel: null, fulfillmentStartedAt: null, readyAt: null, dispatchedAt: input.completedStatus === "DELIVERED" ? input.completedAt : null, completedAt: input.completedAt, pickupConfirmedAt: input.completedStatus === "PICKED_UP" ? input.completedAt : null, pickupConfirmedBy: input.completedStatus === "PICKED_UP" ? "manager" : null, locale: "fi", status: input.completedStatus, version: 1, orderSource: input.source, historicalEntry: true, createdAt, updatedAt: createdAt });
    if (input.paymentAmountCents && input.paymentAmountCents > 0) await tx.insert(orderPayments).values({ id: randomUUID(), shopId, orderId: id, amountCents: input.paymentAmountCents, kind: "PAYMENT", method: "OTHER", reference: "historical entry", recordedAt: input.completedAt, actor: "manager" });
    await tx.insert(auditEntries).values({ id: randomUUID(), shopId, actor: "manager", action: "order.historical_created", entityType: "order", entityId: id, detailsJson: JSON.stringify({ status: input.completedStatus, reason: input.reason, source: input.source }), createdAt });
    return (await tx.query.orders.findFirst({ where: eq(orders.id, id) }))!;
  });
}

async function enqueue(database: Database, eventKey: string, type: "EMAIL" | "AUTOMATION" | "NOTIFICATION", payload: Record<string, unknown>, scheduledFor: string) {
  const shopId = env().SHOP_ID;
  await database.insert(outboxJobs).values({ id: randomUUID(), shopId, eventKey, type, payloadJson: JSON.stringify(payload), status: "PENDING", scheduledFor, attempts: 0, createdAt: nowIso() }).onConflictDoNothing({ target: [outboxJobs.shopId, outboxJobs.eventKey] });
}

async function notify(database: Database, eventKey: string, category: string, title: string, body: string, orderId?: string) {
  const shopId = env().SHOP_ID; const createdAt = nowIso();
  await database.insert(notifications).values({ id: randomUUID(), shopId, eventKey, category, title, body, orderId: orderId ?? null, createdAt }).onConflictDoNothing({ target: [notifications.shopId, notifications.eventKey] });
  await enqueue(database, eventKey, "NOTIFICATION", { category, title, body, orderId }, createdAt);
}

export async function runAutomation(database: Database, now = new Date()) {
  const shopId = env().SHOP_ID;
  const shop = await database.query.shops.findFirst({ where: eq(shops.id, shopId) });
  if (!shop) throw new DomainError("NOT_FOUND", "Shop not found", 404);
  const date = todayInTimezone(shop.timezone, now);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: shop.timezone, hour: "2-digit", hour12: false }).format(now));
  const counts = { picking: 0, overdueReminders: 0, readyReminders: 0 };
  if (hour >= 10) {
    const confirmed = await database.select().from(orders).where(and(eq(orders.shopId, shopId), eq(orders.fulfillmentDate, date), eq(orders.status, "CONFIRMED")));
    for (const order of confirmed) { await transitionOrder(database, { orderId: order.id, status: "PICKING", expectedVersion: order.version, actor: "system" }); counts.picking += 1; }
  }
  const overdueAt = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const overdue = await database.select().from(orders).where(and(eq(orders.shopId, shopId), eq(orders.status, "NEW"), lt(orders.createdAt, overdueAt)));
  for (const order of overdue) { await notify(database, `order:${order.id}:new-overdue:v1`, "NEW_ORDER_OVERDUE", "New order overdue", `Order ${order.publicReference} has been NEW for at least 15 minutes.`, order.id); counts.overdueReminders += 1; }
  if (hour >= 19) {
    const picking = await database.select().from(orders).where(and(eq(orders.shopId, shopId), eq(orders.fulfillmentDate, date), eq(orders.status, "PICKING")));
    for (const order of picking) { await notify(database, `order:${order.id}:ready-review:v1`, "READY_REVIEW", "Ready review required", `Order ${order.publicReference} is still PICKING after the ready-review time.`, order.id); counts.readyReminders += 1; }
  }
  return { date, hour, ...counts };
}
