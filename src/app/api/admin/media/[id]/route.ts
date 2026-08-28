import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { mediaAttachments, mediaAssets } from "@/db/schema";
import { authenticateAdmin, parseJson } from "../../module";
import { deleteAdminMedia, reorderAdminMedia, setAdminMediaPrimary, updateAdminMediaMetadata } from "@/domain/admin-media-actions";
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
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { try { const actor = (await authenticateAdmin(request, "media.write")).actor; const { id } = await context.params; return success(await deleteAdminMedia(db(), { actor, shop: { id: env().SHOP_ID } }, id)); } catch (error) { return failure(error); } }
