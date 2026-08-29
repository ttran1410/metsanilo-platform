import { OrdersListing, type OrdersView } from "../orders/list/orders-listing";
import { adminContext, hasAdminPermission } from "../portal-auth";
import { AdminRouteFrame } from "../route-frame";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrdersPage({ searchParams }: { searchParams?: Promise<{ view?: string; status?: string; created?: string }> }) {
  const { request } = await adminContext();
  const allowed = await hasAdminPermission(request, "orders.read");
  if (!allowed) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to orders.</p></main></AdminRouteFrame>;
  const query = await searchParams;
  const requestedView = query?.view?.toUpperCase();
  const validViews = new Set<OrdersView>(["TRIAGE", "ALL", "TODAY", "NEEDS_CONFIRMATION", "PICKUP_TODAY", "DELIVERY_TODAY", "UNPAID", "ARCHIVED"]);
  const initialView = validViews.has(requestedView as OrdersView) ? requestedView as OrdersView : undefined;
  return (
    <AdminRouteFrame>
      <OrdersListing
        key={`${initialView ?? "TODAY"}:${query?.status?.toUpperCase() ?? "ALL"}`}
        loadInitialFromApi
        initialView={initialView}
        initialStatus={query?.status?.toUpperCase() ?? "ALL"}
        initialCreatedId={query?.created}
        canExport={await hasAdminPermission(request, "orders.export")}
        canCreate={await hasAdminPermission(request, "orders.create")}
        canTransition={await hasAdminPermission(request, "orders.transition")}
        canRecordPayment={await hasAdminPermission(request, "orders.payment.write")}
        canUpdate={await hasAdminPermission(request, "orders.update")}
        canDelete={await hasAdminPermission(request, "orders.delete")}
        canArchive={await hasAdminPermission(request, "orders.archive")}
      />
    </AdminRouteFrame>
  );
}
