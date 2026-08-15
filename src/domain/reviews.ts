import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, orders, reviews, shops } from "@/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "./errors";

const now = () => new Date().toISOString();

export async function listPublishedReviews(database: Database) {
  const { SHOP_ID } = env();
  return database.select().from(reviews).where(and(eq(reviews.shopId, SHOP_ID), eq(reviews.status, "APPROVED"))).orderBy(desc(reviews.createdAt));
}

export async function createPublicReview(database: Database, input: { displayName: string; rating: number; originalText: string; publicationAcknowledgement: boolean; contact?: string; productId?: string; locale: "fi" | "en" }) {
  if (!input.publicationAcknowledgement) throw new DomainError("VALIDATION_ERROR", "Publication acknowledgement is required", 422, { publicationAcknowledgement: "REQUIRED" });
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new DomainError("VALIDATION_ERROR", "Rating must be 1–5", 422, { rating: "INVALID" });
  const displayName = input.displayName.trim(); const originalText = input.originalText.trim();
  if (displayName.length < 2 || displayName.length > 80 || originalText.length < 10 || originalText.length > 2000) throw new DomainError("VALIDATION_ERROR", "Review fields are invalid", 422);
  const { SHOP_ID } = env(); const timestamp = now(); const id = randomUUID();
  await database.insert(reviews).values({ id, shopId: SHOP_ID, displayName, contact: input.contact?.trim() || null, rating: input.rating, originalText, displayText: null, source: "PUBLIC_FORM", status: "PENDING", publicationAcknowledgement: true, acknowledgementSource: "PUBLIC_FORM", acknowledgedAt: timestamp, featured: false, featuredUntil: null, moderationReason: null, moderatedBy: null, moderatedAt: null, productId: input.productId || null, customerId: null, orderId: null, createdAt: timestamp, updatedAt: timestamp });
  return { id, status: "PENDING" as const };
}

export async function listManagerReviews(database: Database) {
  const { SHOP_ID } = env();
  return database.select().from(reviews).where(eq(reviews.shopId, SHOP_ID)).orderBy(desc(reviews.createdAt));
}

export async function createManualReview(database: Database, input: { displayName: string; rating: number; originalText: string; orderId?: string; productId?: string; actor: string }) {
  const { SHOP_ID } = env(); const timestamp = now(); const id = randomUUID();
  if (input.orderId) { const order = await database.query.orders.findFirst({ where: and(eq(orders.id, input.orderId), eq(orders.shopId, SHOP_ID)) }); if (!order) throw new DomainError("NOT_FOUND", "Order not found", 404); }
  await database.insert(reviews).values({ id, shopId: SHOP_ID, customerId: null, orderId: input.orderId || null, productId: input.productId || null, displayName: input.displayName.trim(), contact: null, rating: input.rating, originalText: input.originalText.trim(), displayText: null, source: "MANUAL_IMPORT", status: "PENDING_CONFIRMATION", publicationAcknowledgement: false, acknowledgementSource: null, acknowledgedAt: null, featured: false, featuredUntil: null, moderationReason: null, moderatedBy: null, moderatedAt: null, createdAt: timestamp, updatedAt: timestamp });
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: SHOP_ID, actor: input.actor, action: "review.manual_created", entityType: "review", entityId: id, detailsJson: JSON.stringify({ orderId: input.orderId ?? null }), createdAt: timestamp });
  return (await database.query.reviews.findFirst({ where: eq(reviews.id, id) }))!;
}

export async function moderateReview(database: Database, input: { id: string; status: "APPROVED" | "REJECTED" | "HIDDEN" | "ARCHIVED"; displayText?: string; reason?: string; featured?: boolean; featuredUntil?: string; actor: string }) {
  const { SHOP_ID } = env(); const current = await database.query.reviews.findFirst({ where: and(eq(reviews.id, input.id), eq(reviews.shopId, SHOP_ID)) });
  if (!current) throw new DomainError("NOT_FOUND", "Review not found", 404);
  if (input.status === "APPROVED" && !current.publicationAcknowledgement) throw new DomainError("VALIDATION_ERROR", "Publication acknowledgement is required", 422);
  const timestamp = now();
  await database.update(reviews).set({ status: input.status, displayText: input.displayText?.trim() || current.displayText, moderationReason: input.reason?.trim() || null, moderatedBy: input.actor, moderatedAt: timestamp, featured: input.status === "APPROVED" ? Boolean(input.featured) : false, featuredUntil: input.status === "APPROVED" ? input.featuredUntil || null : null, updatedAt: timestamp }).where(eq(reviews.id, input.id));
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: SHOP_ID, actor: input.actor, action: `review.${input.status.toLowerCase()}`, entityType: "review", entityId: input.id, detailsJson: JSON.stringify({ reason: input.reason ?? null, featured: Boolean(input.featured) }), createdAt: timestamp });
  return (await database.query.reviews.findFirst({ where: eq(reviews.id, input.id) }))!;
}

export async function confirmManualReview(database: Database, input: { id: string; source: "SMS" | "WHATSAPP" | "PHONE" | "OTHER"; note?: string; actor: string }) {
  const { SHOP_ID } = env(); const current = await database.query.reviews.findFirst({ where: and(eq(reviews.id, input.id), eq(reviews.shopId, SHOP_ID)) }); if (!current) throw new DomainError("NOT_FOUND", "Review not found", 404);
  const timestamp = now(); await database.update(reviews).set({ publicationAcknowledgement: true, acknowledgementSource: input.source, acknowledgedAt: timestamp, moderationReason: input.note?.trim() || current.moderationReason, updatedAt: timestamp }).where(eq(reviews.id, input.id));
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: SHOP_ID, actor: input.actor, action: "review.publication_confirmed", entityType: "review", entityId: input.id, detailsJson: JSON.stringify({ source: input.source, note: input.note ?? null }), createdAt: timestamp });
  return (await database.query.reviews.findFirst({ where: eq(reviews.id, input.id) }))!;
}

export async function getReviewsVisibility(database: Database) {
  const { SHOP_ID } = env(); const shop = await database.query.shops.findFirst({ where: eq(shops.id, SHOP_ID) });
  return Boolean(shop?.reviewsVisible);
}

export async function setReviewsVisibility(database: Database, visible: boolean) {
  const { SHOP_ID } = env();
  await database.update(shops).set({ reviewsVisible: visible }).where(eq(shops.id, SHOP_ID));
  return visible;
}
