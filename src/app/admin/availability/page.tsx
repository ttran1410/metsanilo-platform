import { db } from "@/db/client";
import { getAvailabilityWorkspace, listManagerAvailability } from "@/domain/availability";
import { listManagerOrders } from "@/domain/orders";
import { ManagerView } from "../view";
import { adminContext, hasAdminPermission } from "../portal-auth";
import { AdminRouteFrame } from "../route-frame";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AvailabilityPage() {
  const { request } = await adminContext();
  const canRead = await hasAdminPermission(request, "availability.read");
  const canWrite = await hasAdminPermission(request, "availability.write");
  if (!canRead) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to availability.</p></main></AdminRouteFrame>;
  const database = db();
  const [availabilityRows, orders, workspace] = await Promise.all([listManagerAvailability(database), listManagerOrders(database), getAvailabilityWorkspace(database)]);
  return <AdminRouteFrame><ManagerView initialOrders={orders} initialAvailability={availabilityRows} canViewOrders={false} canViewAvailability canManageAvailability={canWrite} mode="availability" workspace={workspace} /></AdminRouteFrame>;
}
