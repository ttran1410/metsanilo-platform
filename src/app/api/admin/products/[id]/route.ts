import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { availability, orders } from "@/db/schema";
import { getProductReadiness, listManagerProducts } from "@/domain/products";
import { archiveProduct, deleteProduct, restoreProduct, updateProduct } from "@/domain/admin-products-actions";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";
import { failure, success } from "../../../response";
import { requirePermission } from "@/domain/access";


export const runtime = "nodejs";
const update = z.object({ code: z.string(), slug: z.string(), nameFi: z.string(), nameEn: z.string(), descriptionFi: z.string().default(""), descriptionEn: z.string().default(""), availableFrom: z.string(), availableThrough: z.string(), active: z.boolean(), showOnHomepage: z.boolean().default(true), showOnReserve: z.boolean().default(true) });
const command = z.discriminatedUnion("action", [z.object({ action: z.literal("update"), product: update }), z.object({ action: z.literal("active"), active: z.boolean() }), z.object({ action: z.literal("delete") })]);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(db(), request, "catalog.product.read");
    const { id } = await params;
    const all = await listManagerProducts(db());
    const found = all.find((item) => item.product.id === id);
    if (!found) throw new DomainError("NOT_FOUND", "Product not found", 404);

    const activeOrders = await db()
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.productId, id), eq(orders.shopId, env().SHOP_ID)));

    const availabilityCount = await db()
      .select({ id: availability.id })
      .from(availability)
      .where(and(eq(availability.productId, id), eq(availability.shopId, env().SHOP_ID)));

    const readiness = await getProductReadiness(db(), id);
    return success({
      ...found,
      readiness,
      impact: {
        activeOrders: activeOrders.length,
        availabilityRows: availabilityCount.length,
      },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = command.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid product command", 422);
    const { id } = await params;
    const actor = await requirePermission(db(), request, parsed.data.action === "delete" ? "catalog.product.delete" : "catalog.product.write");
    const context = { actor, shop: { id: env().SHOP_ID } };
    if (parsed.data.action === "delete") return success(await deleteProduct(db(), context, id));
    if (parsed.data.action === "active") return success(await (parsed.data.active ? restoreProduct(db(), context, id) : archiveProduct(db(), context, id)));
    return success(await updateProduct(db(), context, id, parsed.data.product));
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const actor = await requirePermission(db(), request, "catalog.product.delete"); return success(await deleteProduct(db(), { actor, shop: { id: env().SHOP_ID } }, (await params).id)); } catch (error) { return failure(error); }
}
