import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { and, asc, eq, count } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEntries, mediaAttachments, mediaAssets, products, shops } from "@/db/schema";
import { requirePermission } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";
import { failure, success } from "../../response";

export const runtime = "nodejs";
const MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/x-icon"]);

export async function GET(request: Request) {
  try {
    await requirePermission(db(), request, "media.write");
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    const pageKey = url.searchParams.get("pageKey");

    if (!productId && !pageKey) throw new DomainError("VALIDATION_ERROR", "Product or page key is required", 422);

    const condition = productId
      ? and(eq(mediaAttachments.shopId, env().SHOP_ID), eq(mediaAttachments.productId, productId))
      : and(eq(mediaAttachments.shopId, env().SHOP_ID), eq(mediaAttachments.pageKey, pageKey!));

    const rows = await db()
      .select({ attachment: mediaAttachments, asset: mediaAssets })
      .from(mediaAttachments)
      .innerJoin(mediaAssets, eq(mediaAssets.id, mediaAttachments.assetId))
      .where(condition)
      .orderBy(asc(mediaAttachments.sortOrder));

    return success(rows.map((row) => ({ ...row.asset, sortOrder: row.attachment.sortOrder, isPrimary: row.attachment.isPrimary, attachmentId: row.attachment.id })));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(db(), request, "media.write");
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

    if (productId) {
      const product = await db().query.products.findFirst({ where: and(eq(products.id, productId), eq(products.shopId, env().SHOP_ID)) });
      if (!product) throw new DomainError("NOT_FOUND", "Product not found", 404);
    }

    const existingCondition = productId
      ? and(eq(mediaAttachments.shopId, env().SHOP_ID), eq(mediaAttachments.productId, productId))
      : and(eq(mediaAttachments.shopId, env().SHOP_ID), eq(mediaAttachments.pageKey, pageKey!));

    const existing = await db().select({ total: count() }).from(mediaAttachments).where(existingCondition);
    if (productId && Number(existing[0]?.total ?? 0) >= 4) {
      throw new DomainError("MEDIA_LIMIT", "A product can have at most 4 images", 409);
    }

    const now = new Date().toISOString();
    const assetId = randomUUID();
    const attachmentId = randomUUID();
    const pathPrefix = productId ? `products/${productId}` : `pages/${pageKey}`;
    const blob = await put(`${pathPrefix}/${file.name}`, file, { access: "public", addRandomSuffix: true, contentType: file.type });

    await db().insert(mediaAssets).values({
      id: assetId,
      shopId: env().SHOP_ID,
      url: blob.url,
      pathname: blob.pathname,
      mimeType: file.type,
      sizeBytes: file.size,
      altFi,
      altEn,
      captionFi: "",
      captionEn: "",
      active: true,
      createdAt: now,
    });

    await db().insert(mediaAttachments).values({
      id: attachmentId,
      shopId: env().SHOP_ID,
      assetId,
      productId: productId,
      pageKey: pageKey,
      sortOrder: Number(existing[0]?.total ?? 0),
      isPrimary: Number(existing[0]?.total ?? 0) === 0,
    });

    if (pageKey === "logo") {
      await db().update(shops).set({ logoUrl: blob.url }).where(eq(shops.id, env().SHOP_ID));
    } else if (pageKey === "favicon") {
      await db().update(shops).set({ faviconUrl: blob.url }).where(eq(shops.id, env().SHOP_ID));
    }

    await db().insert(auditEntries).values({
      id: randomUUID(),
      shopId: env().SHOP_ID,
      actor: actor.email ?? actor.id,
      action: "media.uploaded",
      entityType: pageKey ? "page_media" : "product",
      entityId: pageKey ?? productId!,
      detailsJson: JSON.stringify({ assetId, sizeBytes: file.size, pageKey }),
      createdAt: now,
    });

    return success({ ...blob, id: assetId, altFi, altEn, attachmentId });
  } catch (error) {
    return failure(error);
  }
}

