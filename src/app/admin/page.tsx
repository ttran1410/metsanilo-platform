import { AdminDashboard } from "./dashboard/dashboard-workspace";
import { AdminRouteFrame } from "./route-frame";
import { adminContext, hasAdminPermission } from "./portal-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ManagerPage() {
  const { request } = await adminContext();
  const ordersAllowed = await hasAdminPermission(request, "orders.read");
  return <AdminRouteFrame>{ordersAllowed ? <AdminDashboard /> : <main className="shell py-10"><p className="card" role="alert">You do not have access to the dashboard.</p></main>}</AdminRouteFrame>;
}
