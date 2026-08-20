import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, orderPayments, shopPaymentMethods } from "@/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "./errors";

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "MOBILEPAY", "CARD", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export async function listPaymentMethods(database: Database) {
  const rows = await database.select().from(shopPaymentMethods).where(eq(shopPaymentMethods.shopId, env().SHOP_ID));
  return PAYMENT_METHODS.map(
    (method) =>
      rows.find((row) => row.method === method) ?? {
        id: `default-${method}`,
        shopId: env().SHOP_ID,
        method,
        enabled: true,
        instructionsFi: null,
        instructionsEn: null,
        merchantDetailsJson: null,
        updatedAt: "default",
      },
  );
}

export async function assertPaymentMethodEnabled(database: { query: Database["query"] }, method: PaymentMethod) {
  const row = await database.query.shopPaymentMethods.findFirst({
    where: and(eq(shopPaymentMethods.shopId, env().SHOP_ID), eq(shopPaymentMethods.method, method)),
  });
  if (row && !row.enabled) throw new DomainError("PAYMENT_METHOD_DISABLED", "Payment method is disabled", 409);
}

export async function setPaymentMethod(
  database: Database,
  method: PaymentMethod,
  enabled: boolean,
  actor: string,
  extra?: { instructionsFi?: string; instructionsEn?: string; merchantDetailsJson?: string },
) {
  if (!enabled) {
    const active = (await listPaymentMethods(database)).filter((row) => row.enabled && row.method !== method);
    if (!active.length) throw new DomainError("VALIDATION_ERROR", "At least one payment method must remain enabled", 422);
  }
  const updatedAt = new Date().toISOString();
  await database
    .insert(shopPaymentMethods)
    .values({
      id: randomUUID(),
      shopId: env().SHOP_ID,
      method,
      enabled,
      instructionsFi: extra?.instructionsFi ?? null,
      instructionsEn: extra?.instructionsEn ?? null,
      merchantDetailsJson: extra?.merchantDetailsJson ?? null,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: [shopPaymentMethods.shopId, shopPaymentMethods.method],
      set: {
        enabled,
        instructionsFi: extra?.instructionsFi !== undefined ? extra.instructionsFi : shopPaymentMethods.instructionsFi,
        instructionsEn: extra?.instructionsEn !== undefined ? extra.instructionsEn : shopPaymentMethods.instructionsEn,
        merchantDetailsJson: extra?.merchantDetailsJson !== undefined ? extra.merchantDetailsJson : shopPaymentMethods.merchantDetailsJson,
        updatedAt,
      },
    });

  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId: env().SHOP_ID,
    actor,
    action: enabled ? "payment_method.enabled" : "payment_method.disabled",
    entityType: "shop_payment_method",
    entityId: method,
    detailsJson: JSON.stringify({ method, enabled, extra }),
    createdAt: updatedAt,
  });

  return (await listPaymentMethods(database)).find((row) => row.method === method)!;
}

export async function deletePaymentMethod(database: Database, method: string, actor: string) {
  if (!PAYMENT_METHODS.includes(method as PaymentMethod)) {
    throw new DomainError("VALIDATION_ERROR", "Unknown payment method", 422);
  }
  const paymentMethod = method as PaymentMethod;
  if (["CASH", "BANK_TRANSFER", "MOBILEPAY"].includes(method)) {
    throw new DomainError("FORBIDDEN", "System default payment methods cannot be deleted. Disable them instead.", 409);
  }

  // Check if any orders or payments use this method
  const row = await database.query.shopPaymentMethods.findFirst({
    where: and(eq(shopPaymentMethods.shopId, env().SHOP_ID), eq(shopPaymentMethods.method, paymentMethod)),
  });
  if (!row) throw new DomainError("NOT_FOUND", "Payment method not found", 404);

  const [{ count }] = await database
    .select({ count: sql<number>`count(*)` })
    .from(orderPayments)
    .where(and(eq(orderPayments.shopId, env().SHOP_ID), eq(orderPayments.method, paymentMethod)));

  if (Number(count) > 0) {
    throw new DomainError("CONFLICT", `Cannot delete payment method: used in ${count} historical orders. Disable it instead.`, 409);
  }

  await database
    .delete(shopPaymentMethods)
    .where(and(eq(shopPaymentMethods.shopId, env().SHOP_ID), eq(shopPaymentMethods.method, paymentMethod)));

  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId: env().SHOP_ID,
    actor,
    action: "payment_method.deleted",
    entityType: "shop_payment_method",
    entityId: method,
    detailsJson: JSON.stringify({ method }),
    createdAt: new Date().toISOString(),
  });

  return { deleted: true, method };
}
