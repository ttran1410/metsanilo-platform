import { db } from "@/db/client";
import { DashboardModule } from "./dashboard";
import { AdminNavigation } from "./navigation";
import { adminContext, adminNavigation } from "./portal-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ManagerPage() {
  const { actor, request } = await adminContext();
  const navigation = await adminNavigation(request);
  const ordersAllowed = navigation[0].enabled;
  return <div className="admin-app"><AdminNavigation role={actor.role} displayName={actor.displayName} email={actor.email} items={navigation} />
    {ordersAllowed && <DashboardModule />}
  </div>;
}
