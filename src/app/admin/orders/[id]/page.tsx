import { db } from "@/db/client";
import { getManagerOrder } from "@/domain/orders";
import { AdminRouteFrame } from "../../route-frame";
import { adminContext, hasAdminPermission } from "../../portal-auth";
import { OrderDetailView } from "./view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { request } = await adminContext(); const id = (await params).id;
  if (!(await hasAdminPermission(request, "orders.read"))) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to order details.</p></main></AdminRouteFrame>;
  let detail; try { detail = await getManagerOrder(db(), id); } catch { return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">Order not found.</p></main></AdminRouteFrame>; }
  return <AdminRouteFrame><main className="shell admin-profile-page"><div className="admin-page-heading"><a className="back-link" href="/admin/orders">← Order queue</a><p className="eyebrow">ORDER DETAIL</p><h1>{detail.order.publicReference}</h1><p>{detail.order.customerName} · {detail.order.fulfillmentDate} · {detail.order.fulfillmentMethod}</p></div><OrderDetailView initial={detail} /></main></AdminRouteFrame>;
}
