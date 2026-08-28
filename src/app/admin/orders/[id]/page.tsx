import { AdminRouteFrame } from "../../route-frame";
import { adminContext, hasAdminPermission } from "../../portal-auth";
import { OrderDetailQueryLoader } from "./detail-query-loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ updated?: string }> }) {
  const { request } = await adminContext(); const id = (await params).id;
  if (!(await hasAdminPermission(request, "orders.read"))) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to order details.</p></main></AdminRouteFrame>;
  const initialMessage = (await searchParams)?.updated === "1" ? "Order updated successfully." : "";
  return <AdminRouteFrame><main className="shell admin-profile-page py-6"><OrderDetailQueryLoader orderId={id} initialNotice={initialMessage} canDelete={await hasAdminPermission(request, "orders.delete")} /></main></AdminRouteFrame>;
}
