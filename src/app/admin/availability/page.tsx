import { db } from "@/db/client";
import { listManagerAvailability } from "@/domain/availability";
import { AdminNavigation } from "../navigation";
import { ManagerView } from "../view";
import { adminContext, adminNavigation, hasAdminPermission } from "../portal-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AvailabilityPage() {
  const { actor, request } = await adminContext();
  const allowed = await hasAdminPermission(request, "availability.write");
  if (!allowed) return <div className="admin-app"><AdminNavigation role={actor.role} displayName={actor.displayName} email={actor.email} items={await adminNavigation(request)} /><main className="shell py-10"><p className="card" role="alert">You do not have access to availability.</p></main></div>;
  const navigation = await adminNavigation(request);
  return <div className="admin-app"><AdminNavigation role={actor.role} displayName={actor.displayName} email={actor.email} items={navigation} /><ManagerView initialOrders={[]} initialAvailability={await listManagerAvailability(db())} canViewOrders={false} canManageAvailability mode="availability" /></div>;
}
