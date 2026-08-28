import { z } from "zod";
import { createAdminProduct, listAdminProducts, reorderProducts } from "@/domain/admin-products-actions";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../response";
import { hasListQuery, parseAdminListQuery } from "@/lib/admin-list-query";
import { searchManagerProducts } from "@/domain/admin-search";
import { authenticateAdminAny, executeAdmin, parseJson } from "../module";

export const runtime = "nodejs";
const product = z.object({
  code: z.string(), slug: z.string(), nameFi: z.string(), nameEn: z.string(), descriptionFi: z.string().default(""), descriptionEn: z.string().default(""),
  availableFrom: z.string(), availableThrough: z.string(), active: z.boolean().default(true), showOnHomepage: z.boolean().default(true), showOnReserve: z.boolean().default(true),
  packages: z.array(z.object({ labelFi: z.string(), labelEn: z.string(), volumeMl: z.number().int(), priceCents: z.number().int(), active: z.boolean().default(true), sortOrder: z.number().int().optional(), isDefault: z.boolean().optional() })).min(1),
});

export async function GET(request: Request) { try { const result = await executeAdmin(request, { permission: "catalog.product.read", parse: async () => undefined, run: async (_input, { database, context }) => hasListQuery(request) ? searchManagerProducts(database, parseAdminListQuery(request), { status: ["in_season", "upcoming", "archived"].includes(new URL(request.url).searchParams.get("status") ?? "") ? new URL(request.url).searchParams.get("status") as "in_season" | "upcoming" | "archived" : undefined }) : listAdminProducts(database, { actor: context.actor, shop: { id: context.shop.shopId } }) }); return success(result); } catch (error) { return failure(error); } }
export async function POST(request: Request) {
  try {
    const result = await executeAdmin(request, { permission: "catalog.product.write", parse: async (incoming) => { const parsed = product.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid product command", 422); return parsed.data; }, run: async (input, { database, context }) => createAdminProduct(database, { actor: context.actor, shop: { id: context.shop.shopId } }, input) });
    return success(result, 201);
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    await authenticateAdminAny(request, ["catalog.product.write"]);
    const body = await parseJson<{ action?: string; productIds?: unknown }>(request);
    if (body?.action === "reorder" && Array.isArray(body.productIds)) {
      const result = await executeAdmin(request, { permission: "catalog.product.write", parse: async () => body.productIds as string[], run: async (productIds, { database, context }) => reorderProducts(database, { actor: context.actor, shop: { id: context.shop.shopId } }, productIds) });
      return success(result);
    }
    throw new DomainError("VALIDATION_ERROR", "Invalid product command", 422);
  } catch (error) { return failure(error); }
}
