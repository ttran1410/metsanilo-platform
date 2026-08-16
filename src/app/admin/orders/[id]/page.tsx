import { db } from "@/db/client";
import Link from "next/link";
import { getManagerOrder } from "@/domain/orders";
import { AdminRouteFrame } from "../../route-frame";
import { adminContext, hasAdminPermission } from "../../portal-auth";
import { OrderDetailView } from "./view";
import { OrderActionBar } from "../../order-action-bar";
import { OrderLifecycle } from "../../order-lifecycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ updated?: string }> }) {
  const { request } = await adminContext(); const id = (await params).id;
  if (!(await hasAdminPermission(request, "orders.read"))) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to order details.</p></main></AdminRouteFrame>;
  let detail; try { detail = await getManagerOrder(db(), id); } catch { return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">Order not found.</p></main></AdminRouteFrame>; }
  const initialMessage = (await searchParams)?.updated === "1" ? "Order updated successfully." : "";
  return <AdminRouteFrame><main className="shell admin-profile-page py-6"><OrderDetailView initial={detail} initialNotice={initialMessage} canDelete={await hasAdminPermission(request, "orders.delete")} /></main></AdminRouteFrame>;
}

