"use client";

import type { packages, products } from "@/db/schema";
import { MasterDetailWorkspace } from "./products/master-detail-workspace";

type ProductRow = {
  product: typeof products.$inferSelect;
  packages: Array<typeof packages.$inferSelect>;
  media?: Array<{ id: string; attachmentId?: string; url: string; altFi: string; altEn: string; isPrimary: boolean }>;
};

export function ProductModule({
  initialProducts,
  canManageProducts,
}: {
  initialProducts: ProductRow[];
  canManageProducts: boolean;
}) {
  return <MasterDetailWorkspace initialProducts={initialProducts} canManageProducts={canManageProducts} />;
}
