import type { ReactNode } from "react";
import { AdminNavigation } from "./navigation";
import { adminContext, adminNavigation } from "./portal-auth";

export async function AdminRouteFrame({ children }: { children: ReactNode }) {
  const { actor, request } = await adminContext();
  return <div className="admin-app"><AdminNavigation role={actor.role} displayName={actor.displayName} email={actor.email} items={await adminNavigation(request)} />{children}</div>;
}
