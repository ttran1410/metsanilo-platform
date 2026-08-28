import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, orders } from "@/db/schema";
import { DomainError } from "./errors";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";
import { listManagerOrdersWithPaymentSummary } from "./orders";
import { searchManagerOrders } from "./admin-search";
import type { AdminListQuery } from "@/lib/admin-list-query";
import { getOrderTriageReasons } from "./order-triage";
import { todayInTimezone } from "@/lib/format";

export type AdminOrdersQueryFilters = { status?: string; fulfillmentMethod?: string; productId?: string; seasonId?: string; archived?: boolean; historicalEntry?: boolean; source?: string; from?: string; to?: string };
export async function getAdminOrders(database: Database, context: AdminActionContext, query?: { list?: AdminListQuery; filters?: AdminOrdersQueryFilters; includeCounts?: boolean }) {
  assertAdminActionContext(context);
  if (query?.list) {
    const result = await searchManagerOrders(database, query.list, query.filters);
    if (!query.includeCounts) return result;
    const all = await listManagerOrdersWithPaymentSummary(database);
    const shop = await database.query.shops.findFirst({ where: (table, { eq }) => eq(table.id, context.shop.id), columns: { timezone: true } });
    const date = todayInTimezone(shop?.timezone ?? "Europe/Helsinki");
    const active = all.filter((order) => !order.archived);
    return { ...result, quickViewCounts: {
      TODAY: active.filter((order) => order.fulfillmentDate === date).length,
      TRIAGE: active.filter((order) => getOrderTriageReasons(order).length > 0).length,
      NEEDS_CONFIRMATION: active.filter((order) => order.status === "NEW").length,
      PICKUP_TODAY: active.filter((order) => order.fulfillmentDate === date && order.fulfillmentMethod === "PICKUP").length,
      DELIVERY_TODAY: active.filter((order) => order.fulfillmentDate === date && order.fulfillmentMethod === "DELIVERY").length,
      UNPAID: active.filter((order) => order.paymentStatus === "UNPAID").length,
      ALL: active.length,
      ARCHIVED: all.filter((order) => Boolean(order.archived)).length,
    } };
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
