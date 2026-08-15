import { z } from "zod";
import { db } from "@/db/client";
import { deleteProduct, setProductActive, updateProduct } from "@/domain/products";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";
import { requirePermission } from "@/domain/access";

export const runtime = "nodejs";
const update = z.object({ code: z.string(), slug: z.string(), nameFi: z.string(), nameEn: z.string(), descriptionFi: z.string().default(""), descriptionEn: z.string().default(""), availableFrom: z.string(), availableThrough: z.string(), active: z.boolean(), showOnHomepage: z.boolean().default(true), showOnReserve: z.boolean().default(true) });
const command = z.discriminatedUnion("action", [z.object({ action: z.literal("update"), product: update }), z.object({ action: z.literal("active"), active: z.boolean() }), z.object({ action: z.literal("delete") })]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = command.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid product command", 422);
    const { id } = await params;
    await requirePermission(db(), request, parsed.data.action === "delete" ? "catalog.product.delete_unreferenced" : "catalog.product.write");
    if (parsed.data.action === "delete") return success(await deleteProduct(db(), id));
    if (parsed.data.action === "active") return success(await setProductActive(db(), id, parsed.data.active));
    return success(await updateProduct(db(), id, parsed.data.product));
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requirePermission(db(), request, "catalog.product.delete_unreferenced"); return success(await deleteProduct(db(), (await params).id)); } catch (error) { return failure(error); }
}
