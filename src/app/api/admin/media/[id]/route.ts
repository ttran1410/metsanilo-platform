import { db } from "@/db/client";
import { authenticateAdmin, parseJson } from "../../module";
import { deleteAdminMedia, findAdminMediaAttachment, reorderAdminMedia, setAdminMediaPrimary, updateAdminMediaMetadata } from "@/domain/admin-media-actions";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";
import { failure, success } from "../../../response";

export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { try { const actor = (await authenticateAdmin(request, "media.write")).actor; const { id } = await context.params; await findAdminMediaAttachment(db(), { actor, shop: { id: env().SHOP_ID } }, id); const input = await parseJson<{ action?: string; altFi?: string; altEn?: string; attachmentIds?: unknown }>(request);
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
