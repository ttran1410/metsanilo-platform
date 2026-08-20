import { z } from "zod";
import { db } from "@/db/client";
import { createProduct, listManagerProducts, reorderProducts } from "@/domain/products";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../response";
import { requirePermission } from "@/domain/access";
import { hasListQuery, parseAdminListQuery } from "@/lib/admin-list-query";
import { searchManagerProducts } from "@/domain/admin-search";

export const runtime = "nodejs";
const product = z.object({
  code: z.string(), slug: z.string(), nameFi: z.string(), nameEn: z.string(), descriptionFi: z.string().default(""), descriptionEn: z.string().default(""),
  availableFrom: z.string(), availableThrough: z.string(), active: z.boolean().default(true), showOnHomepage: z.boolean().default(true), showOnReserve: z.boolean().default(true),
  packages: z.array(z.object({ labelFi: z.string(), labelEn: z.string(), volumeMl: z.number().int(), priceCents: z.number().int(), active: z.boolean().default(true), sortOrder: z.number().int().optional(), isDefault: z.boolean().optional() })).min(1),
});

export async function GET(request: Request) { try { await requirePermission(db(), request, "catalog.product.read"); if (hasListQuery(request)) return success(await searchManagerProducts(db(), parseAdminListQuery(request))); return success(await listManagerProducts(db())); } catch (error) { return failure(error); } }
export async function POST(request: Request) {
  try {
    await requirePermission(db(), request, "catalog.product.write");
    const parsed = product.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid product command", 422);
    return success(await createProduct(db(), parsed.data), 201);
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    await requirePermission(db(), request, "catalog.product.write");
    const body = await request.json();
    if (body?.action === "reorder" && Array.isArray(body.productIds)) {
      const updated = await reorderProducts(db(), body.productIds);
      return success(updated);
    }
    throw new DomainError("VALIDATION_ERROR", "Invalid product command", 422);
  } catch (error) { return failure(error); }
}
