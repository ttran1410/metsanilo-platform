import { del } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEntries, mediaAttachments, mediaAssets } from "@/db/schema";
import { authenticateAdmin, parseJson } from "../../module";
import { reorderAdminMedia, setAdminMediaPrimary, updateAdminMediaMetadata } from "@/domain/admin-media-actions";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";
import { failure, success } from "../../../response";

export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { try { const actor = (await authenticateAdmin(request, "media.write")).actor; const { id } = await context.params; const row = await db().select({ attachment: mediaAttachments, asset: mediaAssets }).from(mediaAttachments).innerJoin(mediaAssets, eq(mediaAssets.id, mediaAttachments.assetId)).where(and(eq(mediaAttachments.id, id), eq(mediaAttachments.shopId, env().SHOP_ID))).limit(1); if (!row[0] || !row[0].attachment.productId) throw new DomainError("NOT_FOUND", "Image not found", 404); const input = await parseJson<{ action?: string; altFi?: string; altEn?: string; attachmentIds?: unknown }>(request);
    if (input.action === "metadata") {
      const altFi = String(input.altFi ?? "").trim(); const altEn = String(input.altEn ?? "").trim();
      if (!altFi || !altEn || altFi.length > 240 || altEn.length > 240) throw new DomainError("VALIDATION_ERROR", "Finnish and English alt text are required", 422);
      return success(await updateAdminMediaMetadata(db(), { actor, shop: { id: env().SHOP_ID } }, { attachmentId: id, altFi, altEn }));
    }
    if (input.action === "reorder") {
      const attachmentIds = Array.isArray((input as { attachmentIds?: unknown }).attachmentIds) ? (input as { attachmentIds: string[] }).attachmentIds : [];
      return success(await reorderAdminMedia(db(), { actor, shop: { id: env().SHOP_ID } }, { attachmentId: id, attachmentIds }));
    }
    return success(await setAdminMediaPrimary(db(), { actor, shop: { id: env().SHOP_ID } }, id)); } catch (error) { return failure(error); } }
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { try { const actor = (await authenticateAdmin(request, "media.write")).actor; const { id } = await context.params; const row = await db().select({ attachment: mediaAttachments, asset: mediaAssets }).from(mediaAttachments).innerJoin(mediaAssets, eq(mediaAssets.id, mediaAttachments.assetId)).where(and(eq(mediaAttachments.assetId, id), eq(mediaAttachments.shopId, env().SHOP_ID))).limit(1); if (!row[0]) throw new DomainError("NOT_FOUND", "Image not found", 404); if (row[0].attachment.isPrimary) throw new DomainError("PRIMARY_MEDIA_REQUIRED", "Choose another primary image before deleting this image", 409); await del(row[0].asset.url); await db().delete(mediaAttachments).where(and(eq(mediaAttachments.assetId, id), eq(mediaAttachments.shopId, env().SHOP_ID))); await db().delete(mediaAssets).where(and(eq(mediaAssets.id, id), eq(mediaAssets.shopId, env().SHOP_ID))); await db().insert(auditEntries).values({ id: crypto.randomUUID(), shopId: env().SHOP_ID, actor: actor.email ?? actor.id, action: "media.deleted", entityType: "product", entityId: row[0].attachment.productId ?? "", detailsJson: JSON.stringify({ assetId: id }), createdAt: new Date().toISOString() }); return success({ deleted: true }); } catch (error) { return failure(error); } }
