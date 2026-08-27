import { CustomersModule } from "../customers";
import { AdminRouteFrame } from "../route-frame";
import { adminContext, hasAdminPermission } from "../portal-auth";
export const dynamic = "force-dynamic";
export default async function CustomersPage() { const { request } = await adminContext(); const canEdit = await hasAdminPermission(request, "customers.write"); const canAnonymize = await hasAdminPermission(request, "customers.anonymize"); const canRetention = await hasAdminPermission(request, "customers.retention.manage"); return <AdminRouteFrame permission="customers.read"><CustomersModule canEdit={canEdit} canAnonymize={canAnonymize} canRetention={canRetention} /></AdminRouteFrame>; }
