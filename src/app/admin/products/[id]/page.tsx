import { db } from "@/db/client";
import { availability } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { listManagerProducts } from "@/domain/products";
import { AdminRouteFrame } from "../../route-frame";
import { adminContext, hasAdminPermission } from "../../portal-auth";
import { ProductDetailView } from "./view";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { request } = await adminContext();
  const id = (await params).id;
  if (!(await hasAdminPermission(request, "catalog.product.read"))) return <AdminRouteFrame permission="catalog.product.read"><div /></AdminRouteFrame>;
  const product = (await listManagerProducts(db())).find((item) => item.product.id === id);
  if (!product) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">Product not found.</p></main></AdminRouteFrame>;
  const availabilityRows = await db().select().from(availability).where(and(eq(availability.productId, id), eq(availability.shopId, product.product.shopId), gte(availability.businessDate, product.product.availableFrom)));
  return <AdminRouteFrame><main className="shell pb-10"><div className="admin-page-heading"><a className="back-link" href="/admin/products">← Product catalog</a><p className="eyebrow">CATALOG DETAIL</p><h1>{product.product.nameFi}</h1><p>{product.product.nameEn} · {product.product.code}</p></div><ProductDetailView initial={product} availabilityRows={availabilityRows} canEdit={await hasAdminPermission(request, "catalog.package.write")} canMedia={await hasAdminPermission(request, "media.write")} /></main></AdminRouteFrame>;
}
