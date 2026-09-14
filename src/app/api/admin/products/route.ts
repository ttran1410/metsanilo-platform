import { z } from "zod";
import { createAdminProduct, getAdminProducts, listAdminProducts, reorderProducts } from "@/domain/admin-products-actions";
import { DomainError } from "@/domain/errors";
import { hasListQuery, parseAdminListQuery } from "@/lib/admin-list-query";
import { executeAdminRoute, parseJson } from "../module";

export const runtime = "nodejs";
const product = z.object({
  code: z.string(), slug: z.string(), nameFi: z.string(), nameEn: z.string(), descriptionFi: z.string().default(""), descriptionEn: z.string().default(""),
  availableFrom: z.string(), availableThrough: z.string(), active: z.boolean().default(true), showOnHomepage: z.boolean().default(true), showOnReserve: z.boolean().default(true),
  packages: z.array(z.object({ labelFi: z.string(), labelEn: z.string(), volumeMl: z.number().int(), priceCents: z.number().int(), active: z.boolean().default(true), sortOrder: z.number().int().optional(), isDefault: z.boolean().optional() })).min(1),
});

export async function GET(request: Request) {
  return executeAdminRoute(request, {
    permission: "catalog.product.read",
    run: async (_input, { database, context }) => {
      const actionContext = { actor: context.actor, shop: { id: context.shop.shopId } };
      if (!hasListQuery(request)) return listAdminProducts(database, actionContext);
      const status = new URL(request.url).searchParams.get("status");
      return getAdminProducts(database, actionContext, parseAdminListQuery(request), status === "in_season" || status === "upcoming" || status === "archived" ? status : undefined);
    },
  });
}

export async function POST(request: Request) {
  return executeAdminRoute(request, {
    permission: "catalog.product.write",
    status: 201,
    parse: async (incoming) => {
      const parsed = product.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid product command", 422);
      return parsed.data;
    },
    run: async (input, { database, context }) => createAdminProduct(database, { actor: context.actor, shop: { id: context.shop.shopId } }, input),
  });
}

export async function PATCH(request: Request) {
  return executeAdminRoute(request, {
    permission: "catalog.product.write",
    parse: async (incoming) => {
      const body = await parseJson<{ action?: string; productIds?: unknown }>(incoming);
      if (body?.action === "reorder" && Array.isArray(body.productIds)) {
        return body.productIds as string[];
      }
      throw new DomainError("VALIDATION_ERROR", "Invalid product command", 422);
    },
    run: async (productIds, { database, context }) => reorderProducts(database, { actor: context.actor, shop: { id: context.shop.shopId } }, productIds),
  });
}

