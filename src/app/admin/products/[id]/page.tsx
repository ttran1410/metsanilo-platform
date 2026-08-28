import Link from "next/link";
import { db } from "@/db/client";
import { availability } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { getAdminProductDetail } from "@/domain/admin-products-actions";
import { env } from "@/lib/env";
import { AdminRouteFrame } from "../../route-frame";
import { adminContext, hasAdminPermission } from "../../portal-auth";
import { AdminNotFoundState } from "../../presentation";
import { ProductDetailView } from "./view";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { request, actor } = await adminContext();
  const id = (await params).id;
  if (!(await hasAdminPermission(request, "catalog.product.read"))) return <AdminRouteFrame permission="catalog.product.read"><div /></AdminRouteFrame>;
  const product = await getAdminProductDetail(db(), { actor, shop: { id: env().SHOP_ID } }, id);
  if (!product) return <AdminRouteFrame><AdminNotFoundState title="Product Not Found" description="This product does not exist or has been removed from catalog." backHref="/admin/products" backLabel="← Return to product catalog" /></AdminRouteFrame>;
  const availabilityRows = await db().select().from(availability).where(and(eq(availability.productId, id), eq(availability.shopId, product.product.shopId), gte(availability.businessDate, product.product.availableFrom)));
  return <AdminRouteFrame><main className="shell pb-10"><div className="admin-page-heading"><Link className="back-link" href="/admin/products">← Product catalog</Link><p className="eyebrow">CATALOG DETAIL</p><h1>{product.product.nameFi}</h1><p>{product.product.nameEn} · {product.product.code}</p></div><ProductDetailView initial={product} availabilityRows={availabilityRows} canEdit={await hasAdminPermission(request, "catalog.package.write")} canMedia={await hasAdminPermission(request, "media.write")} /></main></AdminRouteFrame>;
}
