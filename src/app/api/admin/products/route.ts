import { z } from "zod";
import { db } from "@/db/client";
import { createProduct, listManagerProducts } from "@/domain/products";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../response";
import { requirePermission } from "@/domain/access";

export const runtime = "nodejs";
const product = z.object({
  code: z.string(), slug: z.string(), nameFi: z.string(), nameEn: z.string(), descriptionFi: z.string().default(""), descriptionEn: z.string().default(""),
  availableFrom: z.string(), availableThrough: z.string(), active: z.boolean().default(true), showOnHomepage: z.boolean().default(true), showOnReserve: z.boolean().default(true),
  packages: z.array(z.object({ labelFi: z.string(), labelEn: z.string(), volumeMl: z.number().int(), priceCents: z.number().int(), active: z.boolean().default(true), sortOrder: z.number().int().optional(), isDefault: z.boolean().optional() })).min(1),
});

export async function GET(request: Request) { try { await requirePermission(db(), request, "catalog.product.read"); return success(await listManagerProducts(db())); } catch (error) { return failure(error); } }
export async function POST(request: Request) {
  try {
    await requirePermission(db(), request, "catalog.product.write");
    const parsed = product.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid product command", 422);
    return success(await createProduct(db(), parsed.data), 201);
  } catch (error) { return failure(error); }
}
