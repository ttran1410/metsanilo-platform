import { OperationsSettings } from "../settings";
import { AdminRouteFrame } from "../route-frame";
import { adminContext, hasAdminPermission } from "../portal-auth";
export const dynamic = "force-dynamic";
export default async function SettingsPage() { const { request } = await adminContext(); const [canManageSettings, canManageTheme] = await Promise.all([hasAdminPermission(request, "settings.operational"), hasAdminPermission(request, "theme.manage")]); return <AdminRouteFrame permission="settings.read"><OperationsSettings canManageSettings={canManageSettings} canManageTheme={canManageTheme} /></AdminRouteFrame>; }
