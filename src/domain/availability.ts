import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, lte, or, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, availability, mediaAttachments, mediaAssets, orders, packages, products, shops } from "@/db/schema";
import { DomainError } from "./errors";
import { env } from "@/lib/env";
import { todayInTimezone } from "@/lib/format";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

type PlanFrequency = "DAY" | "WEEK" | "MONTH" | "CUSTOM";

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

function planDates(input: { frequency: PlanFrequency; startDate: string; endDate: string; dates?: string[] }) {
  if (!datePattern.test(input.startDate) || !datePattern.test(input.endDate) || input.startDate > input.endDate) {
    throw new DomainError("VALIDATION_ERROR", "Planning dates are invalid", 422);
  }
  if (input.frequency === "CUSTOM") {
    const dates = [...new Set(input.dates ?? [])].sort();
    if (!dates.length || dates.some((date) => !datePattern.test(date) || date < input.startDate || date > input.endDate)) {
      throw new DomainError("VALIDATION_ERROR", "Custom dates must be valid and inside the planning window", 422);
    }
    return dates;
  }
  const dates: string[] = [];
  for (let cursor = input.startDate; cursor <= input.endDate;) {
    dates.push(cursor);
    cursor = input.frequency === "DAY" ? addDays(cursor, 1) : input.frequency === "WEEK" ? addDays(cursor, 7) : addMonths(cursor);
  }
  return dates;
}

export async function getPublicCatalog(database: Database) {
  const { SHOP_ID } = env();
  const shop = await database.query.shops.findFirst({
    where: and(eq(shops.id, SHOP_ID), eq(shops.active, true)),
  });
  if (!shop) return null;
  const today = todayInTimezone(shop.timezone);
  const rows = await database
    .select({ product: products, package: packages, availability })
    .from(products)
    .innerJoin(
      packages,
      and(eq(packages.productId, products.id), eq(packages.shopId, products.shopId)),
    )
    .leftJoin(availability, and(eq(availability.productId, products.id), eq(availability.shopId, products.shopId), gte(availability.businessDate, today)))
    .where(
      and(
        eq(products.shopId, SHOP_ID),
        eq(products.active, true),
        eq(packages.active, true),
        or(eq(products.showOnHomepage, true), eq(products.showOnReserve, true)),
        or(sql`${availability.id} IS NULL`, and(lte(products.availableFrom, availability.businessDate), gte(products.availableThrough, availability.businessDate))),
      ),
    )
    .orderBy(asc(availability.businessDate));
  const media = await database.select({ attachment: mediaAttachments, asset: mediaAssets }).from(mediaAttachments).innerJoin(mediaAssets, eq(mediaAssets.id, mediaAttachments.assetId)).where(and(eq(mediaAttachments.shopId, SHOP_ID), eq(mediaAssets.active, true))).orderBy(asc(mediaAttachments.sortOrder));
  return { shop, rows, media: media.map((row) => ({ ...row.asset, productId: row.attachment.productId, sortOrder: row.attachment.sortOrder, isPrimary: row.attachment.isPrimary })) };
}

export async function listManagerAvailability(database: Database) {
  const { SHOP_ID } = env();
  const shop = await database.query.shops.findFirst({ where: eq(shops.id, SHOP_ID) });
  if (!shop) return [];
  const today = todayInTimezone(shop.timezone);
  return database
    .select({ availability, product: products })
    .from(availability)
    .innerJoin(
      products,
      and(eq(products.id, availability.productId), eq(products.shopId, availability.shopId)),
    )
    .where(and(eq(availability.shopId, SHOP_ID), gte(availability.businessDate, today)))
    .orderBy(asc(availability.businessDate));
}

/**
 * Read model for the Operations availability workspace. This deliberately
 * composes the existing catalog, availability and order tables instead of
 * introducing a second source of truth for capacity.
 */
export async function getAvailabilityWorkspace(
  database: Database,
  options?: {
    startDate?: string;
    days?: number;
    productId?: string;
  }
) {
  const { SHOP_ID } = env();
  const shop = await database.query.shops.findFirst({ where: eq(shops.id, SHOP_ID) });
  if (!shop) return { dates: [], rows: [], products: [], queues: { picking: [], pickup: [], delivery: [] }, ordersByDate: {} };

  const today = todayInTimezone(shop.timezone);
  const start = options?.startDate && datePattern.test(options.startDate) ? options.startDate : today;
  const numDays = Math.max(1, Math.min(60, options?.days ?? 7));
  const dates = Array.from({ length: numDays }, (_, index) => addDays(start, index));
  const endDate = dates[dates.length - 1];

  const [productRows, packageRows, availabilityRows, orderRows] = await Promise.all([
    database.select().from(products).where(eq(products.shopId, SHOP_ID)),
    database.select().from(packages).where(eq(packages.shopId, SHOP_ID)),
    database.select().from(availability).where(and(eq(availability.shopId, SHOP_ID), gte(availability.businessDate, start), lte(availability.businessDate, endDate))),
    database.select().from(orders).where(and(eq(orders.shopId, SHOP_ID), gte(orders.fulfillmentDate, start), lte(orders.fulfillmentDate, endDate))),
  ]);

  const packageByProduct = new Map<string, typeof packageRows>();
  for (const item of packageRows) packageByProduct.set(item.productId, [...(packageByProduct.get(item.productId) ?? []), item]);
  const productById = new Map(productRows.map((item) => [item.id, item]));

  const rows = availabilityRows
    .map((item) => {
      const productPackages = (packageByProduct.get(item.productId) ?? []).filter((pkg) => pkg.active).sort((a, b) => b.volumeMl - a.volumeMl);
      const largestPackageMl = productPackages[0]?.volumeMl ?? 0;
      const remainingMl = Math.max(0, item.capacityMl - item.reservedMl);
      return {
        availability: item,
        product: productById.get(item.productId)!,
        remainingMl,
        utilization: item.capacityMl > 0 ? Math.round((item.reservedMl / item.capacityMl) * 100) : 0,
        nearCapacity: remainingMl <= item.capacityMl * 0.2 || (largestPackageMl > 0 && remainingMl < largestPackageMl),
        soldOut: item.manualSoldOut || !item.acceptsOrders || remainingMl <= 0,
        packages: productPackages.map((pkg) => ({ id: pkg.id, labelFi: pkg.labelFi, labelEn: pkg.labelEn, volumeMl: pkg.volumeMl, active: pkg.active, isDefault: pkg.isDefault, availableUnits: pkg.volumeMl > 0 ? Math.floor(remainingMl / pkg.volumeMl) : 0 })),
      };
    })
    .filter((row) => row.product && (!options?.productId || options.productId === "ALL" || row.product.id === options.productId));

  // Build per-date orders breakdown map
  const ordersByDate: Record<
    string,
    {
      pickupVolumeMl: number;
      pickupCount: number;
      deliveryVolumeMl: number;
      deliveryCount: number;
      totalRevenueCents: number;
      orders: Array<{
        id: string;
        publicReference: string;
        customerName: string;
        mobile: string | null;
        productId: string;
        productNameFi: string;
        packageLabelFi: string;
        volumeMl: number;
        priceCents: number;
        status: string;
        fulfillmentMethod: "PICKUP" | "DELIVERY";
      }>;
    }
  > = {};

  for (const date of dates) {
    ordersByDate[date] = {
      pickupVolumeMl: 0,
      pickupCount: 0,
      deliveryVolumeMl: 0,
      deliveryCount: 0,
      totalRevenueCents: 0,
      orders: [],
    };
  }

  for (const order of orderRows) {
    const entry = ordersByDate[order.fulfillmentDate];
    if (entry && (!options?.productId || options.productId === "ALL" || order.productId === options.productId)) {
      if (order.fulfillmentMethod === "PICKUP") {
        entry.pickupVolumeMl += order.volumeMl;
        entry.pickupCount += 1;
      } else {
        entry.deliveryVolumeMl += order.volumeMl;
        entry.deliveryCount += 1;
      }
      entry.totalRevenueCents += order.finalTotalCents ?? order.itemSubtotalCents;
      entry.orders.push({
        id: order.id,
        publicReference: order.publicReference,
        customerName: order.customerName,
        mobile: order.mobile,
        productId: order.productId,
        productNameFi: order.productNameFi,
        packageLabelFi: order.packageLabelFi,
        volumeMl: order.volumeMl,
        priceCents: order.finalTotalCents ?? order.itemSubtotalCents,
        status: order.status,
        fulfillmentMethod: order.fulfillmentMethod,
      });
    }
  }

  const queueOrder = (order: typeof orderRows[number]) => ({
    id: order.id,
    publicReference: order.publicReference,
    customerName: order.customerName,
    productNameFi: order.productNameFi,
    packageLabelFi: order.packageLabelFi,
    fulfillmentDate: order.fulfillmentDate,
    fulfillmentMethod: order.fulfillmentMethod,
    status: order.status,
    quantity: order.quantity,
  });

  return {
    startDate: start,
    endDate,
    dates,
    rows,
    products: productRows
      .filter((product) => product.active || rows.some((row) => row.product.id === product.id))
      .map((product) => ({ id: product.id, nameFi: product.nameFi, nameEn: product.nameEn, active: product.active, showOnHomepage: product.showOnHomepage, showOnReserve: product.showOnReserve })),
    ordersByDate,
    queues: {
      picking: orderRows.filter((order) => order.status === "CONFIRMED" || order.status === "PICKING").map(queueOrder),
      pickup: orderRows.filter((order) => order.status === "READY" && order.fulfillmentMethod === "PICKUP").map(queueOrder),
      delivery: orderRows.filter((order) => (order.status === "READY" || order.status === "OUT_FOR_DELIVERY") && order.fulfillmentMethod === "DELIVERY").map(queueOrder),
    },
  };
}


export type AvailabilityWorkspace = Awaited<ReturnType<typeof getAvailabilityWorkspace>>;

export async function updateAvailability(
  database: Database,
  input: {
    id: string;
    expectedVersion: number;
    capacityMl: number;
    manualSoldOut: boolean;
    soldOutReason?: string;
  },
) {
  const { SHOP_ID } = env();
  if (!Number.isInteger(input.capacityMl) || input.capacityMl < 0) {
    throw new DomainError("VALIDATION_ERROR", "Capacity must be non-negative millilitres", 422);
  }
  if (input.manualSoldOut && (!input.soldOutReason || input.soldOutReason.trim().length < 2)) {
    throw new DomainError("VALIDATION_ERROR", "Sold-out reason is required", 422);
  }

  return database.transaction(async (tx) => {
    const row = await tx
      .select({ availability, product: products, shop: shops })
      .from(availability)
      .innerJoin(
        products,
        and(eq(products.id, availability.productId), eq(products.shopId, availability.shopId)),
      )
      .innerJoin(shops, eq(shops.id, availability.shopId))
      .where(and(eq(availability.id, input.id), eq(availability.shopId, SHOP_ID)))
      .limit(1);
    const current = row[0];
    if (!current) throw new DomainError("NOT_FOUND", "Availability not found", 404);
    if (current.availability.version !== input.expectedVersion) {
      throw new DomainError("STALE_VERSION", "Availability changed", 409);
    }
    if (current.availability.businessDate < todayInTimezone(current.shop.timezone)) {
      throw new DomainError("HISTORICAL_DATE", "Historical availability cannot be edited", 409);
    }
    if (
      current.availability.businessDate < current.product.availableFrom ||
      current.availability.businessDate > current.product.availableThrough
    ) {
      throw new DomainError("OUTSIDE_PRODUCT_WINDOW", "Date is outside the product window", 409);
    }
    if (input.capacityMl < current.availability.reservedMl) {
      throw new DomainError("BELOW_RESERVED", "Capacity cannot be below reserved volume", 409);
    }

    const updatedAt = new Date().toISOString();
    const changed = await tx
      .update(availability)
      .set({
        capacityMl: input.capacityMl,
        manualSoldOut: input.manualSoldOut,
        manualSoldOutReason: input.manualSoldOut ? input.soldOutReason!.trim() : null,
        version: sql`${availability.version} + 1`,
        updatedAt,
      })
      .where(
        and(
          eq(availability.id, input.id),
          eq(availability.shopId, SHOP_ID),
          eq(availability.version, input.expectedVersion),
        ),
      )
      .run();
    if (changed.rowsAffected !== 1) throw new DomainError("STALE_VERSION", "Availability changed", 409);

    const audits = [
      {
        id: randomUUID(), shopId: SHOP_ID, actor: "manager", action: "capacity.updated",
        entityType: "availability", entityId: input.id,
        detailsJson: JSON.stringify({ fromMl: current.availability.capacityMl, toMl: input.capacityMl }),
        createdAt: updatedAt,
      },
    ];
    if (current.availability.manualSoldOut !== input.manualSoldOut) {
      audits.push({
        id: randomUUID(), shopId: SHOP_ID, actor: "manager",
        action: input.manualSoldOut ? "sold_out.set" : "sold_out.cleared",
        entityType: "availability", entityId: input.id,
        detailsJson: JSON.stringify(input.manualSoldOut ? { reason: input.soldOutReason!.trim() } : {}),
        createdAt: updatedAt,
      });
    }
    await tx.insert(auditEntries).values(audits);
    return {
      ...current.availability,
      capacityMl: input.capacityMl,
      manualSoldOut: input.manualSoldOut,
      manualSoldOutReason: input.manualSoldOut ? input.soldOutReason!.trim() : null,
      version: current.availability.version + 1,
      updatedAt,
    };
  });
}

export async function planAvailability(
  database: Database,
  input: {
    productId: string;
    frequency: PlanFrequency;
    startDate: string;
    endDate: string;
    dates?: string[];
    capacityMl: number;
    manualSoldOut: boolean;
    soldOutReason?: string;
  },
) {
  const { SHOP_ID } = env();
  if (!Number.isSafeInteger(input.capacityMl) || input.capacityMl < 0) {
    throw new DomainError("VALIDATION_ERROR", "Capacity must be non-negative millilitres", 422);
  }
  if (input.manualSoldOut && (!input.soldOutReason || input.soldOutReason.trim().length < 2)) {
    throw new DomainError("VALIDATION_ERROR", "Sold-out reason is required", 422);
  }
  const dates = planDates(input);
  return database.transaction(async (tx) => {
    const product = await tx.query.products.findFirst({ where: and(eq(products.id, input.productId), eq(products.shopId, SHOP_ID)) });
    const shop = await tx.query.shops.findFirst({ where: eq(shops.id, SHOP_ID) });
    if (!product || !shop) throw new DomainError("NOT_FOUND", "Product not found", 404);
    const today = todayInTimezone(shop.timezone);
    if (dates.some((date) => date < today)) throw new DomainError("HISTORICAL_DATE", "Historical availability cannot be edited", 409);
    if (dates.some((date) => date < product.availableFrom || date > product.availableThrough)) {
      throw new DomainError("OUTSIDE_PRODUCT_WINDOW", "A planning date is outside the product window", 409);
    }
    const now = new Date().toISOString();
    const soldOutReason = input.manualSoldOut ? input.soldOutReason!.trim() : null;
    const touched: string[] = [];
    for (const businessDate of dates) {
      const current = await tx.query.availability.findFirst({ where: and(eq(availability.shopId, SHOP_ID), eq(availability.productId, input.productId), eq(availability.businessDate, businessDate)) });
      if (current && input.capacityMl < current.reservedMl) {
        throw new DomainError("BELOW_RESERVED", `Capacity for ${businessDate} cannot be below reserved volume`, 409);
      }
      if (current) {
        const result = await tx.update(availability).set({ capacityMl: input.capacityMl, manualSoldOut: input.manualSoldOut, manualSoldOutReason: soldOutReason, version: sql`${availability.version} + 1`, updatedAt: now }).where(and(eq(availability.id, current.id), eq(availability.version, current.version))).run();
        if (result.rowsAffected !== 1) throw new DomainError("STALE_VERSION", `Availability changed for ${businessDate}`, 409);
        touched.push(current.id);
      } else {
        const id = `${SHOP_ID}:${input.productId}:${businessDate}`;
        await tx.insert(availability).values({ id, shopId: SHOP_ID, productId: input.productId, businessDate, capacityMl: input.capacityMl, reservedMl: 0, acceptsOrders: true, manualSoldOut: input.manualSoldOut, manualSoldOutReason: soldOutReason, version: 1, updatedAt: now });
        touched.push(id);
      }
    }
    await tx.insert(auditEntries).values({ id: randomUUID(), shopId: SHOP_ID, actor: "manager", action: "availability.planned", entityType: "product", entityId: input.productId, detailsJson: JSON.stringify({ frequency: input.frequency, dates, capacityMl: input.capacityMl, manualSoldOut: input.manualSoldOut }), createdAt: now });
    const rows = await tx.select().from(availability).where(and(eq(availability.shopId, SHOP_ID), eq(availability.productId, input.productId)));
    return rows.filter((row) => touched.includes(row.id));
  });
}
