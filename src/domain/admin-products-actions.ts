import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { availability, orders } from "@/db/schema";
import { env } from "@/lib/env";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";
import { createPackage as createPackageDomain, createProduct as createProductDomain, deletePackage as deletePackageDomain, deleteProduct as deleteProductDomain, getProductReadiness, listManagerProducts, reorderPackages as reorderPackagesDomain, setDefaultPackage as setDefaultPackageDomain, setProductActive, updatePackage as updatePackageDomain, updateProduct as updateProductDomain, reorderProducts as reorderProductsDomain, type ProductInput } from "./products";
type PackageInput = Parameters<typeof createPackageDomain>[2];

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

export function listAdminProducts(database: Database, context: AdminActionContext) {
  assertAdminActionContext(context);
  return listManagerProducts(database);
}

export function createAdminProduct(database: Database, context: AdminActionContext, input: Parameters<typeof createProductDomain>[1]) {
  assertAdminActionContext(context);
  return createProductDomain(database, input);
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

export async function createAdminPackage(database: Database, context: AdminActionContext, productId: string, input: PackageInput) {
  assertAdminActionContext(context);
  return createPackageDomain(database, productId, input);
}

export async function updateAdminPackage(database: Database, context: AdminActionContext, packageId: string, input: PackageInput) {
  assertAdminActionContext(context);
  return updatePackageDomain(database, packageId, input);
}

export async function setAdminDefaultPackage(database: Database, context: AdminActionContext, packageId: string) {
  assertAdminActionContext(context);
  return setDefaultPackageDomain(database, packageId);
}

export async function deleteAdminPackage(database: Database, context: AdminActionContext, packageId: string) {
  assertAdminActionContext(context);
  return deletePackageDomain(database, packageId);
}

export async function reorderAdminPackages(database: Database, context: AdminActionContext, productId: string, packageIds: string[]) {
  assertAdminActionContext(context);
  return reorderPackagesDomain(database, productId, packageIds);
}
