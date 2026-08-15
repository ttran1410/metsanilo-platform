import { db } from "@/db/client";
import { getManagerOrder } from "@/domain/orders";
import { listManagerProducts } from "@/domain/products";
import { AdminRouteFrame } from "../../../route-frame";
import { adminContext, hasAdminPermission } from "../../../portal-auth";
import { OrderEditForm } from "./view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { request } = await adminContext();
  const id = (await params).id;
  if (!(await hasAdminPermission(request, "orders.update"))) return <AdminRouteFrame permission="orders.update"><div /></AdminRouteFrame>;
  try {
    const detail = await getManagerOrder(db(), id);
    return <AdminRouteFrame permission="orders.update"><main className="shell admin-profile-page"><div className="admin-page-heading"><a className="back-link" href={`/admin/orders/${id}`}>← Order detail</a><p className="eyebrow">ORDER EDIT</p><h1>{detail.order.publicReference}</h1><p>Update an open order. Completed and closed orders allow notes, payment corrections, and refunds only.</p></div><OrderEditForm initial={detail.order} products={await listManagerProducts(db())} /></main></AdminRouteFrame>;
  } catch { return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">Order not found.</p></main></AdminRouteFrame>; }
}
