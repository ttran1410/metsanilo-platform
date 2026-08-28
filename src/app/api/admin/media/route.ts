import { db } from "@/db/client";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";
import { failure, success } from "../../response";
import { authenticateAdmin, executeAdmin } from "../module";
import { deleteAdminMediaAttachment, listAdminMedia, uploadAdminMedia } from "@/domain/admin-media-actions";

export const runtime = "nodejs";
const MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/x-icon"]);

export async function GET(request: Request) {
  try {
    const result = await executeAdmin(request, {
      permission: "media.write",
      parse: async () => new URL(request.url).searchParams,
      run: async (searchParams, { database, context: { actor } }) => {
        const productId = searchParams.get("productId");
        const pageKey = searchParams.get("pageKey");
        return listAdminMedia(database, { actor, shop: { id: env().SHOP_ID } }, { productId, pageKey });
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

    return success(await deleteAdminMediaAttachment(db(), { actor, shop: { id: env().SHOP_ID } }, attachmentId));
  } catch (error) {
    return failure(error);
  }
}
