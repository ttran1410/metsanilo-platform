import { db } from "@/db/client";
import { listManagerOrdersWithPaymentSummary } from "@/domain/orders";
import { OrdersListing } from "../orders-listing";
import { adminContext, hasAdminPermission } from "../portal-auth";
import { AdminRouteFrame } from "../route-frame";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrdersPage({ searchParams }: { searchParams?: Promise<{ view?: string; status?: string }> }) {
  const { request } = await adminContext();
  const allowed = await hasAdminPermission(request, "orders.read");
  if (!allowed) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to orders.</p></main></AdminRouteFrame>;
  const query = await searchParams;
  const requestedView = query?.view?.toUpperCase();
  const validViews = new Set(["TRIAGE", "ALL", "TODAY", "NEEDS_CONFIRMATION", "PICKUP_TODAY", "DELIVERY_TODAY", "UNPAID"]);
  return <AdminRouteFrame><OrdersListing initialOrders={await listManagerOrdersWithPaymentSummary(db())} initialView={validViews.has(requestedView ?? "") ? requestedView as "TRIAGE" | "ALL" | "TODAY" | "NEEDS_CONFIRMATION" | "PICKUP_TODAY" | "DELIVERY_TODAY" | "UNPAID" : undefined} initialStatus={query?.status?.toUpperCase() ?? "ALL"} canExport={await hasAdminPermission(request, "orders.export")} canCreate={await hasAdminPermission(request, "orders.create")} canTransition={await hasAdminPermission(request, "orders.transition")} canUpdate={await hasAdminPermission(request, "orders.update")} /></AdminRouteFrame>;
}
