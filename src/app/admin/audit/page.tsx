import { db } from "@/db/client";
import { getAuditMetrics } from "@/domain/audit";
import { MasterAuditWorkspace } from "./master-audit-workspace";
import { AdminRouteFrame } from "../route-frame";
import { adminContext, hasAdminPermission } from "../portal-auth";
import { parseAuditUrlState } from "../audit-url-state";

export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { request } = await adminContext();

  if (!(await hasAdminPermission(request, "audit.read"))) {
    return (
      <AdminRouteFrame permission="audit.read">
        <div />
      </AdminRouteFrame>
    );
  }

  const query = await searchParams;
  const urlState = parseAuditUrlState(new URLSearchParams(Object.entries(query).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value[0] : value]])));
  const metrics = await getAuditMetrics(db());
  const canExportAudit = await hasAdminPermission(request, "audit.export");

  const initialData = {
    items: [], total: 0, page: urlState.currentPage, limit: 15, totalPages: 1, actors: [],
    metrics,
  };

  return (
    <AdminRouteFrame permission="audit.read">
      <MasterAuditWorkspace initialData={initialData} loadInitialFromApi canExportAudit={canExportAudit} />
    </AdminRouteFrame>
  );
}
