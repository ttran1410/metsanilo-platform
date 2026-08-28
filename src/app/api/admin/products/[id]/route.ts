import { z } from "zod";
import { db } from "@/db/client";
import { getAdminProductDetail, archiveProduct, deleteProduct, restoreProduct, updateProduct } from "@/domain/admin-products-actions";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";
import { failure, success } from "../../../response";
import { executeAdmin, parseJson, authenticateAdmin } from "../../module";


export const runtime = "nodejs";
const update = z.object({ code: z.string(), slug: z.string(), nameFi: z.string(), nameEn: z.string(), descriptionFi: z.string().default(""), descriptionEn: z.string().default(""), availableFrom: z.string(), availableThrough: z.string(), active: z.boolean(), showOnHomepage: z.boolean().default(true), showOnReserve: z.boolean().default(true) });
const command = z.discriminatedUnion("action", [z.object({ action: z.literal("update"), product: update }), z.object({ action: z.literal("active"), active: z.boolean() }), z.object({ action: z.literal("delete") })]);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await executeAdmin(request, { permission: "catalog.product.read", parse: async () => id, run: async (productId, { database, context }) => { const detail = await getAdminProductDetail(database, { actor: context.actor, shop: { id: env().SHOP_ID } }, productId); if (!detail) throw new DomainError("NOT_FOUND", "Product not found", 404); return detail; } });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = command.safeParse(await parseJson<unknown>(request)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid product command", 422);
    const { id } = await params;
    const actor = (await authenticateAdmin(request, parsed.data.action === "delete" ? "catalog.product.delete" : "catalog.product.write")).actor;
    const context = { actor, shop: { id: env().SHOP_ID } };
    if (parsed.data.action === "delete") return success(await deleteProduct(db(), context, id));
    if (parsed.data.action === "active") return success(await (parsed.data.active ? restoreProduct(db(), context, id) : archiveProduct(db(), context, id)));
    return success(await updateProduct(db(), context, id, parsed.data.product));
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const actor = (await authenticateAdmin(request, "catalog.product.delete")).actor; return success(await deleteProduct(db(), { actor, shop: { id: env().SHOP_ID } }, (await params).id)); } catch (error) { return failure(error); }
}
