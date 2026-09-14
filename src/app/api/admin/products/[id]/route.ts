import { z } from "zod";
import { getAdminProductDetailWithAvailability, archiveProduct, deleteProduct, restoreProduct, updateProduct } from "@/domain/admin-products-actions";
import { DomainError } from "@/domain/errors";
import { assertAdminPermission, executeAdminRoute, parseJson } from "../../module";

export const runtime = "nodejs";
const update = z.object({ code: z.string(), slug: z.string(), nameFi: z.string(), nameEn: z.string(), descriptionFi: z.string().default(""), descriptionEn: z.string().default(""), availableFrom: z.string(), availableThrough: z.string(), active: z.boolean(), showOnHomepage: z.boolean().default(true), showOnReserve: z.boolean().default(true) });
const command = z.discriminatedUnion("action", [z.object({ action: z.literal("update"), product: update }), z.object({ action: z.literal("active"), active: z.boolean() }), z.object({ action: z.literal("delete") })]);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "catalog.product.read",
    parse: async () => (await params).id,
    run: async (productId, { database, context }) => {
      const detail = await getAdminProductDetailWithAvailability(database, { actor: context.actor, shop: { id: context.shop.shopId } }, productId);
      if (!detail) throw new DomainError("NOT_FOUND", "Product not found", 404);
      return detail;
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permissions: ["catalog.product.write", "catalog.product.delete"],
    parse: async (incoming) => {
      const parsed = command.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid product command", 422);
      return parsed.data;
    },
    authorize: async (input, { context }) => {
      await assertAdminPermission(context, input.action === "delete" ? "catalog.product.delete" : "catalog.product.write");
    },
    run: async (input, { database, context }) => {
      const { id } = await params;
      const actionContext = { actor: context.actor, shop: { id: context.shop.shopId } };
      if (input.action === "delete") return deleteProduct(database, actionContext, id);
      if (input.action === "active") return input.active ? restoreProduct(database, actionContext, id) : archiveProduct(database, actionContext, id);
      return updateProduct(database, actionContext, id, input.product);
    },
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "catalog.product.delete",
    parse: async () => (await params).id,
    run: async (productId, { database, context }) => deleteProduct(database, { actor: context.actor, shop: { id: context.shop.shopId } }, productId),
  });
}
