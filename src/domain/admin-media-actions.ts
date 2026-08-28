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
