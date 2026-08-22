import { AdminRouteFrame } from "../route-frame";
import { adminContext, hasAdminPermission } from "../portal-auth";
import { ReportsWorkspace } from "./reports-workspace";

export default async function ReportsPage() {
  const { request } = await adminContext();
  const permissions = {
    sales: await hasAdminPermission(request, "reports.sales.read"),
    capacity: await hasAdminPermission(request, "reports.capacity.read"),
    payments: await hasAdminPermission(request, "reports.payments.read"),
    customers: await hasAdminPermission(request, "reports.customers.read"),
  };
  return <AdminRouteFrame><ReportsWorkspace permissions={permissions} /></AdminRouteFrame>;
}
