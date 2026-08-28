import { db } from "@/db/client";
import { getAdminProductDetail } from "@/domain/admin-products-actions";
import { env } from "@/lib/env";
import { AdminRouteFrame } from "../../../route-frame";
import { adminContext, hasAdminPermission } from "../../../portal-auth";
import { ProductEditView } from "./view";

export const dynamic = "force-dynamic";

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { request, actor } = await adminContext(); const id = (await params).id;
  if (!(await hasAdminPermission(request, "catalog.product.write"))) return <AdminRouteFrame permission="catalog.product.write"><div /></AdminRouteFrame>;
  const product = await getAdminProductDetail(db(), { actor, shop: { id: env().SHOP_ID } }, id);
  if (!product) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">Product not found.</p></main></AdminRouteFrame>;
  return <AdminRouteFrame><main className="shell pb-10"><div className="admin-page-heading"><a className="back-link" href={`/admin/products/${id}`}>← Product detail</a><p className="eyebrow">CATALOG EDIT</p><h1>Edit {product.product.nameFi}</h1><p>Changes are checked against active orders and reserved availability before saving.</p></div><ProductEditView initial={product.product} impact={product.impact} /></main></AdminRouteFrame>;
}
