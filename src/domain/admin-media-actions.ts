import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { and, count, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, mediaAttachments, mediaAssets, products, shops } from "@/db/schema";
import { DomainError } from "./errors";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";

export type AdminMediaMetadataInput = { attachmentId: string; altFi: string; altEn: string };

export async function listAdminMedia(database: Database, context: AdminActionContext, input: { productId?: string | null; pageKey?: string | null }) {
  assertAdminActionContext(context);
  if (!input.productId && !input.pageKey) throw new DomainError("VALIDATION_ERROR", "Product or page key is required", 422);
  const condition = input.productId
    ? and(eq(mediaAttachments.shopId, context.shop.id), eq(mediaAttachments.productId, input.productId))
    : and(eq(mediaAttachments.shopId, context.shop.id), eq(mediaAttachments.pageKey, input.pageKey!));
  const rows = await database.select({ attachment: mediaAttachments, asset: mediaAssets }).from(mediaAttachments).innerJoin(mediaAssets, eq(mediaAssets.id, mediaAttachments.assetId)).where(condition).orderBy(mediaAttachments.sortOrder);
  return rows.map((row) => ({ ...row.asset, sortOrder: row.attachment.sortOrder, isPrimary: row.attachment.isPrimary, attachmentId: row.attachment.id }));
}

export async function findAdminMediaAttachment(database: Database, context: AdminActionContext, attachmentId: string) {
  assertAdminActionContext(context);
  const [row] = await database.select({ attachment: mediaAttachments, asset: mediaAssets }).from(mediaAttachments).innerJoin(mediaAssets, eq(mediaAssets.id, mediaAttachments.assetId)).where(and(eq(mediaAttachments.id, attachmentId), eq(mediaAttachments.shopId, context.shop.id))).limit(1);
  if (!row?.attachment.productId) throw new DomainError("NOT_FOUND", "Image not found", 404);
  return row;
}

export async function updateAdminMediaMetadata(database: Database, context: AdminActionContext, input: AdminMediaMetadataInput) {
  assertAdminActionContext(context);
  const row = await database.select({ attachment: mediaAttachments, asset: mediaAssets }).from(mediaAttachments).innerJoin(mediaAssets, eq(mediaAssets.id, mediaAttachments.assetId)).where(and(eq(mediaAttachments.id, input.attachmentId), eq(mediaAttachments.shopId, context.shop.id))).limit(1);
  if (!row[0] || !row[0].attachment.productId) throw new DomainError("NOT_FOUND", "Image not found", 404);
  await database.update(mediaAssets).set({ altFi: input.altFi, altEn: input.altEn }).where(and(eq(mediaAssets.id, row[0].asset.id), eq(mediaAssets.shopId, context.shop.id)));
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: context.shop.id, actor: context.actor.email ?? context.actor.id, action: "media.alt_text_updated", entityType: "product", entityId: row[0].attachment.productId, detailsJson: JSON.stringify({ assetId: row[0].asset.id }), createdAt: new Date().toISOString() });
  return { id: input.attachmentId, altFi: input.altFi, altEn: input.altEn };
}

export type AdminMediaReorderInput = { attachmentId: string; attachmentIds: string[] };
export async function reorderAdminMedia(database: Database, context: AdminActionContext, input: AdminMediaReorderInput) {
  assertAdminActionContext(context);
  const row = await database.query.mediaAttachments.findFirst({ where: and(eq(mediaAttachments.id, input.attachmentId), eq(mediaAttachments.shopId, context.shop.id)) });
  if (!row?.productId) throw new DomainError("NOT_FOUND", "Image not found", 404);
  const all = await database.select({ id: mediaAttachments.id }).from(mediaAttachments).where(and(eq(mediaAttachments.shopId, context.shop.id), eq(mediaAttachments.productId, row.productId)));
  if (input.attachmentIds.length !== all.length || all.some((item) => !input.attachmentIds.includes(item.id))) throw new DomainError("VALIDATION_ERROR", "Gallery order must include every image", 422);
  await database.transaction(async (tx) => { for (const [sortOrder, id] of input.attachmentIds.entries()) await tx.update(mediaAttachments).set({ sortOrder }).where(and(eq(mediaAttachments.id, id), eq(mediaAttachments.shopId, context.shop.id), eq(mediaAttachments.productId, row.productId!))); });
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: context.shop.id, actor: context.actor.email ?? context.actor.id, action: "media.reordered", entityType: "product", entityId: row.productId, detailsJson: JSON.stringify({ attachmentIds: input.attachmentIds }), createdAt: new Date().toISOString() });
  return { reordered: true };
}

export async function setAdminMediaPrimary(database: Database, context: AdminActionContext, attachmentId: string) {
  assertAdminActionContext(context);
  const row = await database.query.mediaAttachments.findFirst({ where: and(eq(mediaAttachments.id, attachmentId), eq(mediaAttachments.shopId, context.shop.id)) });
  if (!row?.productId) throw new DomainError("NOT_FOUND", "Image not found", 404);
  await database.transaction(async (tx) => { await tx.update(mediaAttachments).set({ isPrimary: false }).where(and(eq(mediaAttachments.shopId, context.shop.id), eq(mediaAttachments.productId, row.productId!))); await tx.update(mediaAttachments).set({ isPrimary: true }).where(and(eq(mediaAttachments.id, attachmentId), eq(mediaAttachments.shopId, context.shop.id))); });
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: context.shop.id, actor: context.actor.email ?? context.actor.id, action: "media.primary_changed", entityType: "product", entityId: row.productId, detailsJson: JSON.stringify({ attachmentId }), createdAt: new Date().toISOString() });
  return { id: attachmentId, isPrimary: true };
}

export async function deleteAdminMedia(database: Database, context: AdminActionContext, assetId: string) {
  assertAdminActionContext(context);
  const row = await database.select({ attachment: mediaAttachments, asset: mediaAssets }).from(mediaAttachments).innerJoin(mediaAssets, eq(mediaAssets.id, mediaAttachments.assetId)).where(and(eq(mediaAttachments.assetId, assetId), eq(mediaAttachments.shopId, context.shop.id))).limit(1);
  if (!row[0]) throw new DomainError("NOT_FOUND", "Image not found", 404);
  if (row[0].attachment.isPrimary) throw new DomainError("PRIMARY_MEDIA_REQUIRED", "Choose another primary image before deleting this image", 409);
  await del(row[0].asset.url);
  await database.delete(mediaAttachments).where(and(eq(mediaAttachments.assetId, assetId), eq(mediaAttachments.shopId, context.shop.id)));
  await database.delete(mediaAssets).where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.shopId, context.shop.id)));
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: context.shop.id, actor: context.actor.email ?? context.actor.id, action: "media.deleted", entityType: "product", entityId: row[0].attachment.productId ?? "", detailsJson: JSON.stringify({ assetId }), createdAt: new Date().toISOString() });
  return { deleted: true };
}

export type AdminMediaUploadInput = { productId: string | null; pageKey: string | null; file: File; altFi: string; altEn: string };
export async function uploadAdminMedia(database: Database, context: AdminActionContext, input: AdminMediaUploadInput) {
  assertAdminActionContext(context);
  if (!input.productId && !input.pageKey) throw new DomainError("VALIDATION_ERROR", "Product or page key is required", 422);
  if (input.file.size > 2 * 1024 * 1024) throw new DomainError("VALIDATION_ERROR", "Images must be 2 MB or smaller", 422);
  if (input.productId) {
    const product = await database.query.products.findFirst({ where: and(eq(products.id, input.productId), eq(products.shopId, context.shop.id)) });
    if (!product) throw new DomainError("NOT_FOUND", "Product not found", 404);
  }
  const condition = input.productId ? and(eq(mediaAttachments.shopId, context.shop.id), eq(mediaAttachments.productId, input.productId)) : and(eq(mediaAttachments.shopId, context.shop.id), eq(mediaAttachments.pageKey, input.pageKey!));
  const existing = await database.select({ total: count() }).from(mediaAttachments).where(condition);
  const total = Number(existing[0]?.total ?? 0);
  if (input.productId && total >= 4) throw new DomainError("MEDIA_LIMIT", "A product can have at most 4 images", 409);
  const now = new Date().toISOString(); const assetId = randomUUID(); const attachmentId = randomUUID();
  const blob = await put(`${input.productId ? `products/${input.productId}` : `pages/${input.pageKey}`}/${input.file.name}`, input.file, { access: "public", addRandomSuffix: true, contentType: input.file.type });
  await database.insert(mediaAssets).values({ id: assetId, shopId: context.shop.id, url: blob.url, pathname: blob.pathname, mimeType: input.file.type, sizeBytes: input.file.size, altFi: input.altFi, altEn: input.altEn, captionFi: "", captionEn: "", active: true, createdAt: now });
  await database.insert(mediaAttachments).values({ id: attachmentId, shopId: context.shop.id, assetId, productId: input.productId, pageKey: input.pageKey, sortOrder: total, isPrimary: total === 0 });
  if (input.pageKey === "logo") await database.update(shops).set({ logoUrl: blob.url }).where(eq(shops.id, context.shop.id));
  if (input.pageKey === "favicon") await database.update(shops).set({ faviconUrl: blob.url }).where(eq(shops.id, context.shop.id));
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: context.shop.id, actor: context.actor.email ?? context.actor.id, action: "media.uploaded", entityType: input.pageKey ? "page_media" : "product", entityId: input.pageKey ?? input.productId!, detailsJson: JSON.stringify({ assetId, sizeBytes: input.file.size, pageKey: input.pageKey }), createdAt: now });
  return { ...blob, id: assetId, altFi: input.altFi, altEn: input.altEn, attachmentId };
}

export async function deleteAdminMediaAttachment(database: Database, context: AdminActionContext, attachmentId: string) {
  assertAdminActionContext(context);
  const attachment = await database.query.mediaAttachments.findFirst({ where: and(eq(mediaAttachments.id, attachmentId), eq(mediaAttachments.shopId, context.shop.id)) });
  if (!attachment) throw new DomainError("NOT_FOUND", "Media attachment not found", 404);
  await database.delete(mediaAttachments).where(and(eq(mediaAttachments.id, attachmentId), eq(mediaAttachments.shopId, context.shop.id)));
  if (attachment.pageKey === "logo") await database.update(shops).set({ logoUrl: null }).where(eq(shops.id, context.shop.id));
  if (attachment.pageKey === "favicon") await database.update(shops).set({ faviconUrl: null }).where(eq(shops.id, context.shop.id));
  return { deleted: true, id: attachmentId, updatedBy: context.actor.email ?? context.actor.id };
}
