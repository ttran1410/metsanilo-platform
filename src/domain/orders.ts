import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, availability, orders, packages, products, shops } from "@/db/schema";
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
