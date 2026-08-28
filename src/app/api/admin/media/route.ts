import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { mediaAttachments, mediaAssets, shops } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";
import { failure, success } from "../../response";
import { authenticateAdmin, executeAdmin } from "../module";
import { uploadAdminMedia } from "@/domain/admin-media-actions";

export const runtime = "nodejs";
const MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/x-icon"]);

export async function GET(request: Request) {
  try {
    const result = await executeAdmin(request, {
      permission: "media.write",
      parse: async () => new URL(request.url).searchParams,
      run: async (searchParams, { database }) => {
        const productId = searchParams.get("productId");
        const pageKey = searchParams.get("pageKey");
        if (!productId && !pageKey) throw new DomainError("VALIDATION_ERROR", "Product or page key is required", 422);
        const condition = productId
          ? and(eq(mediaAttachments.shopId, env().SHOP_ID), eq(mediaAttachments.productId, productId))
          : and(eq(mediaAttachments.shopId, env().SHOP_ID), eq(mediaAttachments.pageKey, pageKey!));
        const rows = await database
          .select({ attachment: mediaAttachments, asset: mediaAssets })
          .from(mediaAttachments)
          .innerJoin(mediaAssets, eq(mediaAssets.id, mediaAttachments.assetId))
          .where(condition)
          .orderBy(asc(mediaAttachments.sortOrder));
        return rows.map((row) => ({ ...row.asset, sortOrder: row.attachment.sortOrder, isPrimary: row.attachment.isPrimary, attachmentId: row.attachment.id }));
      },
    });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = (await authenticateAdmin(request, "media.write")).actor;
    const form = await request.formData();
    const productId = String(form.get("productId") ?? "").trim() || null;
    const pageKey = String(form.get("pageKey") ?? "").trim() || null;
    const file = form.get("file");
    const altFi = String(form.get("altFi") ?? "Kuva").trim();
    const altEn = String(form.get("altEn") ?? "Image").trim();

    if (!(file instanceof File) || (!productId && !pageKey)) {
      throw new DomainError("VALIDATION_ERROR", "Image file and either product or page key are required", 422);
    }
    if (!IMAGE_TYPES.has(file.type)) throw new DomainError("VALIDATION_ERROR", "Unsupported image type", 422);
    if (file.size > MAX_BYTES) throw new DomainError("VALIDATION_ERROR", "Images must be 2 MB or smaller", 422);

    return success(await uploadAdminMedia(db(), { actor, shop: { id: env().SHOP_ID } }, { productId, pageKey, file, altFi, altEn }));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = (await authenticateAdmin(request, "media.write")).actor;
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get("attachmentId");
    if (!attachmentId) throw new DomainError("VALIDATION_ERROR", "Attachment id is required", 422);

    const attachment = await db().query.mediaAttachments.findFirst({
      where: and(eq(mediaAttachments.id, attachmentId), eq(mediaAttachments.shopId, env().SHOP_ID)),
    });
    if (!attachment) throw new DomainError("NOT_FOUND", "Media attachment not found", 404);

    await db().delete(mediaAttachments).where(eq(mediaAttachments.id, attachmentId));

    if (attachment.pageKey === "logo") {
      await db().update(shops).set({ logoUrl: null }).where(eq(shops.id, env().SHOP_ID));
    } else if (attachment.pageKey === "favicon") {
      await db().update(shops).set({ faviconUrl: null }).where(eq(shops.id, env().SHOP_ID));
    }

    return success({ deleted: true, id: attachmentId, updatedBy: actor.email ?? actor.id });
  } catch (error) {
    return failure(error);
  }
}
