import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, mediaAttachments, mediaAssets } from "@/db/schema";
import { DomainError } from "./errors";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";

export type AdminMediaMetadataInput = { attachmentId: string; altFi: string; altEn: string };

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
