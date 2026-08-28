import Link from "next/link";
import { AdminRouteFrame } from "../../route-frame";
import { adminContext, hasAdminPermission } from "../../portal-auth";
import { ProductDetailView } from "./view";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { request } = await adminContext();
  const id = (await params).id;
  if (!(await hasAdminPermission(request, "catalog.product.read"))) return <AdminRouteFrame permission="catalog.product.read"><div /></AdminRouteFrame>;
  return <AdminRouteFrame><main className="shell pb-10"><div className="admin-page-heading"><Link className="back-link" href="/admin/products">← Product catalog</Link><p className="eyebrow">CATALOG DETAIL</p><h1>Product detail</h1><p>Review product packages, availability, media and readiness.</p></div><ProductDetailView productId={id} loadInitialFromApi canEdit={await hasAdminPermission(request, "catalog.package.write")} canMedia={await hasAdminPermission(request, "media.write")} /></main></AdminRouteFrame>;
}
