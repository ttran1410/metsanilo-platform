import type { Database } from "@/db/client";
import { env } from "@/lib/env";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";
import { deleteProduct as deleteProductDomain, setProductActive, updateProduct as updateProductDomain, reorderProducts as reorderProductsDomain, type ProductInput } from "./products";

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
