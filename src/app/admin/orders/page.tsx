import { db } from "@/db/client";
import { listManagerOrdersWithPaymentSummary } from "@/domain/orders";
import { ManagerView } from "../view";
import { adminContext, hasAdminPermission } from "../portal-auth";
import { AdminRouteFrame } from "../route-frame";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrdersPage() {
  const { request } = await adminContext();
  const allowed = await hasAdminPermission(request, "orders.read");
  if (!allowed) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to orders.</p></main></AdminRouteFrame>;
  return <AdminRouteFrame><ManagerView initialOrders={await listManagerOrdersWithPaymentSummary(db())} initialAvailability={[]} canViewOrders canManageAvailability={false} canExportOrders={await hasAdminPermission(request, "orders.export")} canCreateOrders={await hasAdminPermission(request, "orders.create")} canTransitionOrders={await hasAdminPermission(request, "orders.transition")} mode="orders" /></AdminRouteFrame>;
}
