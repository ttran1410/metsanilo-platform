import type { Database } from "@/db/client";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";
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
