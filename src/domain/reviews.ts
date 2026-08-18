import { randomUUID } from "node:crypto";
import { and, desc, eq, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, customers, orders, reviews, shops } from "@/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "./errors";
import { normalizeEmail, normalizeMobile } from "./order-input";

const now = () => new Date().toISOString();

export async function recalculateReviewRollup(database: Database) {
  const { SHOP_ID } = env();
  const approved = await database
    .select({ rating: reviews.rating })
    .from(reviews)
    .where(and(eq(reviews.shopId, SHOP_ID), eq(reviews.status, "APPROVED")));

  const total = approved.length;
  const dist: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };
  let sum = 0;
  for (const r of approved) {
    sum += r.rating;
    const key = String(r.rating);
    if (dist[key] !== undefined) dist[key]++;
  }
  const avg = total > 0 ? Math.round((sum / total) * 100) / 100 : 5.0;

  await database
    .update(shops)
    .set({
      ratingAvg: avg,
      reviewCount: total,
      starDistributionJson: JSON.stringify(dist),
    })
    .where(eq(shops.id, SHOP_ID));

  return { ratingAvg: avg, reviewCount: total, starDistribution: dist };
}

export async function getReviewRollup(database: Database) {
  const { SHOP_ID } = env();
  const shop = await database.query.shops.findFirst({ where: eq(shops.id, SHOP_ID) });
  if (!shop) return { ratingAvg: 5.0, reviewCount: 0, starDistribution: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 } };

  try {
    const dist = JSON.parse(shop.starDistributionJson || '{"5":0,"4":0,"3":0,"2":0,"1":0}') as Record<string, number>;
    return {
      ratingAvg: shop.ratingAvg ?? 5.0,
      reviewCount: shop.reviewCount ?? 0,
      starDistribution: dist,
    };
  } catch {
    return { ratingAvg: 5.0, reviewCount: 0, starDistribution: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 } };
  }
}

export async function listPublishedReviews(
  database: Database,
  options?: { page?: number; limit?: number },
) {
  const { SHOP_ID } = env();
  const all = await database
    .select()
    .from(reviews)
    .where(and(eq(reviews.shopId, SHOP_ID), eq(reviews.status, "APPROVED")))
    .orderBy(desc(reviews.featured), desc(reviews.createdAt));

  if (!options?.page || !options?.limit) {
    return all;
  }

  const page = Math.max(1, options.page);
  const limit = Math.max(1, options.limit);
  const startIndex = (page - 1) * limit;

  return {
    items: all.slice(startIndex, startIndex + limit),
    total: all.length,
    page,
    limit,
    totalPages: Math.ceil(all.length / limit) || 1,
  };
}

export async function listFeaturedReviews(database: Database, limit = 3) {
  const { SHOP_ID } = env();
  const featured = await database
    .select()
    .from(reviews)
    .where(
      and(
        eq(reviews.shopId, SHOP_ID),
        eq(reviews.status, "APPROVED"),
        eq(reviews.featured, true),
      ),
    )
    .orderBy(desc(reviews.createdAt))
    .limit(limit);

  if (featured.length >= limit) {
    return featured;
  }

  const featuredIds = new Set(featured.map((r) => r.id));
  const fallback = await database
    .select()
    .from(reviews)
    .where(and(eq(reviews.shopId, SHOP_ID), eq(reviews.status, "APPROVED")))
    .orderBy(desc(reviews.createdAt))
    .limit(limit * 2);

  const combined = [...featured];
  for (const item of fallback) {
    if (!featuredIds.has(item.id) && combined.length < limit) {
      combined.push(item);
    }
  }

  return combined;
}

export async function createPublicReview(
  database: Database,
  input: {
    displayName: string;
    rating: number;
    originalText: string;
    publicationAcknowledgement: boolean;
    contact?: string;
    productId?: string;
    locale: "fi" | "en";
  },
) {
  if (!input.publicationAcknowledgement) {
    throw new DomainError("VALIDATION_ERROR", "Publication acknowledgement is required", 422, {
      publicationAcknowledgement: "REQUIRED",
    });
  }
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new DomainError("VALIDATION_ERROR", "Rating must be 1–5", 422, { rating: "INVALID" });
  }

  const displayName = input.displayName.trim();
  const originalText = input.originalText.trim();
  if (displayName.length < 2 || displayName.length > 80 || originalText.length < 10 || originalText.length > 2000) {
    throw new DomainError("VALIDATION_ERROR", "Review fields are invalid", 422);
  }

  const { SHOP_ID } = env();
  const timestamp = now();
  const id = randomUUID();

  let orderId: string | null = null;
  let customerId: string | null = null;
  let verifiedBuyer = false;
  let verificationType: "DIGITAL_ORDER" | "HISTORICAL_MATCH" | "STAFF_MANUAL" | "UNVERIFIED" = "UNVERIFIED";

  if (input.contact && input.contact.trim().length > 2) {
    const queryTerm = input.contact.trim();
    const cleanRef = queryTerm.replace(/^#/, "");

    let normalizedMobile: string | null = null;
    try {
      normalizedMobile = normalizeMobile(queryTerm);
    } catch {
      /* ignore invalid phone format for general search */
    }
    const normalizedEmail = normalizeEmail(queryTerm);

    // 1. Search orders by publicReference, mobile, email, or facebookProfile
    const orderMatch = await database.query.orders.findFirst({
      where: and(
        eq(orders.shopId, SHOP_ID),
        or(
          eq(orders.publicReference, queryTerm),
          eq(orders.publicReference, cleanRef),
          eq(orders.mobile, queryTerm),
          normalizedMobile ? eq(orders.mobile, normalizedMobile) : undefined,
          eq(orders.email, queryTerm),
          normalizedEmail ? eq(orders.email, normalizedEmail) : undefined,
          eq(orders.facebookProfile, queryTerm),
        ),
      ),
    });

    if (orderMatch) {
      orderId = orderMatch.id;
      customerId = orderMatch.customerId || null;
      verifiedBuyer = true;
      verificationType = "DIGITAL_ORDER";
    } else {
      // 2. Search customers by mobile, email, facebookProfile, or name
      const custMatch = await database.query.customers.findFirst({
        where: and(
          eq(customers.shopId, SHOP_ID),
          or(
            eq(customers.mobile, queryTerm),
            normalizedMobile ? eq(customers.mobile, normalizedMobile) : undefined,
            eq(customers.email, queryTerm),
            normalizedEmail ? eq(customers.email, normalizedEmail) : undefined,
            eq(customers.facebookProfile, queryTerm),
            eq(customers.name, queryTerm),
          ),
        ),
      });

      if (custMatch) {
        customerId = custMatch.id;
        verifiedBuyer = true;
        verificationType = "HISTORICAL_MATCH";
      } else {
        // 3. Auto-create Customer in CRM if contact looks like valid Phone, Email, or FB profile
        const isEmail = Boolean(normalizedEmail && queryTerm.includes("@"));
        const isPhone = Boolean(normalizedMobile);
        const isFb = queryTerm.includes("facebook.com/") || queryTerm.startsWith("@");

        if (isEmail || isPhone || isFb) {
          const newCustomerId = randomUUID();
          await database.insert(customers).values({
            id: newCustomerId,
            shopId: SHOP_ID,
            name: displayName,
            mobile: normalizedMobile,
            email: isEmail ? normalizedEmail : null,
            facebookProfile: isFb ? queryTerm : null,
            matchStatus: "ACTIVE",
            notes: "Auto-created from storefront review submission.",
            createdAt: timestamp,
            updatedAt: timestamp,
          });

          customerId = newCustomerId;
          verifiedBuyer = true;
          verificationType = "HISTORICAL_MATCH";
        }
      }
    }
  }

  await database.insert(reviews).values({
    id,
    shopId: SHOP_ID,
    displayName,
    contact: input.contact?.trim() || null,
    rating: input.rating,
    originalText,
    displayText: null,
    source: "PUBLIC_FORM",
    status: "PENDING",
    publicationAcknowledgement: true,
    acknowledgementSource: "PUBLIC_FORM",
    acknowledgedAt: timestamp,
    verifiedBuyer,
    verificationType,
    featured: false,
    featuredUntil: null,
    moderationReason: null,
    rejectionReason: null,
    moderatedBy: null,
    moderatedAt: null,
    sellerReplyText: null,
    sellerRepliedAt: null,
    sellerRepliedBy: null,
    productId: input.productId || null,
    customerId,
    orderId,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return { id, status: "PENDING" as const, verifiedBuyer, verificationType };
}

export async function listManagerReviews(database: Database) {
  const { SHOP_ID } = env();
  return database.select().from(reviews).where(eq(reviews.shopId, SHOP_ID)).orderBy(desc(reviews.createdAt));
}

export async function createManualReview(
  database: Database,
  input: {
    displayName: string;
    rating: number;
    originalText: string;
    orderId?: string;
    productId?: string;
    verifiedBuyer?: boolean;
    acknowledgementSource?: string;
    actor: string;
  },
) {
  const { SHOP_ID } = env();
  const timestamp = now();
  const id = randomUUID();

  let matchedOrderId: string | null = null;
  let matchedCustomerId: string | null = null;
  let verificationType: "DIGITAL_ORDER" | "HISTORICAL_MATCH" | "STAFF_MANUAL" | "UNVERIFIED" = "UNVERIFIED";

  if (input.orderId && input.orderId.trim()) {
    const queryTerm = input.orderId.trim();
    const cleanRef = queryTerm.replace(/^#/, "");

    const orderMatch = await database.query.orders.findFirst({
      where: and(
        eq(orders.shopId, SHOP_ID),
        or(
          eq(orders.id, queryTerm),
          eq(orders.publicReference, queryTerm),
          eq(orders.publicReference, cleanRef),
          eq(orders.mobile, queryTerm),
          eq(orders.email, queryTerm),
          eq(orders.facebookProfile, queryTerm),
        ),
      ),
    });

    if (orderMatch) {
      matchedOrderId = orderMatch.id;
      matchedCustomerId = orderMatch.customerId || null;
      verificationType = "DIGITAL_ORDER";
    } else {
      const custMatch = await database.query.customers.findFirst({
        where: and(
          eq(customers.shopId, SHOP_ID),
          or(
            eq(customers.mobile, queryTerm),
            eq(customers.email, queryTerm),
            eq(customers.facebookProfile, queryTerm),
            eq(customers.name, queryTerm),
          ),
        ),
      });

      if (custMatch) {
        matchedCustomerId = custMatch.id;
        verificationType = "HISTORICAL_MATCH";
      } else {
        throw new DomainError(
          "NOT_FOUND",
          `No order or customer matching "${queryTerm}" was found. Please check the Order Reference (e.g. H-A1B2C), Facebook profile, phone number, or leave blank.`,
          404,
        );
      }
    }
  }

  const hasAck = Boolean(input.acknowledgementSource);
  const verifiedBuyer = input.verifiedBuyer ?? Boolean(matchedOrderId || matchedCustomerId);
  const finalVerificationType = verifiedBuyer
    ? (verificationType !== "UNVERIFIED" ? verificationType : "STAFF_MANUAL")
    : "UNVERIFIED";

  await database.insert(reviews).values({
    id,
    shopId: SHOP_ID,
    customerId: matchedCustomerId,
    orderId: matchedOrderId,
    productId: input.productId || null,
    displayName: input.displayName.trim(),
    contact: null,
    rating: input.rating,
    originalText: input.originalText.trim(),
    displayText: null,
    source: "MANUAL_IMPORT",
    status: hasAck ? "PENDING" : "PENDING_CONFIRMATION",
    publicationAcknowledgement: hasAck,
    acknowledgementSource: input.acknowledgementSource || null,
    acknowledgedAt: hasAck ? timestamp : null,
    verifiedBuyer,
    verificationType: finalVerificationType,
    featured: false,
    featuredUntil: null,
    moderationReason: null,
    rejectionReason: null,
    moderatedBy: null,
    moderatedAt: null,
    sellerReplyText: null,
    sellerRepliedAt: null,
    sellerRepliedBy: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId: SHOP_ID,
    actor: input.actor,
    action: "review.manual_created",
    entityType: "review",
    entityId: id,
    detailsJson: JSON.stringify({ orderId: input.orderId ?? null, acknowledgementSource: input.acknowledgementSource ?? null }),
    createdAt: timestamp,
  });

  return (await database.query.reviews.findFirst({ where: eq(reviews.id, id) }))!;
}

export async function moderateReview(
  database: Database,
  input: {
    id: string;
    status?: "APPROVED" | "REJECTED" | "HIDDEN" | "ARCHIVED";
    displayText?: string;
    reason?: string;
    rejectionReason?: "SPAM" | "PROFANITY" | "UNRELATED" | "COMPETITOR" | "OTHER";
    featured?: boolean;
    featuredUntil?: string;
    verifiedBuyer?: boolean;
    actor: string;
  },
) {
  const { SHOP_ID } = env();
  const current = await database.query.reviews.findFirst({
    where: and(eq(reviews.id, input.id), eq(reviews.shopId, SHOP_ID)),
  });

  if (!current) throw new DomainError("NOT_FOUND", "Review not found", 404);

  const targetStatus = input.status ?? current.status;

  if (targetStatus === "APPROVED" && !current.publicationAcknowledgement) {
    throw new DomainError("VALIDATION_ERROR", "Publication acknowledgement is required before approving", 422);
  }

  if (input.featured && targetStatus !== "APPROVED") {
    throw new DomainError("VALIDATION_ERROR", "Only approved reviews can be featured on homepage", 422);
  }

  const timestamp = now();
  const verifiedBuyer = input.verifiedBuyer !== undefined ? input.verifiedBuyer : current.verifiedBuyer;
  const isFeatured = targetStatus === "APPROVED" ? (input.featured !== undefined ? Boolean(input.featured) : current.featured) : false;
  const featuredUntil = targetStatus === "APPROVED" ? (input.featuredUntil !== undefined ? input.featuredUntil || null : current.featuredUntil) : null;

  await database
    .update(reviews)
    .set({
      status: targetStatus,
      displayText: input.displayText !== undefined ? input.displayText.trim() : current.displayText,
      moderationReason: input.reason?.trim() || current.moderationReason,
      rejectionReason: targetStatus === "REJECTED" ? input.rejectionReason || "OTHER" : null,
      verifiedBuyer,
      verificationType: verifiedBuyer && current.verificationType === "UNVERIFIED" ? "STAFF_MANUAL" : current.verificationType,
      moderatedBy: input.actor,
      moderatedAt: timestamp,
      featured: isFeatured,
      featuredUntil,
      updatedAt: timestamp,
    })
    .where(eq(reviews.id, input.id));

  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId: SHOP_ID,
    actor: input.actor,
    action: `review.${targetStatus.toLowerCase()}`,
    entityType: "review",
    entityId: input.id,
    detailsJson: JSON.stringify({
      reason: input.reason ?? null,
      rejectionReason: input.rejectionReason ?? null,
      featured: isFeatured,
    }),
    createdAt: timestamp,
  });

  await recalculateReviewRollup(database);

  return (await database.query.reviews.findFirst({ where: eq(reviews.id, input.id) }))!;
}

export async function replyToReview(
  database: Database,
  input: {
    id: string;
    replyText: string;
    actor: string;
  },
) {
  const { SHOP_ID } = env();
  const current = await database.query.reviews.findFirst({
    where: and(eq(reviews.id, input.id), eq(reviews.shopId, SHOP_ID)),
  });

  if (!current) throw new DomainError("NOT_FOUND", "Review not found", 404);

  const timestamp = now();
  const replyText = input.replyText.trim();

  await database
    .update(reviews)
    .set({
      sellerReplyText: replyText || null,
      sellerRepliedAt: replyText ? timestamp : null,
      sellerRepliedBy: replyText ? input.actor : null,
      updatedAt: timestamp,
    })
    .where(eq(reviews.id, input.id));

  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId: SHOP_ID,
    actor: input.actor,
    action: "review.seller_replied",
    entityType: "review",
    entityId: input.id,
    detailsJson: JSON.stringify({ replyText: replyText ? replyText.substring(0, 100) : null }),
    createdAt: timestamp,
  });

  return (await database.query.reviews.findFirst({ where: eq(reviews.id, input.id) }))!;
}

export async function confirmManualReview(
  database: Database,
  input: {
    id: string;
    source: string;
    note?: string;
    actor: string;
  },
) {
  const { SHOP_ID } = env();
  const current = await database.query.reviews.findFirst({
    where: and(eq(reviews.id, input.id), eq(reviews.shopId, SHOP_ID)),
  });
  if (!current) throw new DomainError("NOT_FOUND", "Review not found", 404);

  const timestamp = now();
  await database
    .update(reviews)
    .set({
      publicationAcknowledgement: true,
      acknowledgementSource: input.source,
      acknowledgedAt: timestamp,
      status: current.status === "PENDING_CONFIRMATION" ? "PENDING" : current.status,
      moderationReason: input.note?.trim() || current.moderationReason,
      updatedAt: timestamp,
    })
    .where(eq(reviews.id, input.id));

  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId: SHOP_ID,
    actor: input.actor,
    action: "review.publication_confirmed",
    entityType: "review",
    entityId: input.id,
    detailsJson: JSON.stringify({ source: input.source, note: input.note ?? null }),
    createdAt: timestamp,
  });

  return (await database.query.reviews.findFirst({ where: eq(reviews.id, input.id) }))!;
}

export async function getReviewsVisibility(database: Database) {
  const { SHOP_ID } = env();
  const shop = await database.query.shops.findFirst({ where: eq(shops.id, SHOP_ID) });
  return Boolean(shop?.reviewsVisible);
}

export async function setReviewsVisibility(database: Database, visible: boolean) {
  const { SHOP_ID } = env();
  await database.update(shops).set({ reviewsVisible: visible }).where(eq(shops.id, SHOP_ID));
  return visible;
}

export async function linkReviewToCustomerOrOrder(
  database: Database,
  input: {
    reviewId: string;
    orderId?: string;
    customerId?: string;
    verifiedBuyer?: boolean;
    actor: string;
  },
) {
  const { SHOP_ID } = env();
  const review = await database.query.reviews.findFirst({
    where: and(eq(reviews.id, input.reviewId), eq(reviews.shopId, SHOP_ID)),
  });

  if (!review) throw new DomainError("NOT_FOUND", "Review not found", 404);

  let targetOrderId = input.orderId ? input.orderId.trim() : review.orderId;
  let targetCustomerId = input.customerId ? input.customerId.trim() : review.customerId;

  if (input.orderId && input.orderId.trim()) {
    const queryTerm = input.orderId.trim();
    const cleanRef = queryTerm.replace(/^#/, "");
    const orderMatch = await database.query.orders.findFirst({
      where: and(
        eq(orders.shopId, SHOP_ID),
        or(
          eq(orders.id, queryTerm),
          eq(orders.publicReference, queryTerm),
          eq(orders.publicReference, cleanRef),
        ),
      ),
    });
    if (orderMatch) {
      targetOrderId = orderMatch.id;
      if (!targetCustomerId && orderMatch.customerId) {
        targetCustomerId = orderMatch.customerId;
      }
    }
  }

  if (input.customerId && input.customerId.trim()) {
    const custMatch = await database.query.customers.findFirst({
      where: and(eq(customers.id, input.customerId.trim()), eq(customers.shopId, SHOP_ID)),
    });
    if (custMatch) {
      targetCustomerId = custMatch.id;
    }
  }

  const verified = input.verifiedBuyer !== undefined ? input.verifiedBuyer : Boolean(targetOrderId || targetCustomerId);
  const verificationType = verified
    ? (targetOrderId ? "DIGITAL_ORDER" : "STAFF_MANUAL")
    : "UNVERIFIED";

  const timestamp = now();

  await database
    .update(reviews)
    .set({
      orderId: targetOrderId || null,
      customerId: targetCustomerId || null,
      verifiedBuyer: verified,
      verificationType,
      updatedAt: timestamp,
    })
    .where(eq(reviews.id, input.reviewId));

  // Bi-directional CRM enrichment: update customer profile if missing contact fields
  if (targetCustomerId && review.contact) {
    const existingCust = await database.query.customers.findFirst({
      where: and(eq(customers.id, targetCustomerId), eq(customers.shopId, SHOP_ID)),
    });

    if (existingCust) {
      let normMobile: string | null = null;
      try { normMobile = normalizeMobile(review.contact); } catch { /* ignore */ }
      const normEmail = normalizeEmail(review.contact);
      const isFb = review.contact.includes("facebook.com/") || review.contact.startsWith("@");

      const updatePayload: Record<string, unknown> = { updatedAt: timestamp };
      if (!existingCust.mobile && normMobile) updatePayload.mobile = normMobile;
      if (!existingCust.email && normEmail && review.contact.includes("@")) updatePayload.email = normEmail;
      if (!existingCust.facebookProfile && isFb) updatePayload.facebookProfile = review.contact;

      if (Object.keys(updatePayload).length > 1) {
        await database.update(customers).set(updatePayload).where(eq(customers.id, targetCustomerId));
      }
    }
  }

  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId: SHOP_ID,
    actor: input.actor,
    action: "review.identity_linked",
    entityType: "review",
    entityId: input.reviewId,
    detailsJson: JSON.stringify({
      orderId: targetOrderId ?? null,
      customerId: targetCustomerId ?? null,
      verifiedBuyer: verified,
      verificationType,
    }),
    createdAt: timestamp,
  });

  return (await database.query.reviews.findFirst({ where: eq(reviews.id, input.reviewId) }))!;
}

