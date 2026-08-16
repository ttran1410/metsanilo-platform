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
  for (const payment of payments) {
    if (payment.kind === "PAYMENT") {
      paidByOrder.set(payment.orderId, (paidByOrder.get(payment.orderId) ?? 0) + payment.amountCents);
    }
  }

  const rowsWithPayment = rows.map((row) => {
    const paidCents = paidByOrder.get(row.id) ?? 0;
    const finalCents = row.finalTotalCents ?? row.itemSubtotalCents ?? 0;
    const outstandingCents = Math.max(0, finalCents - paidCents);
    return {
      ...row,
      paidCents,
      finalCents,
      outstandingCents,
      paymentStatus: outstandingCents <= 0 ? "PAID" : "UNPAID",
    };
  });

  // Filter today's active orders
  const todayOrders = rowsWithPayment.filter((row) => row.fulfillmentDate === date);
  const activeToday = todayOrders.filter(
    (row) => !["CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED", "CUSTOMER_DECLINED"].includes(row.status)
  );

  // 1. URGENT EXCEPTION TRIAGE
  const now = Date.now();
  const overdueNew = activeToday
    .filter((row) => row.status === "NEW" && now - new Date(row.createdAt).getTime() >= 15 * 60 * 1000)
    .map((row) => ({
      id: row.id,
      publicReference: row.publicReference,
      customerName: row.customerName,
      createdAt: row.createdAt,
      ageMinutes: Math.floor((now - new Date(row.createdAt).getTime()) / 60000),
      mobile: row.mobile,
    }));

  const unconfirmedDelivery = activeToday.filter(
    (row) => row.fulfillmentMethod === "DELIVERY" && (!row.streetAddress || row.deliveryFeeCents === null)
  );

  const unreadNotifications = await database
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.shopId, shopId), sql`${notifications.readAt} IS NULL`));

  // 2. FULFILLMENT FUNNEL (Stage Counts + Volume in Litres)
  const funnel = {
    intake: {
      count: activeToday.filter((r) => r.status === "NEW").length,
      volumeLitres: activeToday.filter((r) => r.status === "NEW").reduce((s, r) => s + r.volumeMl, 0) / 1000,
    },
    confirm: {
      count: activeToday.filter((r) => r.status === "CONFIRMED").length,
      volumeLitres: activeToday.filter((r) => r.status === "CONFIRMED").reduce((s, r) => s + r.volumeMl, 0) / 1000,
    },
    packing: {
      count: activeToday.filter((r) => r.status === "PICKING").length,
      volumeLitres: activeToday.filter((r) => r.status === "PICKING").reduce((s, r) => s + r.volumeMl, 0) / 1000,
    },
    ready: {
      count: activeToday.filter((r) => r.status === "READY" || r.status === "OUT_FOR_DELIVERY").length,
      volumeLitres:
        activeToday
          .filter((r) => r.status === "READY" || r.status === "OUT_FOR_DELIVERY")
          .reduce((s, r) => s + r.volumeMl, 0) / 1000,
    },
    done: {
      count: activeToday.filter((r) => r.status === "PICKED_UP" || r.status === "DELIVERED").length,
      volumeLitres:
        activeToday
          .filter((r) => r.status === "PICKED_UP" || r.status === "DELIVERED")
          .reduce((s, r) => s + r.volumeMl, 0) / 1000,
    },
  };

  // 3. TODAY'S HARVEST VOLUME & CHANNEL SPLIT
  const capacity = await database
    .select({ availability, product: products })
    .from(availability)
    .innerJoin(products, eq(products.id, availability.productId))
    .where(and(eq(availability.shopId, shopId), gte(availability.businessDate, date)))
    .limit(50);

  const todayCapacityRows = capacity.filter((row) => row.availability.businessDate === date);
  const totalCapacityLitres = todayCapacityRows.reduce((sum, r) => sum + r.availability.capacityMl, 0) / 1000;
  const totalReservedLitres = todayCapacityRows.reduce((sum, r) => sum + r.availability.reservedMl, 0) / 1000;

  const pickupVolumeLitres = activeToday.filter((r) => r.fulfillmentMethod === "PICKUP").reduce((s, r) => s + r.volumeMl, 0) / 1000;
  const deliveryVolumeLitres = activeToday.filter((r) => r.fulfillmentMethod === "DELIVERY").reduce((s, r) => s + r.volumeMl, 0) / 1000;

  // 4. FINANCIAL HEALTH & CASH FLOW (Today)
  const grossBookedCents = activeToday.reduce((sum, r) => sum + r.finalCents, 0);
  const collectedCents = activeToday.reduce((sum, r) => sum + r.paidCents, 0);
  const outstandingCents = Math.max(0, grossBookedCents - collectedCents);

  // 5. 48-HOUR LOOKAHEAD DEMAND CARDS
  const day1 = new Date(`${date}T00:00:00.000Z`);
  const day2 = new Date(day1);
  day2.setUTCDate(day2.getUTCDate() + 1);
  const day3 = new Date(day1);
  day3.setUTCDate(day3.getUTCDate() + 2);

  const date1 = date;
  const date2 = day2.toISOString().slice(0, 10);
  const date3 = day3.toISOString().slice(0, 10);

  const lookahead = [date1, date2, date3].map((businessDate, idx) => {
    const matching = capacity.filter((row) => row.availability.businessDate === businessDate);
    const capL = matching.reduce((sum, row) => sum + row.availability.capacityMl, 0) / 1000;
    const resL = matching.reduce((sum, row) => sum + row.availability.reservedMl, 0) / 1000;
    const remL = Math.max(0, capL - resL);
    const percent = capL > 0 ? Math.round((resL / capL) * 100) : 0;

    return {
      label: idx === 0 ? `Today (${date1})` : idx === 1 ? `Tomorrow (${date2})` : `Day After (${date3})`,
      date: businessDate,
      capacityLitres: capL,
      reservedLitres: resL,
      remainingLitres: remL,
      percentage: percent,
    };
  });

  // 6. RECENT ACTIVITY AUDIT FEED
  const audits = await database
    .select()
    .from(auditEntries)
    .where(eq(auditEntries.shopId, shopId))
    .orderBy(desc(auditEntries.createdAt))
    .limit(15);
  const byId = new Map(rows.map((row) => [row.id, row.publicReference]));
  const activity = audits.map((entry) => ({
    id: entry.id,
    actor: entry.actor,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    reference: entry.entityType === "order" ? byId.get(entry.entityId) ?? null : null,
    createdAt: entry.createdAt,
  }));

  const triageOrders = rowsWithPayment.filter((row) => getOrderTriageReasons(row).length > 0);

  const attention = rowsWithPayment
    .flatMap((row) =>
      getOrderTriageReasons(row).map((reason) => ({
        id: `${row.id}-${reason.code}`,
        orderId: row.id,
        publicReference: row.publicReference,
        customerName: row.customerName,
        fulfillmentDate: row.fulfillmentDate,
        status: row.status,
        ...reason,
      }))
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  return {
    businessDate: date,
    asOf: new Date().toISOString(),
    unreadNotifications: Number(unreadNotifications[0]?.count ?? 0),
    attentionCount: triageOrders.length,
    overdueNew,
    unconfirmedDeliveryCount: unconfirmedDelivery.length,
    funnel,
    volume: {
      capacityLitres: totalCapacityLitres,
      reservedLitres: totalReservedLitres,
      remainingLitres: Math.max(0, totalCapacityLitres - totalReservedLitres),
      percentage: totalCapacityLitres > 0 ? Math.round((totalReservedLitres / totalCapacityLitres) * 100) : 0,
      pickupVolumeLitres,
      pickupCrates: Math.ceil(pickupVolumeLitres / 10),
      deliveryVolumeLitres,
      deliveryCrates: Math.ceil(deliveryVolumeLitres / 10),
    },
    financials: {
      grossBookedCents,
      collectedCents,
      outstandingCents,
      collectedPercentage: grossBookedCents > 0 ? Math.round((collectedCents / grossBookedCents) * 100) : 100,
    },
    lookahead,
    attention,
    activity,
  };
}
