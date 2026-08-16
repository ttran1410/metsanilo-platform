import { randomUUID } from "node:crypto";
import { and, desc, eq, like, ne, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, customers, orders } from "@/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "./errors";
import { normalizeEmail, normalizeMobile } from "./order-input";

export async function searchCustomers(database: Database, query: string) {
  const value = query.trim();
  if (value.length < 2) return [];
  let normalizedMobile = value;
  try {
    normalizedMobile = normalizeMobile(value);
  } catch {
    /* Search may be a name or email. */
  }
  return database
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.shopId, env().SHOP_ID),
        or(
          like(customers.mobile, `%${normalizedMobile}%`),
          like(customers.mobile, `%${value}%`),
          like(customers.email, `%${value.toLowerCase()}%`),
          like(customers.name, `%${value}%`)
        )
      )
    )
    .limit(25);
}

export async function listCustomers(database: Database) {
  const { SHOP_ID } = env();
  const rows = await database
    .select()
    .from(customers)
    .where(eq(customers.shopId, SHOP_ID))
    .orderBy(desc(customers.updatedAt))
    .limit(150);

  const customerOrders = await database
    .select({
      id: orders.id,
      customerId: orders.customerId,
      status: orders.status,
      volumeMl: orders.volumeMl,
      finalTotalCents: orders.finalTotalCents,
      itemSubtotalCents: orders.itemSubtotalCents,
      fulfillmentDate: orders.fulfillmentDate,
      fulfillmentMethod: orders.fulfillmentMethod,
    })
    .from(orders)
    .where(eq(orders.shopId, SHOP_ID));

  return rows.map((customer) => {
    const related = customerOrders.filter((order) => order.customerId === customer.id);
    const completed = related.filter(
      (o) => !["CANCELLED", "REJECTED", "NO_SHOW", "CUSTOMER_DECLINED"].includes(o.status)
    );
    const noShows = related.filter((o) => o.status === "NO_SHOW");

    const pickupCount = completed.filter((o) => o.fulfillmentMethod === "PICKUP").length;
    const deliveryCount = completed.filter((o) => o.fulfillmentMethod === "DELIVERY").length;
    const preferredMethod = deliveryCount > pickupCount ? "DELIVERY" : "PICKUP";

    const lifetimeLitres = completed.reduce((sum, order) => sum + order.volumeMl, 0);
    const totalSpendCents = completed.reduce(
      (sum, order) => sum + (order.finalTotalCents ?? order.itemSubtotalCents),
      0
    );

    const isVip = lifetimeLitres >= 20000; // >= 20 Litres
    const totalFinished = completed.length + noShows.length;
    const reliabilityRatePercent = totalFinished > 0 ? Math.round((completed.length / totalFinished) * 100) : 100;

    return {
      ...customer,
      metrics: {
        totalOrders: related.length,
        completedOrders: completed.length,
        noShowCount: noShows.length,
        reliabilityRatePercent,
        lifetimeLitres,
        totalSpendCents,
        lastFulfillmentDate: completed[0]?.fulfillmentDate ?? null,
        isVip,
        preferredMethod,
      },
    };
  });
}

export async function getCustomerProfile(database: Database, customerId: string) {
  const { SHOP_ID } = env();
  const customer = await database.query.customers.findFirst({
    where: and(eq(customers.id, customerId), eq(customers.shopId, SHOP_ID)),
  });
  if (!customer) return null;

  const customerOrders = await database
    .select({
      id: orders.id,
      publicReference: orders.publicReference,
      productId: orders.productId,
      productNameFi: orders.productNameFi,
      packageLabelFi: orders.packageLabelFi,
      status: orders.status,
      fulfillmentDate: orders.fulfillmentDate,
      fulfillmentMethod: orders.fulfillmentMethod,
      volumeMl: orders.volumeMl,
      finalTotalCents: orders.finalTotalCents,
      itemSubtotalCents: orders.itemSubtotalCents,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.shopId, SHOP_ID), eq(orders.customerId, customerId)))
    .orderBy(desc(orders.createdAt))
    .limit(100);

  // Other records with same phone number
  const identityConflicts = await database
    .select({
      id: customers.id,
      name: customers.name,
      mobile: customers.mobile,
      email: customers.email,
      notes: customers.notes,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .where(
      and(
        eq(customers.shopId, SHOP_ID),
        customer.mobile ? eq(customers.mobile, customer.mobile) : ne(customers.id, customerId),
        ne(customers.id, customerId)
      )
    )
    .limit(20);

  const audit = await database
    .select({
      id: auditEntries.id,
      action: auditEntries.action,
      actor: auditEntries.actor,
      detailsJson: auditEntries.detailsJson,
      createdAt: auditEntries.createdAt,
    })
    .from(auditEntries)
    .where(
      and(
        eq(auditEntries.shopId, SHOP_ID),
        eq(auditEntries.entityType, "customer"),
        eq(auditEntries.entityId, customerId)
      )
    )
    .orderBy(desc(auditEntries.createdAt))
    .limit(30);

  const completed = customerOrders.filter(
    (o) => !["CANCELLED", "REJECTED", "NO_SHOW", "CUSTOMER_DECLINED"].includes(o.status)
  );
  const noShows = customerOrders.filter((o) => o.status === "NO_SHOW");

  const pickupCount = completed.filter((o) => o.fulfillmentMethod === "PICKUP").length;
  const deliveryCount = completed.filter((o) => o.fulfillmentMethod === "DELIVERY").length;
  const preferredMethod = deliveryCount > pickupCount ? "DELIVERY" : "PICKUP";

  const lifetimeLitres = completed.reduce((sum, order) => sum + order.volumeMl, 0);
  const totalSpendCents = completed.reduce(
    (sum, order) => sum + (order.finalTotalCents ?? order.itemSubtotalCents),
    0
  );

  const isVip = lifetimeLitres >= 20000;
  const totalFinished = completed.length + noShows.length;
  const reliabilityRatePercent = totalFinished > 0 ? Math.round((completed.length / totalFinished) * 100) : 100;

  // Group orders by Harvest Season Year (e.g. Summer 2026, Summer 2025)
  const timelineByYear: Record<string, typeof customerOrders> = {};
  for (const order of customerOrders) {
    const year = order.fulfillmentDate ? order.fulfillmentDate.slice(0, 4) : order.createdAt.slice(0, 4);
    const seasonLabel = `Summer ${year}`;
    if (!timelineByYear[seasonLabel]) timelineByYear[seasonLabel] = [];
    timelineByYear[seasonLabel].push(order);
  }

  return {
    customer,
    orders: customerOrders,
    timelineByYear,
    audit,
    metrics: {
      lifetimeLitres,
      totalSpendCents,
      totalOrders: customerOrders.length,
      completedOrders: completed.length,
      noShowCount: noShows.length,
      reliabilityRatePercent,
      isVip,
      preferredMethod,
      lastFulfillmentDate: completed[0]?.fulfillmentDate ?? null,
    },
    identityConflicts,
  };
}

export async function createCustomer(
  database: Database,
  input: { name: string; mobile?: string | null; email?: string | null; facebookProfile?: string | null; notes?: string }
) {
  const { SHOP_ID } = env();
  let normalizedMobile: string | null = null;
  if (input.mobile && input.mobile.trim()) {
    try {
      normalizedMobile = normalizeMobile(input.mobile);
    } catch {
      throw new DomainError("VALIDATION_ERROR", "Invalid phone number", 422);
    }
  }

  const fbProfile = input.facebookProfile?.trim() || null;
  const email = input.email ? normalizeEmail(input.email) : null;

  if (!normalizedMobile && !fbProfile && !email) {
    throw new DomainError("VALIDATION_ERROR", "At least one contact method (Mobile Phone, Facebook, or Email) is required", 422);
  }

  const existing = normalizedMobile
    ? await database.query.customers.findFirst({ where: and(eq(customers.shopId, SHOP_ID), eq(customers.mobile, normalizedMobile)) })
    : fbProfile
    ? await database.query.customers.findFirst({ where: and(eq(customers.shopId, SHOP_ID), eq(customers.facebookProfile, fbProfile)) })
    : undefined;

  if (existing) {
    if (fbProfile && !existing.facebookProfile) {
      await database
        .update(customers)
        .set({ facebookProfile: fbProfile, updatedAt: new Date().toISOString() })
        .where(eq(customers.id, existing.id));
    }
    return (await database.query.customers.findFirst({ where: eq(customers.id, existing.id) }))!;
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  await database.insert(customers).values({
    id,
    shopId: SHOP_ID,
    name: input.name.trim(),
    mobile: normalizedMobile,
    email,
    matchStatus: "ACTIVE",
    facebookProfile: fbProfile,
    notes: input.notes?.trim() || null,
    createdAt: now,
    updatedAt: now,
  });

  return (await database.query.customers.findFirst({ where: eq(customers.id, id) }))!;
}

export async function updateCustomer(
  database: Database,
  customerId: string,
  input: { name?: string; mobile?: string | null; email?: string | null; facebookProfile?: string | null; notes?: string | null },
  actorEmail?: string
) {
  const { SHOP_ID } = env();
  const existing = await database.query.customers.findFirst({
    where: and(eq(customers.id, customerId), eq(customers.shopId, SHOP_ID)),
  });
  if (!existing) throw new DomainError("NOT_FOUND", "Customer not found", 404);

  const now = new Date().toISOString();
  let normalizedMobile = existing.mobile;
  if (input.mobile !== undefined) {
    if (input.mobile && input.mobile.trim()) {
      try {
        normalizedMobile = normalizeMobile(input.mobile);
      } catch {
        throw new DomainError("VALIDATION_ERROR", "Invalid phone number", 422);
      }
    } else {
      normalizedMobile = null;
    }
  }

  const email = input.email !== undefined ? (input.email ? normalizeEmail(input.email) : null) : existing.email;
  const facebookProfile = input.facebookProfile !== undefined ? (input.facebookProfile ? input.facebookProfile.trim() : null) : existing.facebookProfile;

  await database
    .update(customers)
    .set({
      name: input.name !== undefined ? input.name.trim() : existing.name,
      mobile: normalizedMobile,
      email,
      facebookProfile,
      notes: input.notes !== undefined ? (input.notes ? input.notes.trim() : null) : existing.notes,
      updatedAt: now,
    })
    .where(and(eq(customers.id, customerId), eq(customers.shopId, SHOP_ID)))
    .run();

  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId: SHOP_ID,
    actor: actorEmail || "ADMIN",
    action: "customer.updated",
    entityType: "customer",
    entityId: customerId,
    detailsJson: JSON.stringify({ name: input.name, mobile: normalizedMobile, email, facebookProfile }),
    createdAt: now,
  });

  return (await database.query.customers.findFirst({ where: eq(customers.id, customerId) }))!;
}

export async function mergeCustomers(
  database: Database,
  primaryId: string,
  duplicateId: string,
  actor: string
) {
  const { SHOP_ID } = env();

  return database.transaction(async (tx) => {
    const primary = await tx.query.customers.findFirst({
      where: and(eq(customers.id, primaryId), eq(customers.shopId, SHOP_ID)),
    });
    const duplicate = await tx.query.customers.findFirst({
      where: and(eq(customers.id, duplicateId), eq(customers.shopId, SHOP_ID)),
    });

    if (!primary || !duplicate) {
      throw new DomainError("NOT_FOUND", "One or both customer profiles not found", 404);
    }

    const now = new Date().toISOString();

    // Combine notes
    const combinedNotes = [primary.notes, duplicate.notes]
      .filter(Boolean)
      .join("\n---\nMerged Note: ");

    // Reassign duplicate orders to primary customer
    await tx
      .update(orders)
      .set({ customerId: primaryId })
      .where(and(eq(orders.shopId, SHOP_ID), eq(orders.customerId, duplicateId)))
      .run();

    // Update primary customer notes & matchStatus
    await tx
      .update(customers)
      .set({
        notes: combinedNotes || null,
        matchStatus: "ACTIVE",
        updatedAt: now,
      })
      .where(and(eq(customers.id, primaryId), eq(customers.shopId, SHOP_ID)))
      .run();

    // Delete duplicate customer record
    await tx
      .delete(customers)
      .where(and(eq(customers.id, duplicateId), eq(customers.shopId, SHOP_ID)))
      .run();

    // Audit log
    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId: SHOP_ID,
      actor,
      action: "customer.merged",
      entityType: "customer",
      entityId: primaryId,
      detailsJson: JSON.stringify({
        primaryId,
        mergedDuplicateId: duplicateId,
        mergedDuplicateName: duplicate.name,
      }),
      createdAt: now,
    });

    return (await tx.query.customers.findFirst({ where: eq(customers.id, primaryId) }))!;
  });
}
