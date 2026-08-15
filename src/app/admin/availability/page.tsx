import { db } from "@/db/client";
import { getAvailabilityWorkspace } from "@/domain/availability";
import { AvailabilityWorkspace } from "./workspace";
import { adminContext, hasAdminPermission } from "../portal-auth";
import { AdminRouteFrame } from "../route-frame";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AvailabilityPage() {
  const { request } = await adminContext();
  const canRead = await hasAdminPermission(request, "availability.read");
  const canWrite = await hasAdminPermission(request, "availability.write");
  const canSoldOut = await hasAdminPermission(request, "availability.sold_out");
  if (!canRead) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to availability.</p></main></AdminRouteFrame>;
  const database = db();
  const workspace = await getAvailabilityWorkspace(database);
  return <AdminRouteFrame><AvailabilityWorkspace initialWorkspace={workspace} canManage={canWrite} canSoldOut={canSoldOut} /></AdminRouteFrame>;
}
