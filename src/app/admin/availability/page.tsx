import { db } from "@/db/client";
import { listManagerAvailability } from "@/domain/availability";
import { ManagerView } from "../view";
import { adminContext, hasAdminPermission } from "../portal-auth";
import { AdminRouteFrame } from "../route-frame";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AvailabilityPage() {
  const { request } = await adminContext();
  const allowed = await hasAdminPermission(request, "availability.write");
  if (!allowed) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to availability.</p></main></AdminRouteFrame>;
  return <AdminRouteFrame><ManagerView initialOrders={[]} initialAvailability={await listManagerAvailability(db())} canViewOrders={false} canManageAvailability mode="availability" /></AdminRouteFrame>;
}
