import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { availability, orders } from "@/db/schema";
import { env } from "@/lib/env";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";
import { deleteProduct as deleteProductDomain, getProductReadiness, listManagerProducts, setProductActive, updateProduct as updateProductDomain, reorderProducts as reorderProductsDomain, type ProductInput } from "./products";

export async function getAdminProductDetail(database: Database, context: AdminActionContext, productId: string) {
  assertAdminActionContext(context);
  const all = await listManagerProducts(database, [productId]);
  const found = all.find((item) => item.product.id === productId);
  if (!found) return null;
  const [activeOrders, availabilityRows] = await Promise.all([
    database.select({ id: orders.id }).from(orders).where(and(eq(orders.productId, productId), eq(orders.shopId, context.shop.id))),
    database.select({ id: availability.id }).from(availability).where(and(eq(availability.productId, productId), eq(availability.shopId, context.shop.id))),
  ]);
  return { ...found, readiness: await getProductReadiness(database, productId), impact: { activeOrders: activeOrders.length, availabilityRows: availabilityRows.length } };
}

export async function archiveProduct(database: Database, context: AdminActionContext, productId: string) {
  assertAdminActionContext(context);
  if (context.shop.id !== env().SHOP_ID) throw new Error("Admin action shop is not active");
  return setProductActive(database, productId, false);
}

export async function restoreProduct(database: Database, context: AdminActionContext, productId: string) {
  assertAdminActionContext(context);
  if (context.shop.id !== env().SHOP_ID) throw new Error("Admin action shop is not active");
  return setProductActive(database, productId, true);
}

export async function deleteProduct(database: Database, context: AdminActionContext, productId: string) {
  assertAdminActionContext(context);
  if (context.shop.id !== env().SHOP_ID) throw new Error("Admin action shop is not active");
  return deleteProductDomain(database, productId);
}

export async function updateProduct(database: Database, context: AdminActionContext, productId: string, input: ProductInput) {
  assertAdminActionContext(context);
  if (context.shop.id !== env().SHOP_ID) throw new Error("Admin action shop is not active");
  return updateProductDomain(database, productId, input);
}

export async function reorderProducts(database: Database, context: AdminActionContext, productIds: string[]) {
  assertAdminActionContext(context);
  if (context.shop.id !== env().SHOP_ID) throw new Error("Admin action shop is not active");
  return reorderProductsDomain(database, productIds);
}
