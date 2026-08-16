import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, availability, customers, fulfillmentLocations, notifications, orderNotes, orderPayments, orders, outboxJobs, packages, products, shops } from "@/db/schema";
import { env } from "@/lib/env";
import { getLegalOrderTransitions } from "./order-transitions";
import { todayInTimezone } from "@/lib/format";
import { DomainError } from "./errors";
import { normalizeEmail, normalizeMobile, orderInputSchema, type OrderInput } from "./order-input";
import { assertPaymentMethodEnabled, type PaymentMethod } from "./payment-methods";

const nowIso = () => new Date().toISOString();
const publicReference = () => `R-${randomBytes(5).toString("hex").toUpperCase()}`;

export type OrderReceipt = {
  publicReference: string;
  status: "NEW" | "CONFIRMED" | "PICKING" | "READY" | "OUT_FOR_DELIVERY" | "PICKED_UP" | "DELIVERED" | "CUSTOMER_DECLINED" | "CANCELLED" | "CANCELLED_BY_CUSTOMER" | "REJECTED" | "NO_SHOW" | "REFUNDED";
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
      if (row.package.volumeMl !== 10000 && input.quantity !== 1) {
        throw new DomainError("INVALID_QUANTITY", "Only the 10 litre package supports a selectable quantity", 422);
      }
      const totalVolumeMl = row.package.volumeMl * input.quantity;
      const itemSubtotalCents = row.package.priceCents * input.quantity;

      const reserved = await tx
        .update(availability)
        .set({
          reservedMl: sql`${availability.reservedMl} + ${totalVolumeMl}`,
          version: sql`${availability.version} + 1`,
          updatedAt: nowIso(),
        })
        .where(
          and(
            eq(availability.id, current.id),
            eq(availability.shopId, SHOP_ID),
            eq(availability.acceptsOrders, true),
            eq(availability.manualSoldOut, false),
            gte(sql`${availability.capacityMl} - ${availability.reservedMl}`, totalVolumeMl),
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
      const configuredLocation = await tx.query.fulfillmentLocations.findFirst({ where: and(eq(fulfillmentLocations.shopId, SHOP_ID), eq(fulfillmentLocations.type, pickup ? "PICKUP" : "DELIVERY_ORIGIN"), eq(fulfillmentLocations.active, true), eq(fulfillmentLocations.isDefault, true)) });
      const locationSnapshot = configuredLocation ? JSON.stringify({ id: configuredLocation.id, type: configuredLocation.type, nameFi: configuredLocation.nameFi, nameEn: configuredLocation.nameEn, address: configuredLocation.address, instructionsFi: configuredLocation.instructionsFi, instructionsEn: configuredLocation.instructionsEn }) : null;
      const normalizedEmail = normalizeEmail(input.email);
      const mobileMatch = await tx.query.customers.findFirst({ where: and(eq(customers.shopId, SHOP_ID), eq(customers.mobile, mobile)) });
      const emailMatch = normalizedEmail ? await tx.query.customers.findFirst({ where: and(eq(customers.shopId, SHOP_ID), eq(customers.email, normalizedEmail)) }) : undefined;
      const conflict = Boolean(mobileMatch && emailMatch && mobileMatch.id !== emailMatch.id) || Boolean(mobileMatch && normalizedEmail && mobileMatch.email && mobileMatch.email !== normalizedEmail && !emailMatch);
      const consentGranted = input.marketingConsent === true;
      const customer = (conflict || (!mobileMatch && !emailMatch))
        ? { id: randomUUID(), shopId: SHOP_ID, name: input.customerName, mobile, email: normalizedEmail, matchStatus: conflict ? "CONFLICT_REVIEW" as const : "ACTIVE" as const, marketingConsent: consentGranted, marketingConsentStatus: consentGranted ? "CONSENTED" as const : "NOT_CONSENTED" as const, marketingConsentAt: consentGranted ? createdAt : null, marketingConsentSource: consentGranted ? "ORDER_FORM" as const : null, marketingConsentUpdatedBy: null, notes: conflict ? "Conflicting customer identifiers require staff review." : null, createdAt, updatedAt: createdAt }
        : { ...(mobileMatch ?? emailMatch!), name: input.customerName, email: normalizedEmail ?? (mobileMatch ?? emailMatch)!.email, ...(consentGranted ? { marketingConsent: true, marketingConsentStatus: "CONSENTED" as const, marketingConsentAt: createdAt, marketingConsentSource: "ORDER_FORM" as const, marketingConsentUpdatedBy: null } : {}), updatedAt: createdAt };
      if (conflict || (!mobileMatch && !emailMatch)) await tx.insert(customers).values(customer);
      else await tx.update(customers).set({ name: customer.name, email: customer.email, updatedAt: createdAt }).where(eq(customers.id, customer.id));
      const created = {
        id: orderId,
        shopId: SHOP_ID,
        publicReference: reference,
        idempotencyKey: input.idempotencyKey,
        productId: row.product.id,
        customerId: customer.id,
        packageId: row.package.id,
        productNameFi: row.product.nameFi,
        productNameEn: row.product.nameEn,
        packageLabelFi: row.package.labelFi,
        packageLabelEn: row.package.labelEn,
        quantity: input.quantity,
        volumeMl: totalVolumeMl,
        itemSubtotalCents,
        deliveryFeeCents: pickup ? 0 : null,
        finalTotalCents: pickup ? itemSubtotalCents : null,
        fulfillmentDate: input.fulfillmentDate,
        fulfillmentMethod: input.fulfillmentMethod,
        customerName: input.customerName,
        mobile,
        email: normalizedEmail,
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
        pickupLocationSnapshotJson: pickup ? locationSnapshot : null,
        deliveryOriginSnapshotJson: pickup ? null : locationSnapshot,
        notes: input.notes || null,
        facebookProfile: input.facebookProfile?.trim() || null,
        orderSource: "WEBSITE",

        historicalEntry: false,
        statusReason: null,
        contactedAt: null,
        contactedBy: null,
        contactChannel: null,
        fulfillmentStartedAt: null,
        readyAt: null,
        dispatchedAt: null,
        completedAt: null,
        pickupConfirmedAt: null,
        pickupConfirmedBy: null,
        locale: input.locale,
        status: "NEW" as const,
        archived: false,
        archivedAt: null,
        archivedBy: null,
        version: 1,
        createdAt,
        updatedAt: createdAt,
      };
      await tx.insert(orders).values(created);
      await tx.insert(notifications).values({ id: randomUUID(), shopId: SHOP_ID, eventKey: `order:${orderId}:new:v1`, category: "NEW_ORDER", title: "New order", body: `Order ${reference} is waiting for review.`, orderId, createdAt }).onConflictDoNothing({ target: [notifications.shopId, notifications.eventKey] });
      await tx.insert(outboxJobs).values({ id: randomUUID(), shopId: SHOP_ID, eventKey: `order:${orderId}:new:v1`, type: "NOTIFICATION", payloadJson: JSON.stringify({ category: "NEW_ORDER", orderId, reference }), status: "PENDING", scheduledFor: createdAt, attempts: 0, createdAt }).onConflictDoNothing({ target: [outboxJobs.shopId, outboxJobs.eventKey] });
      await tx.insert(auditEntries).values([
        {
          id: randomUUID(),
          shopId: SHOP_ID,
          actor: "public",
          action: "order.created",
          entityType: "order",
          entityId: orderId,
          detailsJson: JSON.stringify({ reference, status: "NEW", quantity: input.quantity, volumeMl: totalVolumeMl }),
          createdAt,
        },
        {
          id: randomUUID(),
          shopId: SHOP_ID,
          actor: "public",
          action: "capacity.reserved",
          entityType: "availability",
          entityId: current.id,
          detailsJson: JSON.stringify({ orderId, quantity: input.quantity, volumeMl: totalVolumeMl }),
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

export async function listManagerOrdersWithPaymentSummary(database: Database) {
  const rows = await listManagerOrders(database);
  const payments = await database.select().from(orderPayments).where(eq(orderPayments.shopId, env().SHOP_ID));
  const byOrder = new Map<string, number>();
  for (const payment of payments) if (payment.kind === "PAYMENT") byOrder.set(payment.orderId, (byOrder.get(payment.orderId) ?? 0) + payment.amountCents);
  return rows.map((order) => {
    const paidCents = byOrder.get(order.id) ?? 0;
    const outstandingCents = order.finalTotalCents === null ? null : Math.max(0, order.finalTotalCents - paidCents);
    return { ...order, paidCents, outstandingCents, paymentStatus: outstandingCents === null ? "PENDING_FEE" : outstandingCents > 0 ? "UNPAID" : "PAID" };
  });
}

export async function getManagerOrder(database: Database, orderId: string) {
  const { SHOP_ID } = env();
  const order = await database.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.shopId, SHOP_ID)) });
  if (!order) throw new DomainError("NOT_FOUND", "Order not found", 404);
  const [notes, payments, audit] = await Promise.all([
    database.select().from(orderNotes).where(and(eq(orderNotes.orderId, orderId), eq(orderNotes.shopId, SHOP_ID))).orderBy(desc(orderNotes.createdAt)),
    database.select().from(orderPayments).where(and(eq(orderPayments.orderId, orderId), eq(orderPayments.shopId, SHOP_ID))).orderBy(desc(orderPayments.recordedAt)),
    database.select().from(auditEntries).where(and(eq(auditEntries.entityType, "order"), eq(auditEntries.entityId, orderId), eq(auditEntries.shopId, SHOP_ID))).orderBy(desc(auditEntries.createdAt)),
  ]);
  const paidCents = payments.filter((payment) => payment.kind === "PAYMENT").reduce((sum, payment) => sum + payment.amountCents, 0);
  const refundedCents = payments.filter((payment) => payment.kind === "REFUND").reduce((sum, payment) => sum + payment.amountCents, 0);
  const totalCents = order.finalTotalCents ?? 0;
  return { order, notes, payments, audit, paymentSummary: { paidCents, refundedCents, outstandingCents: Math.max(0, totalCents - paidCents + refundedCents), status: refundedCents >= totalCents && totalCents > 0 ? "REFUNDED" : refundedCents > 0 ? "PARTIALLY_REFUNDED" : paidCents >= totalCents && totalCents > 0 ? "PAID" : "PENDING" } };
}

const completedOrderStatuses = ["PICKED_UP", "DELIVERED", "CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW", "CUSTOMER_DECLINED", "REFUNDED"] as const;

export type ManagerOrderUpdate = {
  orderId: string;
  expectedVersion: number;
  productId?: string;
  packageId?: string;
  quantity?: number;
  fulfillmentDate?: string;
  fulfillmentMethod?: "PICKUP" | "DELIVERY";
  orderSource?: string;
  facebookProfile?: string | null;
  customerName?: string;
  mobile?: string;
  email?: string | null;
  streetAddress?: string | null;
  postalCode?: string | null;
  city?: string | null;
  deliveryFeeCents?: number | null;
  agreedItemSubtotalCents?: number;
  adjustmentReason?: string;
};

/** Update an open order while keeping catalog snapshots and capacity consistent. */
export async function updateManagerOrder(database: Database, input: ManagerOrderUpdate) {
  const { SHOP_ID } = env();
  return database.transaction(async (tx) => {
    const current = await tx.query.orders.findFirst({ where: and(eq(orders.id, input.orderId), eq(orders.shopId, SHOP_ID)) });
    if (!current) throw new DomainError("NOT_FOUND", "Order not found", 404);
    if (current.version !== input.expectedVersion) throw new DomainError("STALE_VERSION", "Order changed", 409);
    if ((completedOrderStatuses as readonly string[]).includes(current.status)) throw new DomainError("ORDER_LOCKED", "Completed or closed orders only allow notes, payment corrections, and refunds", 409);
    const productId = input.productId ?? current.productId;
    const packageId = input.packageId ?? current.packageId;
    const quantity = input.quantity ?? current.quantity;
    const fulfillmentDate = input.fulfillmentDate ?? current.fulfillmentDate;
    const fulfillmentMethod = input.fulfillmentMethod ?? current.fulfillmentMethod;
    const orderSource = input.orderSource ?? current.orderSource;
    const facebookProfile = input.facebookProfile === undefined ? current.facebookProfile : (input.facebookProfile?.trim() || null);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new DomainError("VALIDATION_ERROR", "Quantity must be between 1 and 100", 422);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fulfillmentDate)) throw new DomainError("VALIDATION_ERROR", "Fulfillment date is invalid", 422);
    const catalog = await tx.select({ product: products, package: packages, shop: shops }).from(products)
      .innerJoin(packages, and(eq(packages.id, packageId), eq(packages.productId, products.id), eq(packages.shopId, SHOP_ID)))
      .innerJoin(shops, and(eq(shops.id, SHOP_ID), eq(shops.id, products.shopId)))
      .where(and(eq(products.id, productId), eq(products.shopId, SHOP_ID))).limit(1);
    const row = catalog[0];
    if (!row || !row.product.active || !row.package.active) throw new DomainError("NOT_AVAILABLE", "Product or package is unavailable", 409);
    if (fulfillmentDate < row.product.availableFrom || fulfillmentDate > row.product.availableThrough || fulfillmentDate < todayInTimezone(row.shop.timezone)) throw new DomainError("DATE_CLOSED", "Fulfillment date is outside the product window", 409);
    if (row.package.volumeMl !== 10000 && quantity !== 1) throw new DomainError("INVALID_QUANTITY", "Only the 10 litre package supports multiple quantity", 422);
    const itemSubtotalCents = row.package.priceCents * quantity;
    const agreed = input.agreedItemSubtotalCents;
    if (agreed !== undefined && (!Number.isSafeInteger(agreed) || agreed < 0)) throw new DomainError("VALIDATION_ERROR", "Items price must be a non-negative amount", 422);
    const finalItemSubtotal = agreed ?? itemSubtotalCents;
    if (finalItemSubtotal !== itemSubtotalCents && (input.adjustmentReason ?? "").trim().length < 2) throw new DomainError("VALIDATION_ERROR", "Adjustment reason is required when changing the catalog price", 422);
    const deliveryFeeCents = fulfillmentMethod === "PICKUP" ? 0 : (input.deliveryFeeCents === undefined ? current.deliveryFeeCents : input.deliveryFeeCents);
    if (deliveryFeeCents !== null && (!Number.isSafeInteger(deliveryFeeCents) || deliveryFeeCents < 0)) throw new DomainError("VALIDATION_ERROR", "Delivery fee must be non-negative", 422);
    const finalTotalCents = deliveryFeeCents === null ? null : finalItemSubtotal + deliveryFeeCents;
    const totalVolumeMl = row.package.volumeMl * quantity;
    const capacityChanged = !current.historicalEntry && (current.productId !== productId || current.fulfillmentDate !== fulfillmentDate || current.volumeMl !== totalVolumeMl);
    const now = nowIso();
    if (capacityChanged) {
      const released = await tx.update(availability).set({ reservedMl: sql`${availability.reservedMl} - ${current.volumeMl}`, version: sql`${availability.version} + 1`, updatedAt: now }).where(and(eq(availability.shopId, SHOP_ID), eq(availability.productId, current.productId), eq(availability.businessDate, current.fulfillmentDate), gte(availability.reservedMl, current.volumeMl))).run();
      if (released.rowsAffected !== 1) throw new DomainError("CAPACITY_CHANGED", "The original capacity reservation is no longer available", 409);
      const target = await tx.query.availability.findFirst({ where: and(eq(availability.shopId, SHOP_ID), eq(availability.productId, productId), eq(availability.businessDate, fulfillmentDate)) });
      if (!target || !target.acceptsOrders || target.manualSoldOut || target.capacityMl - target.reservedMl < totalVolumeMl) throw new DomainError("CAPACITY_CHANGED", "Not enough capacity for the selected date", 409);
      const reserved = await tx.update(availability).set({ reservedMl: sql`${availability.reservedMl} + ${totalVolumeMl}`, version: sql`${availability.version} + 1`, updatedAt: now }).where(and(eq(availability.id, target.id), gte(sql`${availability.capacityMl} - ${availability.reservedMl}`, totalVolumeMl))).run();
      if (reserved.rowsAffected !== 1) throw new DomainError("CAPACITY_CHANGED", "Capacity changed while saving", 409);
    }
    const configuredLocation = await tx.query.fulfillmentLocations.findFirst({ where: and(eq(fulfillmentLocations.shopId, SHOP_ID), eq(fulfillmentLocations.type, fulfillmentMethod === "PICKUP" ? "PICKUP" : "DELIVERY_ORIGIN"), eq(fulfillmentLocations.active, true), eq(fulfillmentLocations.isDefault, true)) });
    const locationSnapshot = configuredLocation ? JSON.stringify({ id: configuredLocation.id, type: configuredLocation.type, nameFi: configuredLocation.nameFi, nameEn: configuredLocation.nameEn, address: configuredLocation.address, instructionsFi: configuredLocation.instructionsFi, instructionsEn: configuredLocation.instructionsEn }) : null;
    let mobile = current.mobile;
    if (input.mobile !== undefined) {
      try { mobile = normalizeMobile(input.mobile); } catch { throw new DomainError("VALIDATION_ERROR", "Invalid phone", 422, { mobile: "INVALID_PHONE" }); }
    }
    const email = input.email === undefined ? current.email : normalizeEmail(input.email);
    const customerName = input.customerName?.trim() || current.customerName;
    const changed = await tx.update(orders).set({ productId, packageId, productNameFi: row.product.nameFi, productNameEn: row.product.nameEn, packageLabelFi: row.package.labelFi, packageLabelEn: row.package.labelEn, quantity, volumeMl: totalVolumeMl, itemSubtotalCents: finalItemSubtotal, deliveryFeeCents, finalTotalCents, fulfillmentDate, fulfillmentMethod, orderSource, facebookProfile, customerName, mobile, email, streetAddress: input.streetAddress === undefined ? current.streetAddress : input.streetAddress?.trim() || null, postalCode: input.postalCode === undefined ? current.postalCode : input.postalCode?.trim() || null, city: input.city === undefined ? current.city : input.city?.trim() || null, pickupLocationSnapshotJson: fulfillmentMethod === "PICKUP" ? locationSnapshot : null, deliveryOriginSnapshotJson: fulfillmentMethod === "DELIVERY" ? locationSnapshot : null, version: sql`${orders.version} + 1`, updatedAt: now }).where(and(eq(orders.id, current.id), eq(orders.version, input.expectedVersion))).run();
    if (changed.rowsAffected !== 1) throw new DomainError("STALE_VERSION", "Order changed", 409);
    await tx.insert(auditEntries).values({ id: randomUUID(), shopId: SHOP_ID, actor: "manager", action: "order.updated", entityType: "order", entityId: current.id, detailsJson: JSON.stringify({ before: { productId: current.productId, packageId: current.packageId, quantity: current.quantity, fulfillmentDate: current.fulfillmentDate, fulfillmentMethod: current.fulfillmentMethod, itemSubtotalCents: current.itemSubtotalCents, deliveryFeeCents: current.deliveryFeeCents }, after: { productId, packageId, quantity, fulfillmentDate, fulfillmentMethod, itemSubtotalCents: finalItemSubtotal, deliveryFeeCents }, adjustmentReason: input.adjustmentReason?.trim() || null, capacityChanged }), createdAt: now });
    return { ...current, productId, packageId, productNameFi: row.product.nameFi, productNameEn: row.product.nameEn, packageLabelFi: row.package.labelFi, packageLabelEn: row.package.labelEn, quantity, volumeMl: totalVolumeMl, itemSubtotalCents: finalItemSubtotal, deliveryFeeCents, finalTotalCents, fulfillmentDate, fulfillmentMethod, orderSource, facebookProfile, customerName, mobile, email, streetAddress: input.streetAddress === undefined ? current.streetAddress : input.streetAddress?.trim() || null, postalCode: input.postalCode === undefined ? current.postalCode : input.postalCode?.trim() || null, city: input.city === undefined ? current.city : input.city?.trim() || null, pickupLocationSnapshotJson: fulfillmentMethod === "PICKUP" ? locationSnapshot : null, deliveryOriginSnapshotJson: fulfillmentMethod === "DELIVERY" ? locationSnapshot : null, version: current.version + 1, updatedAt: now };
  });
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

export async function addDeliveryException(database: Database, input: { orderId: string; type: string; nextAction: string; note?: string; rescheduledDate?: string }) {
  const { SHOP_ID } = env();
  const allowed = ["CUSTOMER_UNAVAILABLE", "ADDRESS_ISSUE", "DELIVERY_DELAYED", "DELIVERY_FAILED", "RESCHEDULED"];
  if (!allowed.includes(input.type) || input.nextAction.trim().length < 1 || input.nextAction.length > 120) throw new DomainError("VALIDATION_ERROR", "Invalid delivery exception", 422);
  const order = await database.query.orders.findFirst({ where: and(eq(orders.id, input.orderId), eq(orders.shopId, SHOP_ID)) });
  if (!order || order.fulfillmentMethod !== "DELIVERY") throw new DomainError("NOT_FOUND", "Delivery order not found", 404);
  const createdAt = nowIso();
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: SHOP_ID, actor: "manager", action: `order.delivery_exception.${input.type.toLowerCase()}`, entityType: "order", entityId: order.id, detailsJson: JSON.stringify({ type: input.type, nextAction: input.nextAction.trim(), note: input.note?.trim() || null, rescheduledDate: input.rescheduledDate || null }), createdAt });
  return { createdAt, type: input.type, nextAction: input.nextAction.trim(), note: input.note?.trim() || null, rescheduledDate: input.rescheduledDate || null };
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

export async function recordPayment(database: Database, input: { orderId: string; amountCents: number; method: PaymentMethod; reference?: string }) {
  const { SHOP_ID } = env();
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new DomainError("VALIDATION_ERROR", "Payment amount must be positive cents", 422);
  return database.transaction(async (tx) => {
    await assertPaymentMethodEnabled(tx, input.method);
    const order = await tx.query.orders.findFirst({ where: and(eq(orders.id, input.orderId), eq(orders.shopId, SHOP_ID)) });
    if (!order) throw new DomainError("NOT_FOUND", "Order not found", 404);
    if (order.status === "CANCELLED") throw new DomainError("INVALID_ORDER", "Cancelled order cannot be paid", 409);
    if (order.finalTotalCents === null) throw new DomainError("DELIVERY_FEE_PENDING", "Set the delivery fee before recording payment", 409);
    let effectiveTotalCents = order.finalTotalCents;
    if (order.historicalEntry && effectiveTotalCents === 0) {
      const packageRow = await tx.query.packages.findFirst({ where: and(eq(packages.id, order.packageId), eq(packages.shopId, SHOP_ID)) });
      if (packageRow) {
        effectiveTotalCents = packageRow.priceCents * order.quantity;
        await tx.update(orders).set({ itemSubtotalCents: effectiveTotalCents, finalTotalCents: effectiveTotalCents, updatedAt: nowIso() }).where(eq(orders.id, order.id));
      }
    }
    const previous = await tx.select().from(orderPayments).where(and(eq(orderPayments.orderId, order.id), eq(orderPayments.shopId, SHOP_ID)));
    const paidCents = previous.filter((payment) => payment.kind === "PAYMENT").reduce((sum, payment) => sum + payment.amountCents, 0);
    if (paidCents + input.amountCents > effectiveTotalCents) throw new DomainError("PAYMENT_EXCEEDS_TOTAL", "Payment exceeds order total", 409);
    const id = randomUUID(); const recordedAt = nowIso();
    await tx.insert(orderPayments).values({ id, shopId: SHOP_ID, orderId: order.id, amountCents: input.amountCents, kind: "PAYMENT", method: input.method, reference: input.reference?.trim() || null, recordedAt, actor: "manager" });
    await tx.insert(auditEntries).values({ id: randomUUID(), shopId: SHOP_ID, actor: "manager", action: "order.payment_recorded", entityType: "order", entityId: order.id, detailsJson: JSON.stringify({ paymentId: id, amountCents: input.amountCents, method: input.method }), createdAt: recordedAt });
    return (await tx.query.orderPayments.findFirst({ where: eq(orderPayments.id, id) }))!;
  });
}

export async function recordRefund(database: Database, input: { orderId: string; amountCents: number; method: PaymentMethod; reason: string }) {
  const { SHOP_ID } = env();
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 || input.reason.trim().length < 2) throw new DomainError("VALIDATION_ERROR", "Refund amount and reason are required", 422);
  return database.transaction(async (tx) => {
    await assertPaymentMethodEnabled(tx, input.method);
    const order = await tx.query.orders.findFirst({ where: and(eq(orders.id, input.orderId), eq(orders.shopId, SHOP_ID)) });
    if (!order) throw new DomainError("NOT_FOUND", "Order not found", 404);
    if (!["PICKED_UP", "DELIVERED", "REFUNDED"].includes(order.status)) throw new DomainError("INVALID_ORDER", "Only completed orders can be refunded", 409);
    if (order.finalTotalCents === null) throw new DomainError("INVALID_ORDER", "Order total is unresolved", 409);
    const payments = await tx.select().from(orderPayments).where(and(eq(orderPayments.orderId, order.id), eq(orderPayments.shopId, SHOP_ID)));
    const paidCents = payments.filter((payment) => payment.kind === "PAYMENT").reduce((sum, payment) => sum + payment.amountCents, 0);
    const refundedCents = payments.filter((payment) => payment.kind === "REFUND").reduce((sum, payment) => sum + payment.amountCents, 0);
    if (refundedCents + input.amountCents > paidCents) throw new DomainError("REFUND_EXCEEDS_PAID", "Refund exceeds paid amount", 409);
    const id = randomUUID(); const recordedAt = nowIso();
    await tx.insert(orderPayments).values({ id, shopId: SHOP_ID, orderId: order.id, amountCents: input.amountCents, kind: "REFUND", method: input.method, reference: input.reason.trim(), recordedAt, actor: "manager" });
    const fullyRefunded = refundedCents + input.amountCents >= paidCents;
    if (fullyRefunded && order.status !== "REFUNDED") await tx.update(orders).set({ status: "REFUNDED", statusReason: input.reason.trim(), version: sql`${orders.version} + 1`, updatedAt: recordedAt }).where(eq(orders.id, order.id));
    await tx.insert(auditEntries).values({ id: randomUUID(), shopId: SHOP_ID, actor: "manager", action: "order.refund_recorded", entityType: "order", entityId: order.id, detailsJson: JSON.stringify({ amountCents: input.amountCents, reason: input.reason.trim(), fullyRefunded }), createdAt: recordedAt });
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
  input: {
    orderId: string;
    status: "CONFIRMED" | "PICKING" | "READY" | "OUT_FOR_DELIVERY" | "PICKED_UP" | "DELIVERED" | "CUSTOMER_DECLINED" | "CANCELLED" | "CANCELLED_BY_CUSTOMER" | "REJECTED" | "NO_SHOW" | "REFUNDED";
    expectedVersion: number;
    reason?: string;
    contactChannel?: "PHONE" | "SMS" | "EMAIL" | "OTHER";
    actor?: "manager" | "system";
  },
) {
  const { SHOP_ID } = env();
  return database.transaction(async (tx) => {
    const current = await tx.query.orders.findFirst({
      where: and(eq(orders.id, input.orderId), eq(orders.shopId, SHOP_ID)),
    });
    if (!current) throw new DomainError("NOT_FOUND", "Order not found", 404);
    if (current.version !== input.expectedVersion) throw new DomainError("STALE_VERSION", "Order changed", 409);
    const legalTransition = getLegalOrderTransitions(current).find((transition) => transition.status === input.status);
    if (!legalTransition) throw new DomainError("INVALID_TRANSITION", `${current.status} cannot transition to ${input.status}`, 409);
    if (!legalTransition.available) throw new DomainError("DELIVERY_FEE_PENDING", legalTransition.blockedReason ?? "Order is not ready for handover", 409);
    const reason = input.reason?.trim() || "";
    if (legalTransition.requiresReason && reason.length < 2) throw new DomainError("VALIDATION_ERROR", "A reason is required for this transition", 422);
    const contactChannel = input.contactChannel ?? (input.status === "CONFIRMED" ? "PHONE" : undefined);
    const actor = input.actor ?? "manager";
    if (input.status === "PICKED_UP" && current.fulfillmentMethod !== "PICKUP") throw new DomainError("INVALID_TRANSITION", "Only pickup orders can be picked up", 409);
    if (input.status === "OUT_FOR_DELIVERY" && current.fulfillmentMethod !== "DELIVERY") throw new DomainError("INVALID_TRANSITION", "Only delivery orders can be dispatched", 409);
    if (input.status === "DELIVERED" && current.fulfillmentMethod !== "DELIVERY") throw new DomainError("INVALID_TRANSITION", "Only delivery orders can be delivered", 409);
    if (input.status === "PICKED_UP" && current.finalTotalCents === null) throw new DomainError("DELIVERY_FEE_PENDING", "Resolve the order total before handover", 409);
    if (input.status === "OUT_FOR_DELIVERY" && current.finalTotalCents === null) throw new DomainError("DELIVERY_FEE_PENDING", "Resolve the delivery fee before dispatch", 409);

    const now = nowIso();
    const releaseCapacity = ["CUSTOMER_DECLINED", "CANCELLED", "CANCELLED_BY_CUSTOMER"].includes(input.status) && ["NEW", "CONFIRMED"].includes(current.status);
    const completedAt = ["PICKED_UP", "DELIVERED"].includes(input.status) ? now : current.completedAt;
    const changed = await tx
      .update(orders)
      .set({
        status: input.status,
        statusReason: reason || null,
        contactedAt: input.status === "CONFIRMED" ? now : current.contactedAt,
        contactedBy: input.status === "CONFIRMED" ? actor : current.contactedBy,
        contactChannel: input.status === "CONFIRMED" ? contactChannel! : current.contactChannel,
        fulfillmentStartedAt: input.status === "PICKING" ? now : current.fulfillmentStartedAt,
        readyAt: input.status === "READY" ? now : current.readyAt,
        dispatchedAt: input.status === "OUT_FOR_DELIVERY" ? now : current.dispatchedAt,
        completedAt,
        pickupConfirmedAt: input.status === "PICKED_UP" ? now : current.pickupConfirmedAt,
        pickupConfirmedBy: input.status === "PICKED_UP" ? "manager" : current.pickupConfirmedBy,
        version: sql`${orders.version} + 1`, updatedAt: now,
      })
      .where(
        and(
          eq(orders.id, current.id),
          eq(orders.shopId, SHOP_ID),
          eq(orders.status, current.status),
          eq(orders.version, input.expectedVersion),
        ),
      )
      .run();
    if (changed.rowsAffected !== 1) throw new DomainError("STALE_VERSION", "Order changed", 409);

    if (releaseCapacity) {
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
        id: randomUUID(), shopId: SHOP_ID, actor, action: "capacity.released",
        entityType: "order", entityId: current.id,
        detailsJson: JSON.stringify({ volumeMl: current.volumeMl, reason }), createdAt: now,
      });
    }
    await tx.insert(auditEntries).values({
      id: randomUUID(), shopId: SHOP_ID, actor, action: "order.status_changed",
      entityType: "order", entityId: current.id,
      detailsJson: JSON.stringify({ from: current.status, to: input.status, reason, contactChannel }), createdAt: now,
    });
    return { ...current, status: input.status, statusReason: reason || null, contactedAt: input.status === "CONFIRMED" ? now : current.contactedAt, contactedBy: input.status === "CONFIRMED" ? actor : current.contactedBy, contactChannel: input.status === "CONFIRMED" ? contactChannel! : current.contactChannel, fulfillmentStartedAt: input.status === "PICKING" ? now : current.fulfillmentStartedAt, readyAt: input.status === "READY" ? now : current.readyAt, dispatchedAt: input.status === "OUT_FOR_DELIVERY" ? now : current.dispatchedAt, completedAt, pickupConfirmedAt: input.status === "PICKED_UP" ? now : current.pickupConfirmedAt, pickupConfirmedBy: input.status === "PICKED_UP" ? actor : current.pickupConfirmedBy, version: current.version + 1, updatedAt: now };
  });
}

export async function deleteManagerOrder(database: Database, orderId: string, actorEmail?: string) {
  const { SHOP_ID } = env();
  return database.transaction(async (tx) => {
    const current = await tx.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.shopId, SHOP_ID)),
    });
    if (!current) throw new DomainError("NOT_FOUND", "Order not found", 404);

    const payments = await tx.select().from(orderPayments).where(and(eq(orderPayments.shopId, SHOP_ID), eq(orderPayments.orderId, orderId)));
    const paidCents = payments.reduce((sum, p) => sum + (p.kind === "PAYMENT" ? p.amountCents : -p.amountCents), 0);
    if (paidCents > 0) {
      throw new DomainError("PAYMENT_EXISTS", `Cannot delete paid order ${current.publicReference}. Refund or cancel the order instead.`, 400);
    }

    if (["NEW", "CONFIRMED", "PICKING", "READY"].includes(current.status)) {
      await tx
        .update(availability)
        .set({
          reservedMl: sql`MAX(0, ${availability.reservedMl} - ${current.volumeMl})`,
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
    }

    if (current.customerId) {
      await tx
        .update(customers)
        .set({
          updatedAt: nowIso(),
        })
        .where(and(eq(customers.shopId, SHOP_ID), eq(customers.id, current.customerId)))
        .run();
    }

    await tx.delete(orderNotes).where(and(eq(orderNotes.shopId, SHOP_ID), eq(orderNotes.orderId, orderId))).run();
    await tx.delete(orderPayments).where(and(eq(orderPayments.shopId, SHOP_ID), eq(orderPayments.orderId, orderId))).run();
    await tx.delete(orders).where(and(eq(orders.id, orderId), eq(orders.shopId, SHOP_ID))).run();

    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId: SHOP_ID,
      actor: actorEmail || "ADMIN",
      action: "order.permanently_deleted",
      entityType: "order",
      entityId: orderId,
      detailsJson: JSON.stringify({ publicReference: current.publicReference, customerName: current.customerName, totalCents: current.finalTotalCents ?? current.itemSubtotalCents }),
      createdAt: nowIso(),
    });

    return { success: true, id: orderId, publicReference: current.publicReference };
  });
}

export async function archiveManagerOrder(database: Database, orderId: string, actorEmail?: string) {
  const { SHOP_ID } = env();
  return database.transaction(async (tx) => {
    const current = await tx.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.shopId, SHOP_ID)),
    });
    if (!current) throw new DomainError("NOT_FOUND", "Order not found", 404);

    if (["NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY"].includes(current.status)) {
      throw new DomainError(
        "INVALID_TRANSITION",
        `Order ${current.publicReference} is currently active in status ${current.status}. Complete or cancel the order before archiving.`,
        400
      );
    }

    const now = nowIso();
    await tx
      .update(orders)
      .set({
        archived: true,
        archivedAt: now,
        archivedBy: actorEmail || "MANAGER",
        updatedAt: now,
      })
      .where(and(eq(orders.id, orderId), eq(orders.shopId, SHOP_ID)))
      .run();

    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId: SHOP_ID,
      actor: actorEmail || "MANAGER",
      action: "order.archived",
      entityType: "order",
      entityId: orderId,
      detailsJson: JSON.stringify({ publicReference: current.publicReference, status: current.status }),
      createdAt: now,
    });

    return { success: true, id: orderId, publicReference: current.publicReference, archived: true };
  });
}

export async function unarchiveManagerOrder(database: Database, orderId: string, actorEmail?: string) {
  const { SHOP_ID } = env();
  return database.transaction(async (tx) => {
    const current = await tx.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.shopId, SHOP_ID)),
    });
    if (!current) throw new DomainError("NOT_FOUND", "Order not found", 404);

    const now = nowIso();
    await tx
      .update(orders)
      .set({
        archived: false,
        archivedAt: null,
        archivedBy: null,
        updatedAt: now,
      })
      .where(and(eq(orders.id, orderId), eq(orders.shopId, SHOP_ID)))
      .run();

    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId: SHOP_ID,
      actor: actorEmail || "MANAGER",
      action: "order.unarchived",
      entityType: "order",
      entityId: orderId,
      detailsJson: JSON.stringify({ publicReference: current.publicReference, status: current.status }),
      createdAt: now,
    });

    return { success: true, id: orderId, publicReference: current.publicReference, archived: false };
  });
}

