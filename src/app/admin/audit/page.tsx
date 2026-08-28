import { db } from "@/db/client";
import { getAuditMetrics, listAuditEntries } from "@/domain/audit";
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
  const initialEntries = await listAuditEntries(db(), { page: urlState.currentPage, limit: 15, search: urlState.searchQuery, severity: urlState.severityFilter, category: urlState.categoryFilter, actor: urlState.actorFilter === "ALL" ? undefined : urlState.actorFilter, dateRange: urlState.dateRange });
  const metrics = await getAuditMetrics(db());
  const canExportAudit = await hasAdminPermission(request, "audit.export");

  const initialData = {
    ...initialEntries,
    metrics,
  };

  return (
    <AdminRouteFrame permission="audit.read">
      <MasterAuditWorkspace initialData={initialData} canExportAudit={canExportAudit} />
    </AdminRouteFrame>
  );
}
