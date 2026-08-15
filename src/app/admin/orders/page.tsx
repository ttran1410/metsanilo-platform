import { db } from "@/db/client";
import { listManagerOrders } from "@/domain/orders";
import { ManagerView } from "../view";
import { adminContext, hasAdminPermission } from "../portal-auth";
import { AdminRouteFrame } from "../route-frame";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrdersPage() {
  const { request } = await adminContext();
  const allowed = await hasAdminPermission(request, "orders.read");
  if (!allowed) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to orders.</p></main></AdminRouteFrame>;
  return <AdminRouteFrame><div className="shell pt-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">OPERATIONS</p><h1 className="text-3xl font-semibold">Orders workspace</h1><p className="text-slate-600">Website, phone, SMS, WhatsApp and historical orders in one queue.</p></div>{await hasAdminPermission(request, "orders.create") && <a className="btn" href="/admin/manual-orders">+ Create order</a>}</div></div><ManagerView initialOrders={await listManagerOrders(db())} initialAvailability={[]} canViewOrders canManageAvailability={false} canExportOrders={await hasAdminPermission(request, "orders.export")} mode="orders" /></AdminRouteFrame>;
}
