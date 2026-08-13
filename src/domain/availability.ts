import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, availability, packages, products, shops } from "@/db/schema";
import { DomainError } from "./errors";
import { env } from "@/lib/env";
import { todayInTimezone } from "@/lib/format";

export async function getPublicCatalog(database: Database) {
  const { SHOP_ID } = env();
  const shop = await database.query.shops.findFirst({
    where: and(eq(shops.id, SHOP_ID), eq(shops.active, true)),
  });
  if (!shop) return null;
  const today = todayInTimezone(shop.timezone);
  const rows = await database
    .select({ product: products, package: packages, availability })
    .from(availability)
    .innerJoin(
      products,
      and(eq(products.id, availability.productId), eq(products.shopId, availability.shopId)),
    )
    .innerJoin(
      packages,
      and(eq(packages.productId, products.id), eq(packages.shopId, products.shopId)),
    )
    .where(
      and(
        eq(availability.shopId, SHOP_ID),
        gte(availability.businessDate, today),
        lte(products.availableFrom, availability.businessDate),
        gte(products.availableThrough, availability.businessDate),
        eq(products.active, true),
        eq(packages.active, true),
      ),
    )
    .orderBy(asc(availability.businessDate));
  return { shop, rows };
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
