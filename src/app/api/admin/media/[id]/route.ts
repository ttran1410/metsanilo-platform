import { executeAdmin, parseJson } from "../../module";
import { deleteAdminMedia, findAdminMediaAttachment, reorderAdminMedia, setAdminMediaPrimary, updateAdminMediaMetadata } from "@/domain/admin-media-actions";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";
import { failure, success } from "../../../response";

export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await executeAdmin(request, { permission: "media.write", parse: async (incoming) => ({ id, input: await parseJson<{ action?: string; altFi?: string; altEn?: string; attachmentIds?: unknown }>(incoming) }), run: async ({ id: attachmentId, input }, { database, context: { actor } }) => {
      await findAdminMediaAttachment(database, { actor, shop: { id: env().SHOP_ID } }, attachmentId);
      if (input.action === "metadata") {
        const altFi = String(input.altFi ?? "").trim(); const altEn = String(input.altEn ?? "").trim();
        if (!altFi || !altEn || altFi.length > 240 || altEn.length > 240) throw new DomainError("VALIDATION_ERROR", "Finnish and English alt text are required", 422);
        return updateAdminMediaMetadata(database, { actor, shop: { id: env().SHOP_ID } }, { attachmentId, altFi, altEn });
      }
      if (input.action === "reorder") {
        const attachmentIds = Array.isArray(input.attachmentIds) && input.attachmentIds.every((value): value is string => typeof value === "string") ? input.attachmentIds : [];
        return reorderAdminMedia(database, { actor, shop: { id: env().SHOP_ID } }, { attachmentId, attachmentIds });
      }
      return setAdminMediaPrimary(database, { actor, shop: { id: env().SHOP_ID } }, attachmentId);
    } });
    return success(result);
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await executeAdmin(request, { permission: "media.write", parse: async () => id, run: async (assetId, { database, context: { actor } }) => deleteAdminMedia(database, { actor, shop: { id: env().SHOP_ID } }, assetId) });
    return success(result);
  } catch (error) { return failure(error); }
}
