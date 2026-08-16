import type { ReactNode } from "react";
import type { Permission } from "@/domain/access";
import { AdminNavigation } from "./navigation";
import { adminContext, adminNavigation, hasAdminPermission } from "./portal-auth";
import { AdminPermissionState } from "./presentation";
import { AdminI18nProvider } from "./i18n-context";

export async function AdminRouteFrame({ children, permission }: { children: ReactNode; permission?: Permission }) {
  const { actor, request } = await adminContext();
  const allowed = permission ? await hasAdminPermission(request, permission) : true;
  return (
    <AdminI18nProvider>
      <div className="admin-app">
        <AdminNavigation role={actor.role} displayName={actor.displayName} email={actor.email} items={await adminNavigation(request)} />
        <div className="admin-shell-content">{allowed ? children : <AdminPermissionState />}</div>
      </div>
    </AdminI18nProvider>
  );
}
