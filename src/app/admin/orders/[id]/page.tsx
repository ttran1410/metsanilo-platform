import { db } from "@/db/client";
import { getManagerOrder } from "@/domain/orders";
import { AdminRouteFrame } from "../../route-frame";
import { adminContext, hasAdminPermission } from "../../portal-auth";
import { AdminNotFoundState } from "../../presentation";
import { OrderDetailView } from "./view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ updated?: string }> }) {
  const { request } = await adminContext(); const id = (await params).id;
  if (!(await hasAdminPermission(request, "orders.read"))) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to order details.</p></main></AdminRouteFrame>;
  let detail; try { detail = await getManagerOrder(db(), id); } catch { return <AdminRouteFrame><AdminNotFoundState title="Order Not Found" description={`No order matching ID or reference "${id}" was found in database.`} backHref="/admin/orders" backLabel="← Return to orders list" /></AdminRouteFrame>; }
  const initialMessage = (await searchParams)?.updated === "1" ? "Order updated successfully." : "";
  return <AdminRouteFrame><main className="shell admin-profile-page py-6"><OrderDetailView initial={detail} initialNotice={initialMessage} canDelete={await hasAdminPermission(request, "orders.delete")} /></main></AdminRouteFrame>;
}

