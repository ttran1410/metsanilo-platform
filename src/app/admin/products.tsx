"use client";

import { MasterDetailWorkspace, type ProductRow } from "./products/master-detail-workspace";

export function ProductModule({
  initialProducts,
  canManageProducts,
  loadInitialFromApi = false,
}: {
  initialProducts: ProductRow[];
  canManageProducts: boolean;
  loadInitialFromApi?: boolean;
}) {
  return <MasterDetailWorkspace initialProducts={initialProducts} canManageProducts={canManageProducts} loadInitialFromApi={loadInitialFromApi} />;
}
