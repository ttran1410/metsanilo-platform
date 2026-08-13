import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, availability, orderNotes, orderPayments, orders, packages, products, shops } from "@/db/schema";
import { env } from "@/lib/env";
import { todayInTimezone } from "@/lib/format";
import { DomainError } from "./errors";
import { normalizeMobile, orderInputSchema, type OrderInput } from "./order-input";

const nowIso = () => new Date().toISOString();
const publicReference = () => `R-${randomBytes(5).toString("hex").toUpperCase()}`;

export type OrderReceipt = {
  publicReference: string;
  status: "NEW" | "CONFIRMED" | "CANCELLED";
  locale: "fi" | "en";
  productName: string;
  packageLabel: string;
  volumeMl: number;
  itemSubtotalCents: number;
  deliveryFeeCents: number | null;
  finalTotalCents: number | null;
  fulfillmentDate: string;
  fulfillmentMethod: "PICKUP" | "DELIVERY";
  pickup?: { name: string; address: string; instructions: string; time: string };
  delivery?: { streetAddress: string; postalCode: string; city: string };
};

function toReceipt(order: typeof orders.$inferSelect): OrderReceipt {
  const locale = order.locale;
  return {
    publicReference: order.publicReference,
    status: order.status,
    locale,
    productName: locale === "fi" ? order.productNameFi : order.productNameEn,
    packageLabel: locale === "fi" ? order.packageLabelFi : order.packageLabelEn,
    volumeMl: order.volumeMl,
    itemSubtotalCents: order.itemSubtotalCents,
    deliveryFeeCents: order.deliveryFeeCents,
    finalTotalCents: order.finalTotalCents,
    fulfillmentDate: order.fulfillmentDate,
    fulfillmentMethod: order.fulfillmentMethod,
    ...(order.fulfillmentMethod === "PICKUP"
      ? {
          pickup: {
            name: order.pickupName!,
            address: order.pickupAddress!,
            instructions: order.pickupInstructions!,
            time: order.pickupTime!,
          },
        }
      : {
          delivery: {
            streetAddress: order.streetAddress!,
            postalCode: order.postalCode!,
            city: order.city!,
          },
        }),
  };
}

export async function submitOrder(database: Database, unknownInput: unknown, busyRetry = 0) {
  const parsed = orderInputSchema.safeParse(unknownInput);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(
      parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]),
    );
    throw new DomainError("VALIDATION_ERROR", "Invalid order request", 422, fieldErrors);
  }

  const input: OrderInput = parsed.data;
  let mobile: string;
  try {
    mobile = normalizeMobile(input.mobile);
  } catch {
    throw new DomainError("VALIDATION_ERROR", "Invalid phone", 422, { mobile: "INVALID_PHONE" });
  }

  const { SHOP_ID } = env();
  const prior = await database.query.orders.findFirst({
    where: and(eq(orders.shopId, SHOP_ID), eq(orders.idempotencyKey, input.idempotencyKey)),
  });
  if (prior) return toReceipt(prior);

  try {
    return await database.transaction(async (tx) => {
      const replay = await tx.query.orders.findFirst({
        where: and(eq(orders.shopId, SHOP_ID), eq(orders.idempotencyKey, input.idempotencyKey)),
      });
      if (replay) return toReceipt(replay);

      const catalog = await tx
        .select({ product: products, package: packages, shop: shops })
        .from(products)
        .innerJoin(
          packages,
          and(
            eq(packages.productId, products.id),
            eq(packages.shopId, products.shopId),
            eq(packages.id, input.packageId),
          ),
        )
        .innerJoin(shops, and(eq(shops.id, products.shopId), eq(shops.id, SHOP_ID)))
        .where(
          and(
            eq(products.id, input.productId),
            eq(products.shopId, SHOP_ID),
            eq(products.active, true),
            eq(packages.active, true),
            eq(shops.active, true),
          ),
        )
        .limit(1);

      const row = catalog[0];
      if (!row) throw new DomainError("NOT_AVAILABLE", "Product is unavailable", 404);
      const today = todayInTimezone(row.shop.timezone);
      if (
        input.fulfillmentDate < today ||
        input.fulfillmentDate < row.product.availableFrom ||
        input.fulfillmentDate > row.product.availableThrough
      ) {
        throw new DomainError("DATE_CLOSED", "Date is not orderable", 409);
      }

      const current = await tx.query.availability.findFirst({
        where: and(
          eq(availability.shopId, SHOP_ID),
          eq(availability.productId, input.productId),
          eq(availability.businessDate, input.fulfillmentDate),
        ),
      });
      if (!current || !current.acceptsOrders) {
        throw new DomainError("DATE_CLOSED", "Date is closed", 409);
      }
      if (current.manualSoldOut || current.capacityMl - current.reservedMl === 0) {
        throw new DomainError("SOLD_OUT", "Product is sold out", 409);
      }

      const reserved = await tx
        .update(availability)
        .set({
          reservedMl: sql`${availability.reservedMl} + ${row.package.volumeMl}`,
          version: sql`${availability.version} + 1`,
          updatedAt: nowIso(),
        })
        .where(
          and(
            eq(availability.id, current.id),
            eq(availability.shopId, SHOP_ID),
            eq(availability.acceptsOrders, true),
            eq(availability.manualSoldOut, false),
            gte(sql`${availability.capacityMl} - ${availability.reservedMl}`, row.package.volumeMl),
          ),
        )
        .run();

      if (reserved.rowsAffected !== 1) {
        throw new DomainError("CAPACITY_CHANGED", "Capacity changed", 409);
      }

      const createdAt = nowIso();
      const orderId = randomUUID();
      const reference = publicReference();
      const pickup = input.fulfillmentMethod === "PICKUP";
      const created = {
        id: orderId,
        shopId: SHOP_ID,
        publicReference: reference,
        idempotencyKey: input.idempotencyKey,
        productId: row.product.id,
        packageId: row.package.id,
        productNameFi: row.product.nameFi,
        productNameEn: row.product.nameEn,
        packageLabelFi: row.package.labelFi,
        packageLabelEn: row.package.labelEn,
        quantity: 1 as const,
        volumeMl: row.package.volumeMl,
        itemSubtotalCents: row.package.priceCents,
        deliveryFeeCents: pickup ? 0 : null,
        finalTotalCents: pickup ? row.package.priceCents : null,
        fulfillmentDate: input.fulfillmentDate,
        fulfillmentMethod: input.fulfillmentMethod,
        customerName: input.customerName,
        mobile,
        email: input.email?.toLowerCase() || null,
        streetAddress: pickup ? null : input.streetAddress!,
        postalCode: pickup ? null : input.postalCode!,
        city: pickup ? null : input.city!,
        pickupName: pickup ? (input.locale === "fi" ? row.shop.pickupNameFi : row.shop.pickupNameEn) : null,
        pickupAddress: pickup ? row.shop.pickupAddress : null,
        pickupInstructions: pickup
          ? input.locale === "fi"
            ? row.shop.pickupInstructionsFi
            : row.shop.pickupInstructionsEn
          : null,
        pickupTime: pickup ? row.shop.pickupTime : null,
        notes: input.notes || null,
        pickupConfirmedAt: null,
        pickupConfirmedBy: null,
        locale: input.locale,
        status: "NEW" as const,
        version: 1,
        createdAt,
        updatedAt: createdAt,
      };
      await tx.insert(orders).values(created);
      await tx.insert(auditEntries).values([
        {
          id: randomUUID(),
          shopId: SHOP_ID,
          actor: "public",
          action: "order.created",
          entityType: "order",
          entityId: orderId,
          detailsJson: JSON.stringify({ reference, status: "NEW", volumeMl: row.package.volumeMl }),
          createdAt,
        },
        {
          id: randomUUID(),
          shopId: SHOP_ID,
          actor: "public",
          action: "capacity.reserved",
          entityType: "availability",
          entityId: current.id,
          detailsJson: JSON.stringify({ orderId, volumeMl: row.package.volumeMl }),
          createdAt,
        },
      ]);
      return toReceipt(created);
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "SQLITE_BUSY"
    ) {
      if (busyRetry >= 4) throw new DomainError("CAPACITY_CHANGED", "Capacity changed", 409);
      await new Promise((resolve) => setTimeout(resolve, 15 * (busyRetry + 1)));
      return submitOrder(database, unknownInput, busyRetry + 1);
    }
    const replay = await database.query.orders.findFirst({
      where: and(eq(orders.shopId, SHOP_ID), eq(orders.idempotencyKey, input.idempotencyKey)),
    });
    if (replay) return toReceipt(replay);
    throw error;
  }
}

export async function listManagerOrders(database: Database) {
  const { SHOP_ID } = env();
  return database.select().from(orders).where(eq(orders.shopId, SHOP_ID)).orderBy(desc(orders.createdAt));
}

export async function getManagerOrder(database: Database, orderId: string) {
  const { SHOP_ID } = env();
  const order = await database.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.shopId, SHOP_ID)) });
  if (!order) throw new DomainError("NOT_FOUND", "Order not found", 404);
  const [notes, payments] = await Promise.all([
    database.select().from(orderNotes).where(and(eq(orderNotes.orderId, orderId), eq(orderNotes.shopId, SHOP_ID))).orderBy(desc(orderNotes.createdAt)),
    database.select().from(orderPayments).where(and(eq(orderPayments.orderId, orderId), eq(orderPayments.shopId, SHOP_ID))).orderBy(desc(orderPayments.recordedAt)),
  ]);
  return { order, notes, payments };
}

export async function addOrderNote(database: Database, input: { orderId: string; body: string }) {
  const { SHOP_ID } = env();
  const body = input.body.trim();
  if (body.length < 1 || body.length > 2000) throw new DomainError("VALIDATION_ERROR", "Note must be 1–2000 characters", 422);
  const order = await database.query.orders.findFirst({ where: and(eq(orders.id, input.orderId), eq(orders.shopId, SHOP_ID)) });
  if (!order) throw new DomainError("NOT_FOUND", "Order not found", 404);
  const id = randomUUID(); const createdAt = nowIso();
  await database.transaction(async (tx) => {
    await tx.insert(orderNotes).values({ id, shopId: SHOP_ID, orderId: input.orderId, body, actor: "manager", createdAt });
    await tx.insert(auditEntries).values({ id: randomUUID(), shopId: SHOP_ID, actor: "manager", action: "order.note_added", entityType: "order", entityId: input.orderId, detailsJson: JSON.stringify({ noteId: id }), createdAt });
  });
  return (await database.query.orderNotes.findFirst({ where: eq(orderNotes.id, id) }))!;
}

export async function setDeliveryFee(database: Database, input: { orderId: string; expectedVersion: number; deliveryFeeCents: number }) {
  const { SHOP_ID } = env();
  if (!Number.isSafeInteger(input.deliveryFeeCents) || input.deliveryFeeCents < 0) throw new DomainError("VALIDATION_ERROR", "Delivery fee must be non-negative cents", 422);
  return database.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({ where: and(eq(orders.id, input.orderId), eq(orders.shopId, SHOP_ID)) });
    if (!order) throw new DomainError("NOT_FOUND", "Order not found", 404);
    if (order.fulfillmentMethod !== "DELIVERY") throw new DomainError("INVALID_ORDER", "Delivery fee applies only to delivery orders", 409);
    if (order.status === "CANCELLED") throw new DomainError("INVALID_ORDER", "Cancelled order cannot be updated", 409);
    if (order.version !== input.expectedVersion) throw new DomainError("STALE_VERSION", "Order changed", 409);
    const finalTotalCents = order.itemSubtotalCents + input.deliveryFeeCents;
    const updatedAt = nowIso();
    const changed = await tx.update(orders).set({ deliveryFeeCents: input.deliveryFeeCents, finalTotalCents, version: sql`${orders.version} + 1`, updatedAt }).where(and(eq(orders.id, order.id), eq(orders.version, input.expectedVersion))).run();
    if (changed.rowsAffected !== 1) throw new DomainError("STALE_VERSION", "Order changed", 409);
    await tx.insert(auditEntries).values({ id: randomUUID(), shopId: SHOP_ID, actor: "manager", action: "order.delivery_fee_set", entityType: "order", entityId: order.id, detailsJson: JSON.stringify({ fromCents: order.deliveryFeeCents, toCents: input.deliveryFeeCents, finalTotalCents }), createdAt: updatedAt });
    return { ...order, deliveryFeeCents: input.deliveryFeeCents, finalTotalCents, version: order.version + 1, updatedAt };
  });
}

export async function recordPayment(database: Database, input: { orderId: string; amountCents: number; method: "CASH" | "BANK_TRANSFER" | "CARD" | "OTHER"; reference?: string }) {
  const { SHOP_ID } = env();
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new DomainError("VALIDATION_ERROR", "Payment amount must be positive cents", 422);
  return database.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({ where: and(eq(orders.id, input.orderId), eq(orders.shopId, SHOP_ID)) });
    if (!order) throw new DomainError("NOT_FOUND", "Order not found", 404);
    if (order.status === "CANCELLED") throw new DomainError("INVALID_ORDER", "Cancelled order cannot be paid", 409);
    if (order.finalTotalCents === null) throw new DomainError("DELIVERY_FEE_PENDING", "Set the delivery fee before recording payment", 409);
    const previous = await tx.select().from(orderPayments).where(and(eq(orderPayments.orderId, order.id), eq(orderPayments.shopId, SHOP_ID)));
    const paidCents = previous.reduce((sum, payment) => sum + payment.amountCents, 0);
    if (paidCents + input.amountCents > order.finalTotalCents) throw new DomainError("PAYMENT_EXCEEDS_TOTAL", "Payment exceeds order total", 409);
    const id = randomUUID(); const recordedAt = nowIso();
    await tx.insert(orderPayments).values({ id, shopId: SHOP_ID, orderId: order.id, amountCents: input.amountCents, method: input.method, reference: input.reference?.trim() || null, recordedAt, actor: "manager" });
    await tx.insert(auditEntries).values({ id: randomUUID(), shopId: SHOP_ID, actor: "manager", action: "order.payment_recorded", entityType: "order", entityId: order.id, detailsJson: JSON.stringify({ paymentId: id, amountCents: input.amountCents, method: input.method }), createdAt: recordedAt });
    return (await tx.query.orderPayments.findFirst({ where: eq(orderPayments.id, id) }))!;
  });
}

export async function confirmPickup(database: Database, input: { orderId: string; expectedVersion: number }) {
  const { SHOP_ID } = env();
  return database.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({ where: and(eq(orders.id, input.orderId), eq(orders.shopId, SHOP_ID)) });
    if (!order) throw new DomainError("NOT_FOUND", "Order not found", 404);
    if (order.fulfillmentMethod !== "PICKUP") throw new DomainError("INVALID_ORDER", "Only pickup orders can be confirmed as picked up", 409);
    if (order.status !== "CONFIRMED") throw new DomainError("INVALID_TRANSITION", "Order must be confirmed before pickup", 409);
    if (order.pickupConfirmedAt) throw new DomainError("INVALID_TRANSITION", "Pickup is already confirmed", 409);
    if (order.version !== input.expectedVersion) throw new DomainError("STALE_VERSION", "Order changed", 409);
    const confirmedAt = nowIso();
    const changed = await tx.update(orders).set({ pickupConfirmedAt: confirmedAt, pickupConfirmedBy: "manager", version: sql`${orders.version} + 1`, updatedAt: confirmedAt }).where(and(eq(orders.id, order.id), eq(orders.version, input.expectedVersion))).run();
    if (changed.rowsAffected !== 1) throw new DomainError("STALE_VERSION", "Order changed", 409);
    await tx.insert(auditEntries).values({ id: randomUUID(), shopId: SHOP_ID, actor: "manager", action: "order.pickup_confirmed", entityType: "order", entityId: order.id, detailsJson: JSON.stringify({ confirmedAt }), createdAt: confirmedAt });
    return { ...order, pickupConfirmedAt: confirmedAt, pickupConfirmedBy: "manager", version: order.version + 1, updatedAt: confirmedAt };
  });
}

export async function transitionOrder(
  database: Database,
  input: { orderId: string; status: "CONFIRMED" | "CANCELLED"; expectedVersion: number },
) {
  const { SHOP_ID } = env();
  return database.transaction(async (tx) => {
    const current = await tx.query.orders.findFirst({
      where: and(eq(orders.id, input.orderId), eq(orders.shopId, SHOP_ID)),
    });
    if (!current) throw new DomainError("NOT_FOUND", "Order not found", 404);
    if (current.version !== input.expectedVersion) throw new DomainError("STALE_VERSION", "Order changed", 409);
    if (current.status !== "NEW") throw new DomainError("INVALID_TRANSITION", "Order is no longer new", 409);

    const changed = await tx
      .update(orders)
      .set({ status: input.status, version: sql`${orders.version} + 1`, updatedAt: nowIso() })
      .where(
        and(
          eq(orders.id, current.id),
          eq(orders.shopId, SHOP_ID),
          eq(orders.status, "NEW"),
          eq(orders.version, input.expectedVersion),
        ),
      )
      .run();
    if (changed.rowsAffected !== 1) throw new DomainError("STALE_VERSION", "Order changed", 409);

    if (input.status === "CANCELLED") {
      const released = await tx
        .update(availability)
        .set({
          reservedMl: sql`${availability.reservedMl} - ${current.volumeMl}`,
          version: sql`${availability.version} + 1`,
          updatedAt: nowIso(),
        })
        .where(
          and(
            eq(availability.shopId, SHOP_ID),
            eq(availability.productId, current.productId),
            eq(availability.businessDate, current.fulfillmentDate),
            gte(availability.reservedMl, current.volumeMl),
          ),
        )
        .run();
      if (released.rowsAffected !== 1) throw new Error("Capacity release invariant failed");
      await tx.insert(auditEntries).values({
        id: randomUUID(), shopId: SHOP_ID, actor: "manager", action: "capacity.released",
        entityType: "order", entityId: current.id,
        detailsJson: JSON.stringify({ volumeMl: current.volumeMl }), createdAt: nowIso(),
      });
    }
    await tx.insert(auditEntries).values({
      id: randomUUID(), shopId: SHOP_ID, actor: "manager", action: "order.status_changed",
      entityType: "order", entityId: current.id,
      detailsJson: JSON.stringify({ from: current.status, to: input.status }), createdAt: nowIso(),
    });
    return { ...current, status: input.status, version: current.version + 1, updatedAt: nowIso() };
  });
}
