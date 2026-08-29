"use client";

import { ProductsWorkspace, type ProductRow } from "./products-workspace";

export function ProductModule({
  initialProducts,
  canManageProducts,
  loadInitialFromApi = false,
}: {
  initialProducts: ProductRow[];
  canManageProducts: boolean;
  loadInitialFromApi?: boolean;
}) {
  return <ProductsWorkspace initialProducts={initialProducts} canManageProducts={canManageProducts} loadInitialFromApi={loadInitialFromApi} />;
}
