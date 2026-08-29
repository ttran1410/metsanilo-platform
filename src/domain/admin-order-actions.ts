import { randomUUID } from "node:crypto";
import { and, count, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, orderPayments, orders } from "@/db/schema";
import { DomainError } from "./errors";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";
import { getManagerOrder, getOrderQueue, listManagerOrdersWithPaymentSummary } from "./orders";
import { listManagerProducts } from "./products";
import { listManagerAvailability } from "./availability";
import { searchManagerOrders } from "./admin-search";
import { paged, type AdminListQuery } from "@/lib/admin-list-query";
import { getOrderTriageReasons } from "./order-triage";
import { todayInTimezone } from "@/lib/format";

export type AdminOrdersQueryFilters = { status?: string; fulfillmentMethod?: string; productId?: string; seasonId?: string; archived?: boolean; historicalEntry?: boolean; source?: string; from?: string; to?: string; triage?: boolean; unpaid?: boolean };

export type AdminOrderQuickViewCounts = {
  TODAY: number; TRIAGE: number; NEEDS_CONFIRMATION: number; PICKUP_TODAY: number;
  DELIVERY_TODAY: number; UNPAID: number; ALL: number; ARCHIVED: number;
};

export async function getAdminOrderQuickViewCounts(database: Database, context: AdminActionContext): Promise<AdminOrderQuickViewCounts> {
  assertAdminActionContext(context);
  const shop = await database.query.shops.findFirst({ where: (table, { eq }) => eq(table.id, context.shop.id), columns: { timezone: true } });
  const date = todayInTimezone(shop?.timezone ?? "Europe/Helsinki");
  const active = eq(orders.archived, false);
  const [today, confirmation, pickup, delivery, all, archived] = await Promise.all([
    database.select({ value: count() }).from(orders).where(and(eq(orders.shopId, context.shop.id), active, eq(orders.fulfillmentDate, date))),
    database.select({ value: count() }).from(orders).where(and(eq(orders.shopId, context.shop.id), active, eq(orders.status, "NEW"))),
    database.select({ value: count() }).from(orders).where(and(eq(orders.shopId, context.shop.id), active, eq(orders.fulfillmentDate, date), eq(orders.fulfillmentMethod, "PICKUP"))),
    database.select({ value: count() }).from(orders).where(and(eq(orders.shopId, context.shop.id), active, eq(orders.fulfillmentDate, date), eq(orders.fulfillmentMethod, "DELIVERY"))),
    database.select({ value: count() }).from(orders).where(and(eq(orders.shopId, context.shop.id), active)),
    database.select({ value: count() }).from(orders).where(and(eq(orders.shopId, context.shop.id), eq(orders.archived, true))),
  ]);
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const candidates = await database.select().from(orders).where(and(
    eq(orders.shopId, context.shop.id), active,
    or(
      and(eq(orders.status, "NEW"), lte(orders.createdAt, cutoff)),
      lt(orders.fulfillmentDate, date),
      and(eq(orders.fulfillmentMethod, "DELIVERY"), or(isNull(orders.streetAddress), isNull(orders.postalCode), isNull(orders.city), eq(orders.streetAddress, ""), eq(orders.postalCode, ""), eq(orders.city, ""))),
      and(eq(orders.fulfillmentMethod, "DELIVERY"), isNull(orders.deliveryFeeCents)),
      inArray(orders.status, ["CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW"]),
      inArray(orders.status, ["READY", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED"]),
    ),
  ));
  const activeTotals = await database.select({ id: orders.id, finalTotalCents: orders.finalTotalCents }).from(orders).where(and(eq(orders.shopId, context.shop.id), active));
  const payments = activeTotals.length ? await database.select().from(orderPayments).where(and(eq(orderPayments.shopId, context.shop.id), inArray(orderPayments.orderId, activeTotals.map((order) => order.id)))) : [];
  const paid = new Map<string, number>();
  for (const payment of payments) if (payment.kind === "PAYMENT") paid.set(payment.orderId, (paid.get(payment.orderId) ?? 0) + payment.amountCents);
  const triage = candidates.filter((order) => getOrderTriageReasons({ ...order, paymentStatus: order.finalTotalCents === null ? "PENDING_FEE" : (order.finalTotalCents - (paid.get(order.id) ?? 0)) > 0 ? "UNPAID" : "PAID" }).length > 0).length;
  const unpaid = activeTotals.filter((order) => order.finalTotalCents !== null && order.finalTotalCents > (paid.get(order.id) ?? 0)).length;
  return { TODAY: Number(today[0]?.value ?? 0), TRIAGE: triage, NEEDS_CONFIRMATION: Number(confirmation[0]?.value ?? 0), PICKUP_TODAY: Number(pickup[0]?.value ?? 0), DELIVERY_TODAY: Number(delivery[0]?.value ?? 0), UNPAID: unpaid, ALL: Number(all[0]?.value ?? 0), ARCHIVED: Number(archived[0]?.value ?? 0) };
}
export async function getAdminOrderDetail(database: Database, context: AdminActionContext, orderId: string) {
  assertAdminActionContext(context);
  return getManagerOrder(database, orderId);
}

export async function getAdminOrderEditData(database: Database, context: AdminActionContext, orderId: string) {
  assertAdminActionContext(context);
  const [detail, products, availabilityList] = await Promise.all([
    getManagerOrder(database, orderId),
    listManagerProducts(database),
    listManagerAvailability(database),
  ]);
  return { detail, products, availabilityList };
}

export async function getAdminOrderQueue(database: Database, context: AdminActionContext, filters: Parameters<typeof getOrderQueue>[1] = {}) {
  assertAdminActionContext(context);
  return getOrderQueue(database, filters);
}

export async function getAdminOrdersForExport(database: Database, context: AdminActionContext, selectedIds: string[] = []) {
  assertAdminActionContext(context);
  const orders = await listManagerOrdersWithPaymentSummary(database);
  if (!selectedIds.length) return orders;
  const selected = new Set(selectedIds);
  return orders.filter((order) => selected.has(order.id));
}

export async function getAdminOrders(database: Database, context: AdminActionContext, query?: { list?: AdminListQuery; filters?: AdminOrdersQueryFilters }) {
  assertAdminActionContext(context);
  if (query?.list) {
    if (query.filters?.triage || query.filters?.unpaid) {
      const all = await listManagerOrdersWithPaymentSummary(database);
      const filtered = all.filter((order) => {
        if (query.filters?.triage && getOrderTriageReasons(order).length === 0) return false;
        if (query.filters?.unpaid && order.paymentStatus !== "UNPAID") return false;
        if (query.list?.q && !`${order.publicReference} ${order.customerName} ${order.mobile} ${order.email ?? ""}`.toLowerCase().includes(query.list.q.toLowerCase())) return false;
        if (query.filters?.status && !((query.filters.status === "FULFILLED" && (order.status === "PICKED_UP" || order.status === "DELIVERED")) || (query.filters.status === "READY_STAGE" && (order.status === "READY" || order.status === "OUT_FOR_DELIVERY")) || query.filters.status === order.status)) return false;
        if (query.filters?.fulfillmentMethod && order.fulfillmentMethod !== query.filters.fulfillmentMethod) return false;
        if (query.filters?.source && !((query.filters.source === "FACEBOOK_MESSAGE" || query.filters.source === "FACEBOOK") ? (order.orderSource === "FACEBOOK_MESSAGE" || order.orderSource === "FACEBOOK") : (query.filters.source === "MANUAL" || query.filters.source === "PHONE") ? (order.orderSource === "MANUAL" || order.orderSource === "PHONE") : order.orderSource === query.filters.source)) return false;
        if (query.filters?.historicalEntry !== undefined && Boolean(order.historicalEntry) !== query.filters.historicalEntry) return false;
        if (query.filters?.from && order.fulfillmentDate < query.filters.from) return false;
        if (query.filters?.to && order.fulfillmentDate > query.filters.to) return false;
        if (query.filters?.archived !== undefined && Boolean(order.archived) !== query.filters.archived) return false;
        return true;
      });
      const result = paged(filtered.slice(query.list.offset, query.list.offset + query.list.pageSize), filtered.length, query.list);
      return result;
    }
    const result = await searchManagerOrders(database, query.list, query.filters);
    return result;
  }
  return listManagerOrdersWithPaymentSummary(database);
}
import { addDeliveryException, addOrderNote, archiveManagerOrder, confirmPickup, deleteManagerOrder, previewManagerOrderUpdate, recordPayment, recordRefund, setDeliveryFee, transitionOrder, unarchiveManagerOrder, updateManagerOrder } from "./orders";
import type { PaymentMethod } from "./payment-methods";

type OrderActionContext = AdminActionContext;

function prepare(context: OrderActionContext) {
  assertAdminActionContext(context);
  return context.actor.email ?? context.actor.id;
}

export type AdminOrderStatusInput = {
  orderId: string;
  status: Parameters<typeof transitionOrder>[1]["status"];
  expectedVersion: number;
  reason?: string;
  contactChannel?: Parameters<typeof transitionOrder>[1]["contactChannel"];
};

export async function transitionAdminOrder(database: Database, context: OrderActionContext, input: AdminOrderStatusInput) {
  prepare(context);
  return transitionOrder(database, { ...input, actor: "manager" });
}

export type AdminOrderPaymentInput = { orderId: string; amountCents: number; method: PaymentMethod; reference?: string };

export async function recordAdminOrderPayment(database: Database, context: OrderActionContext, input: AdminOrderPaymentInput) {
  prepare(context);
  return recordPayment(database, input);
}

export type AdminOrderRefundInput = { orderId: string; amountCents: number; method: PaymentMethod; reason: string };

export async function recordAdminOrderRefund(database: Database, context: OrderActionContext, input: AdminOrderRefundInput) {
  prepare(context);
  return recordRefund(database, input);
}

export type AdminOrderNoteInput = { orderId: string; body: string };
export async function addAdminOrderNote(database: Database, context: OrderActionContext, input: AdminOrderNoteInput) { prepare(context); return addOrderNote(database, input); }

export type AdminDeliveryFeeInput = { orderId: string; expectedVersion: number; deliveryFeeCents: number };
export async function setAdminDeliveryFee(database: Database, context: OrderActionContext, input: AdminDeliveryFeeInput) { prepare(context); return setDeliveryFee(database, input); }

export type AdminDeliveryExceptionInput = { orderId: string; type: string; nextAction: string; note?: string; rescheduledDate?: string };
export async function addAdminDeliveryException(database: Database, context: OrderActionContext, input: AdminDeliveryExceptionInput) { prepare(context); return addDeliveryException(database, input); }

export type AdminOrderPreviewInput = Parameters<typeof previewManagerOrderUpdate>[1];
export async function previewAdminOrderUpdate(database: Database, context: OrderActionContext, input: AdminOrderPreviewInput) { prepare(context); return previewManagerOrderUpdate(database, input); }

export type AdminPickupConfirmationInput = { orderId: string; expectedVersion: number };
export async function confirmAdminOrderPickup(database: Database, context: OrderActionContext, input: AdminPickupConfirmationInput) { prepare(context); return confirmPickup(database, input); }

export type AdminOrderUpdateInput = Parameters<typeof updateManagerOrder>[1];
export async function updateAdminOrder(database: Database, context: OrderActionContext, input: AdminOrderUpdateInput) { prepare(context); return updateManagerOrder(database, input); }

export async function deleteAdminOrder(database: Database, context: OrderActionContext, orderId: string) { const actor = prepare(context); return deleteManagerOrder(database, orderId, actor); }
export async function archiveAdminOrder(database: Database, context: OrderActionContext, orderId: string) { const actor = prepare(context); return archiveManagerOrder(database, orderId, actor); }
export async function unarchiveAdminOrder(database: Database, context: OrderActionContext, orderId: string) { const actor = prepare(context); return unarchiveManagerOrder(database, orderId, actor); }

export type AdminOrderPricingInput = { orderId: string; expectedVersion: number; itemSubtotalCents: number; deliveryFeeCents?: number | null; reason: string };
export async function updateAdminOrderPricing(database: Database, context: OrderActionContext, input: AdminOrderPricingInput) {
  const actor = prepare(context); const current = await database.query.orders.findFirst({ where: and(eq(orders.id, input.orderId), eq(orders.shopId, context.shop.id)) });
  if (!current) throw new DomainError("NOT_FOUND", "Order not found", 404);
  if (current.version !== input.expectedVersion) throw new DomainError("STALE_VERSION", "Order changed", 409);
  const fee = input.deliveryFeeCents === undefined ? current.deliveryFeeCents : input.deliveryFeeCents;
  if (current.fulfillmentMethod === "PICKUP" && fee !== 0) throw new DomainError("INVALID_ORDER", "Pickup orders cannot have a delivery fee", 409);
  const finalTotalCents = fee === null ? null : input.itemSubtotalCents + fee; const now = new Date().toISOString();
  const changed = await database.update(orders).set({ itemSubtotalCents: input.itemSubtotalCents, deliveryFeeCents: fee, finalTotalCents, version: sql`${orders.version} + 1`, updatedAt: now }).where(and(eq(orders.id, input.orderId), eq(orders.version, input.expectedVersion), eq(orders.shopId, context.shop.id))).run();
  if (changed.rowsAffected !== 1) throw new DomainError("STALE_VERSION", "Order changed", 409);
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: context.shop.id, actor, action: "order.pricing_updated", entityType: "order", entityId: input.orderId, detailsJson: JSON.stringify({ fromItemSubtotalCents: current.itemSubtotalCents, toItemSubtotalCents: input.itemSubtotalCents, fromDeliveryFeeCents: current.deliveryFeeCents, toDeliveryFeeCents: fee, reason: input.reason }), createdAt: now });
  return database.query.orders.findFirst({ where: and(eq(orders.id, input.orderId), eq(orders.shopId, context.shop.id)) });
}
