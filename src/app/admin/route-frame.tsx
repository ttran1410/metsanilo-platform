import type { ReactNode } from "react";
import type { Permission } from "@/domain/access";
import { AdminNavigation } from "./navigation";
import { adminContext, adminNavigation, hasAdminPermission } from "./portal-auth";

export async function AdminRouteFrame({ children, permission }: { children: ReactNode; permission?: Permission }) {
  const { actor, request } = await adminContext();
  const allowed = permission ? await hasAdminPermission(request, permission) : true;
  return <div className="admin-app"><AdminNavigation role={actor.role} displayName={actor.displayName} email={actor.email} items={await adminNavigation(request)} /><div className="admin-shell-content">{allowed ? children : <main className="shell py-10"><p className="card" role="alert">You do not have permission to access this area.</p></main>}</div></div>;
}
