import { and, eq, gte, inArray, lte } from "drizzle-orm";
import type { Database } from "@/db/client";
import { availability, orderPayments, orders } from "@/db/schema";
import { env } from "@/lib/env";

export const FULFILLED_STATUSES = ["PICKED_UP", "DELIVERED"] as const;
export type ReportKey = "sales" | "capacity" | "payments" | "customers";

export type ReportFilters = {
  from: string;
  to: string;
  productId?: string;
  method?: "PICKUP" | "DELIVERY";
  source?: string;
  outcome?: string;
  groupBy?: "day" | "week" | "month";
};

function isFulfilled(status: string) {
  return (FULFILLED_STATUSES as readonly string[]).includes(status);
}

function dateKey(date: string, groupBy: ReportFilters["groupBy"] = "day") {
  if (groupBy === "month") return date.slice(0, 7);
  if (groupBy === "week") {
    const d = new Date(`${date}T12:00:00Z`);
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - day + 1);
    return d.toISOString().slice(0, 10);
  }
  return date;
}

export async function getReport(database: Database, filters: ReportFilters) {
  const shopId = env().SHOP_ID;
  const orderRows = await database.select().from(orders).where(and(
    eq(orders.shopId, shopId),
    gte(orders.fulfillmentDate, filters.from),
    lte(orders.fulfillmentDate, filters.to),
    ...(filters.productId ? [eq(orders.productId, filters.productId)] : []),
    ...(filters.method ? [eq(orders.fulfillmentMethod, filters.method)] : []),
    ...(filters.source ? [eq(orders.orderSource, filters.source)] : []),
  ));
  const orderIds = orderRows.map((row) => row.id);
  const paymentRows = orderIds.length
    ? await database.select().from(orderPayments).where(and(eq(orderPayments.shopId, shopId), inArray(orderPayments.orderId, orderIds)))
    : [];

  const fulfilled = orderRows.filter((row) => isFulfilled(row.status) && (!filters.outcome || row.status === filters.outcome));
  const cancelled = orderRows.filter((row) => !isFulfilled(row.status) && (!filters.outcome || row.status === filters.outcome));
  const grouped = new Map<string, { date: string; orders: number; litres: number; salesCents: number; deliveryCents: number }>();
  for (const row of fulfilled) {
    const key = dateKey(row.fulfillmentDate, filters.groupBy);
    const entry = grouped.get(key) ?? { date: key, orders: 0, litres: 0, salesCents: 0, deliveryCents: 0 };
    entry.orders += 1;
    entry.litres += row.volumeMl;
    entry.salesCents += row.finalTotalCents ?? row.itemSubtotalCents;
    entry.deliveryCents += row.deliveryFeeCents ?? 0;
    grouped.set(key, entry);
  }

  const refundsCents = paymentRows.filter((row) => row.kind === "REFUND").reduce((sum, row) => sum + row.amountCents, 0);
  const paymentsCents = paymentRows.filter((row) => row.kind === "PAYMENT").reduce((sum, row) => sum + row.amountCents, 0);
  const productMix = [...new Map(fulfilled.map((row) => [row.productId, { productId: row.productId, label: row.productNameEn, orders: 0, litres: 0, salesCents: 0 }])).values()];
  for (const row of fulfilled) {
    const item = productMix.find((entry) => entry.productId === row.productId);
    if (item) { item.orders += 1; item.litres += row.volumeMl; item.salesCents += row.finalTotalCents ?? row.itemSubtotalCents; }
  }
  const methodMix = ["PICKUP", "DELIVERY"].map((method) => ({ method, orders: fulfilled.filter((row) => row.fulfillmentMethod === method).length, litres: fulfilled.filter((row) => row.fulfillmentMethod === method).reduce((sum, row) => sum + row.volumeMl, 0) }));
  const sourceMix = [...new Set(fulfilled.map((row) => row.orderSource))].map((source) => ({ source, orders: fulfilled.filter((row) => row.orderSource === source).length, litres: fulfilled.filter((row) => row.orderSource === source).reduce((sum, row) => sum + row.volumeMl, 0) }));

  const capacityRows = await database.select().from(availability).where(and(eq(availability.shopId, shopId), gte(availability.businessDate, filters.from), lte(availability.businessDate, filters.to), ...(filters.productId ? [eq(availability.productId, filters.productId)] : [])));
  const capacity = capacityRows.map((row) => ({
    date: row.businessDate, productId: row.productId, configuredMl: row.capacityMl, reservedMl: row.reservedMl,
    remainingMl: Math.max(0, row.capacityMl - row.reservedMl), manualSoldOut: row.manualSoldOut, manualSoldOutReason: row.manualSoldOutReason,
  }));

  const customerGroups = new Map<string, { key: string; orders: number; litres: number; salesCents: number; firstFulfilledDate: string }>();
  for (const row of fulfilled) {
    const key = row.customerId ?? "unlinked";
    const entry = customerGroups.get(key) ?? { key, orders: 0, litres: 0, salesCents: 0, firstFulfilledDate: row.fulfillmentDate };
    entry.orders += 1; entry.litres += row.volumeMl; entry.salesCents += row.finalTotalCents ?? row.itemSubtotalCents;
    if (row.fulfillmentDate < entry.firstFulfilledDate) entry.firstFulfilledDate = row.fulfillmentDate;
    customerGroups.set(key, entry);
  }
  const customerRows = [...customerGroups.values()];
  const repeatCustomers = customerRows.filter((row) => row.orders > 1).length;

  return {
    meta: { from: filters.from, to: filters.to, groupBy: filters.groupBy ?? "day", currency: "EUR", timezone: "Europe/Helsinki", generatedAt: new Date().toISOString(), formulaVersion: "reporting-v1" },
    sales: { fulfilledOrders: fulfilled.length, fulfilledLitresMl: fulfilled.reduce((sum, row) => sum + row.volumeMl, 0), fulfilledSalesCents: fulfilled.reduce((sum, row) => sum + (row.finalTotalCents ?? row.itemSubtotalCents), 0), averageOrderValueCents: fulfilled.length ? Math.round(fulfilled.reduce((sum, row) => sum + (row.finalTotalCents ?? row.itemSubtotalCents), 0) / fulfilled.length) : 0, deliveryFeeCents: fulfilled.reduce((sum, row) => sum + (row.deliveryFeeCents ?? 0), 0), cancelledOrders: cancelled.length, timeline: [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date)), productMix, methodMix, sourceMix },
    capacity: { rows: capacity, configuredMl: capacity.reduce((sum, row) => sum + row.configuredMl, 0), reservedMl: capacity.reduce((sum, row) => sum + row.reservedMl, 0), remainingMl: capacity.reduce((sum, row) => sum + row.remainingMl, 0), utilizationPercent: capacity.reduce((sum, row) => sum + row.configuredMl, 0) ? Math.round((capacity.reduce((sum, row) => sum + row.reservedMl, 0) / capacity.reduce((sum, row) => sum + row.configuredMl, 0)) * 100) : 0 },
    payments: { recordedPaymentsCents: paymentsCents, refundsCents, netCashCents: paymentsCents - refundsCents, paymentCount: paymentRows.filter((row) => row.kind === "PAYMENT").length, refundCount: paymentRows.filter((row) => row.kind === "REFUND").length },
    customers: { fulfilledCustomers: customerRows.filter((row) => row.key !== "unlinked").length, repeatCustomers, repeatRatePercent: customerRows.length ? Math.round((repeatCustomers / customerRows.length) * 100) : 0, unlinkedOrders: customerRows.find((row) => row.key === "unlinked")?.orders ?? 0, groups: customerRows },
  };
}

export function reportCsv(report: Awaited<ReturnType<typeof getReport>>, key: ReportKey) {
  const rows = key === "capacity" ? report.capacity.rows.map((row) => [row.date, row.productId, row.configuredMl, row.reservedMl, row.remainingMl, row.manualSoldOut ? "manual sold-out" : ""]) : key === "sales" ? report.sales.timeline.map((row) => [row.date, row.orders, row.litres, row.salesCents, row.deliveryCents]) : key === "payments" ? [[report.meta.from, report.meta.to, report.payments.recordedPaymentsCents, report.payments.refundsCents, report.payments.netCashCents]] : report.customers.groups.map((row) => [row.key, row.orders, row.litres, row.salesCents]);
  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
}
