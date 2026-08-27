import { randomUUID } from "node:crypto";
import { and, desc, eq, like, ne, or, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, customers, orders, reviews } from "@/db/schema";
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

export type ContactConfirmationChannel = "WHATSAPP" | "SMS" | "PHONE" | "OTHER" | "MIGRATION";

export async function confirmCustomerContact(
  database: Database,
  customerId: string,
  actor: string,
  channel: ContactConfirmationChannel,
  note?: string | null,
  now = new Date(),
) {
  const confirmedAt = now.toISOString();
  const expires = new Date(now);
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  const updated = await database.update(customers).set({
    contactConfirmedAt: confirmedAt,
    contactConfirmedBy: actor,
    contactConfirmationChannel: channel,
    contactConfirmationNote: note?.trim() || null,
    contactConfirmationExpiresAt: expires.toISOString(),
    updatedAt: confirmedAt,
  }).where(and(eq(customers.id, customerId), eq(customers.shopId, env().SHOP_ID))).run();
  if (updated.rowsAffected !== 1) throw new DomainError("NOT_FOUND", "Customer not found", 404);
  await database.insert(auditEntries).values({
    id: randomUUID(), shopId: env().SHOP_ID, actor, action: "customer.contact_confirmed",
    entityType: "customer", entityId: customerId,
    detailsJson: JSON.stringify({ channel, expiresAt: expires.toISOString(), note: note?.trim() || null }),
    createdAt: confirmedAt,
  });
  return { confirmedAt, expiresAt: expires.toISOString() };
}

export async function renewCustomerContact(database: Database, customerId: string, actor: string, now = new Date()) {
  const current = await database.query.customers.findFirst({ where: and(eq(customers.id, customerId), eq(customers.shopId, env().SHOP_ID)) });
  if (!current) throw new DomainError("NOT_FOUND", "Customer not found", 404);
  if (!current.contactConfirmationChannel || current.contactConfirmationChannel === "MIGRATION") throw new DomainError("VALIDATION_ERROR", "A verified contact channel is required before renewal", 422);
  return confirmCustomerContact(database, customerId, actor, current.contactConfirmationChannel as ContactConfirmationChannel, current.contactConfirmationNote, now);
}

export async function findRetentionEligibleCustomers(database: Database, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
  return database.all<{ customerId: string; lastOrderDate: string }>(sql`
    SELECT c.id as customerId, MAX(o.fulfillment_date) as lastOrderDate
    FROM customers c
    JOIN orders o ON o.customer_id = c.id AND o.shop_id = c.shop_id
    WHERE c.shop_id = ${env().SHOP_ID}
      AND o.status IN ('PICKED_UP', 'DELIVERED', 'CANCELLED', 'CANCELLED_BY_CUSTOMER', 'REJECTED', 'NO_SHOW', 'CUSTOMER_DECLINED', 'REFUNDED')
      AND (c.contact_confirmation_expires_at IS NULL OR c.contact_confirmation_expires_at <= ${now.toISOString()})
      AND (c.retention_hold_until IS NULL OR c.retention_hold_until <= ${now.toISOString()})
      AND NOT EXISTS (
        SELECT 1 FROM orders open_order
        WHERE open_order.customer_id = c.id AND open_order.shop_id = c.shop_id
          AND open_order.status NOT IN ('PICKED_UP', 'DELIVERED', 'CANCELLED', 'CANCELLED_BY_CUSTOMER', 'REJECTED', 'NO_SHOW', 'CUSTOMER_DECLINED', 'REFUNDED')
      )
    GROUP BY c.id
    HAVING MAX(o.fulfillment_date) <= ${cutoff.toISOString().slice(0, 10)}
    ORDER BY lastOrderDate ASC
  `);
}

export async function setCustomerRetentionHold(database: Database, customerId: string, actor: string, until: string, reason: string) {
  const now = new Date().toISOString();
  const updated = await database.update(customers).set({ retentionHoldUntil: until, retentionHoldReason: reason.trim(), retentionHoldSetBy: actor, updatedAt: now }).where(and(eq(customers.id, customerId), eq(customers.shopId, env().SHOP_ID))).run();
  if (updated.rowsAffected !== 1) throw new DomainError("NOT_FOUND", "Customer not found", 404);
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: env().SHOP_ID, actor, action: "customer.retention_hold_created", entityType: "customer", entityId: customerId, detailsJson: JSON.stringify({ until, reason: reason.trim() }), createdAt: now });
}

export async function clearCustomerRetentionHold(database: Database, customerId: string, actor: string) {
  const now = new Date().toISOString();
  const updated = await database.update(customers).set({ retentionHoldUntil: null, retentionHoldReason: null, retentionHoldSetBy: null, updatedAt: now }).where(and(eq(customers.id, customerId), eq(customers.shopId, env().SHOP_ID))).run();
  if (updated.rowsAffected !== 1) throw new DomainError("NOT_FOUND", "Customer not found", 404);
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: env().SHOP_ID, actor, action: "customer.retention_hold_released", entityType: "customer", entityId: customerId, detailsJson: "{}", createdAt: now });
}

export async function listCustomers(
  database: Database,
  options?: {
    search?: string;
    filter?: "all" | "vip" | "conflicts" | "consent";
    sort?: "spend_desc" | "litres_desc" | "recent" | "name_asc";
    page?: number;
    limit?: number;
  },
) {
  const { SHOP_ID } = env();
  const rows = await database
    .select()
    .from(customers)
    .where(eq(customers.shopId, SHOP_ID))
    .orderBy(desc(customers.updatedAt));

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

  const allReviews = await database
    .select({
      id: reviews.id,
      customerId: reviews.customerId,
      rating: reviews.rating,
    })
    .from(reviews)
    .where(eq(reviews.shopId, SHOP_ID));

  const allWithMetrics = rows.map((customer) => {
    const related = customerOrders.filter((order) => order.customerId === customer.id);
    const completed = related.filter(
      (o) => !["CANCELLED", "REJECTED", "NO_SHOW", "CUSTOMER_DECLINED"].includes(o.status)
    );
    const noShows = related.filter((o) => o.status === "NO_SHOW");

    const pickupCount = completed.filter((o) => o.fulfillmentMethod === "PICKUP").length;
    const deliveryCount = completed.filter((o) => o.fulfillmentMethod === "DELIVERY").length;
    const preferredMethod =
      deliveryCount > pickupCount
        ? "DELIVERY"
        : deliveryCount < pickupCount
        ? "PICKUP"
        : completed[0]?.fulfillmentMethod ?? "PICKUP";

    const lifetimeLitres = completed.reduce((sum, order) => sum + order.volumeMl, 0);
    const totalSpendCents = completed.reduce(
      (sum, order) => sum + (order.finalTotalCents ?? order.itemSubtotalCents),
      0
    );

    const isVip = lifetimeLitres >= 20000; // >= 20 Litres
    const totalFinished = completed.length + noShows.length;
    const reliabilityRatePercent = totalFinished > 0 ? Math.round((completed.length / totalFinished) * 100) : 100;

    const customerRev = allReviews.filter((r) => r.customerId === customer.id);
    const reviewCount = customerRev.length;
    const averageRating = reviewCount > 0
      ? Number((customerRev.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1))
      : null;

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
        reviewCount,
        averageRating,
      },
    };
  });

  const summary = {
    totalCustomers: allWithMetrics.length,
    vipCount: allWithMetrics.filter((c) => c.metrics.isVip).length,
    totalLitres: allWithMetrics.reduce((acc, c) => acc + c.metrics.lifetimeLitres, 0),
    consentCount: allWithMetrics.filter((c) => c.marketingConsent).length,
  };

  let filtered = allWithMetrics;

  if (options?.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    filtered = filtered.filter((c) => {
      const text = `${c.name} ${c.mobile ?? ""} ${c.email ?? ""} ${c.facebookProfile ?? ""} ${c.notes ?? ""}`.toLowerCase();
      return text.includes(q);
    });
  }

  if (options?.filter === "vip") {
    filtered = filtered.filter((c) => c.metrics.isVip);
  } else if (options?.filter === "conflicts") {
    filtered = filtered.filter((c) => c.matchStatus === "CONFLICT_REVIEW");
  } else if (options?.filter === "consent") {
    filtered = filtered.filter((c) => c.marketingConsent);
  }

  const sortMode = options?.sort ?? "recent";
  if (sortMode === "spend_desc") {
    filtered.sort((a, b) => b.metrics.totalSpendCents - a.metrics.totalSpendCents);
  } else if (sortMode === "litres_desc") {
    filtered.sort((a, b) => b.metrics.lifetimeLitres - a.metrics.lifetimeLitres);
  } else if (sortMode === "name_asc") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  const page = options?.page ?? 1;
  const limit = options?.limit ?? 150;
  const startIndex = (page - 1) * limit;
  const paginatedItems = filtered.slice(startIndex, startIndex + limit);

  return {
    items: paginatedItems,
    total: filtered.length,
    page,
    limit,
    totalPages: Math.ceil(filtered.length / limit) || 1,
    summary,
  };
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
      streetAddress: orders.streetAddress,
      postalCode: orders.postalCode,
      city: orders.city,
      volumeMl: orders.volumeMl,
      finalTotalCents: orders.finalTotalCents,
      itemSubtotalCents: orders.itemSubtotalCents,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.shopId, SHOP_ID), eq(orders.customerId, customerId)))
    .orderBy(desc(orders.createdAt))
    .limit(100);

  // Find potential identity conflicts / duplicate records matching phone, email, or facebookProfile
  const hasMobile = Boolean(customer.mobile && customer.mobile.trim());
  const hasEmail = Boolean(customer.email && customer.email.trim());
  const hasFb = Boolean(customer.facebookProfile && customer.facebookProfile.trim());

  let identityConflicts: Array<{
    id: string;
    name: string;
    mobile: string | null;
    email: string | null;
    notes: string | null;
    createdAt: string;
  }> = [];

  if (hasMobile || hasEmail || hasFb) {
    const conditions = [];
    if (hasMobile) conditions.push(eq(customers.mobile, customer.mobile!));
    if (hasEmail) conditions.push(eq(customers.email, customer.email!));
    if (hasFb) conditions.push(eq(customers.facebookProfile, customer.facebookProfile!));

    identityConflicts = await database
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
          ne(customers.id, customerId),
          or(...conditions)
        )
      )
      .limit(20);
  }

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
  const preferredMethod =
    deliveryCount > pickupCount
      ? "DELIVERY"
      : deliveryCount < pickupCount
      ? "PICKUP"
      : completed[0]?.fulfillmentMethod ?? "PICKUP";

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

  const customerReviews = await database
    .select({
      id: reviews.id,
      rating: reviews.rating,
      originalText: reviews.originalText,
      displayText: reviews.displayText,
      status: reviews.status,
      featured: reviews.featured,
      verifiedBuyer: reviews.verifiedBuyer,
      orderId: reviews.orderId,
      sellerReplyText: reviews.sellerReplyText,
      sellerRepliedAt: reviews.sellerRepliedAt,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(and(eq(reviews.shopId, SHOP_ID), eq(reviews.customerId, customerId)))
    .orderBy(desc(reviews.createdAt));

  const reviewCount = customerReviews.length;
  const averageRating = reviewCount > 0
    ? Number((customerReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1))
    : null;

  const primaryAddressOrder = customerOrders.find((o) => Boolean(o.streetAddress && o.streetAddress.trim()));
  const primaryAddress = primaryAddressOrder
    ? `${primaryAddressOrder.streetAddress}${primaryAddressOrder.postalCode ? `, ${primaryAddressOrder.postalCode}` : ""}${primaryAddressOrder.city ? ` ${primaryAddressOrder.city}` : ""}`
    : null;

  return {
    customer,
    orders: customerOrders,
    reviews: customerReviews,
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
      reviewCount,
      averageRating,
      primaryAddress,
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

  if (!normalizedMobile && !facebookProfile && !email) {
    throw new DomainError("VALIDATION_ERROR", "At least one contact method (Mobile Phone, Facebook, or Email) is required", 422);
  }

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
