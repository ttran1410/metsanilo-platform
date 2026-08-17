import { db } from "@/db/client";
import { getAuditMetrics, listAuditEntries } from "@/domain/audit";
import { MasterAuditWorkspace } from "./master-audit-workspace";
import { AdminRouteFrame } from "../route-frame";
import { adminContext, hasAdminPermission } from "../portal-auth";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const { request } = await adminContext();

  if (!(await hasAdminPermission(request, "audit.read"))) {
    return (
      <AdminRouteFrame permission="audit.read">
        <div />
      </AdminRouteFrame>
    );
  }

  const initialEntries = await listAuditEntries(db(), { page: 1, limit: 15, dateRange: "7d" });
  const metrics = await getAuditMetrics(db());

  const initialData = {
    ...initialEntries,
    metrics,
  };

  return (
    <AdminRouteFrame permission="audit.read">
      <MasterAuditWorkspace initialData={initialData} />
    </AdminRouteFrame>
  );
}
