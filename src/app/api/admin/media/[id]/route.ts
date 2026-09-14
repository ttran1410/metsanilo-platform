import { executeAdminRoute, parseJson } from "../../module";
import { deleteAdminMedia, findAdminMediaAttachment, reorderAdminMedia, setAdminMediaPrimary, updateAdminMediaMetadata } from "@/domain/admin-media-actions";
import { DomainError } from "@/domain/errors";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "media.write",
    parse: async (incoming) => {
      const { id } = await context.params;
      return { id, input: await parseJson<{ action?: string; altFi?: string; altEn?: string; attachmentIds?: unknown }>(incoming) };
    },
    run: async ({ id: attachmentId, input }, { database, context: { actor, shop } }) => {
      await findAdminMediaAttachment(database, { actor, shop: { id: shop.shopId } }, attachmentId);
      if (input.action === "metadata") {
        const altFi = String(input.altFi ?? "").trim();
        const altEn = String(input.altEn ?? "").trim();
        if (!altFi || !altEn || altFi.length > 240 || altEn.length > 240) throw new DomainError("VALIDATION_ERROR", "Finnish and English alt text are required", 422);
        return updateAdminMediaMetadata(database, { actor, shop: { id: shop.shopId } }, { attachmentId, altFi, altEn });
      }
      if (input.action === "reorder") {
        const attachmentIds = Array.isArray(input.attachmentIds) && input.attachmentIds.every((value): value is string => typeof value === "string") ? input.attachmentIds : [];
        return reorderAdminMedia(database, { actor, shop: { id: shop.shopId } }, { attachmentId, attachmentIds });
      }
      return setAdminMediaPrimary(database, { actor, shop: { id: shop.shopId } }, attachmentId);
    },
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "media.write",
    parse: async () => (await context.params).id,
    run: async (assetId, { database, context: { actor, shop } }) => deleteAdminMedia(database, { actor, shop: { id: shop.shopId } }, assetId),
  });
}

