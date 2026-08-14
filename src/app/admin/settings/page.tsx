import { OperationsSettings } from "../settings";
import { AdminRouteFrame } from "../route-frame";
export const dynamic = "force-dynamic";
export default function SettingsPage() { return <AdminRouteFrame permission="settings.operational"><OperationsSettings /></AdminRouteFrame>; }
