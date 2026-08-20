import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { getAuditMetrics, listAuditEntries } from "@/domain/audit";
import { adminContext, hasAdminPermission } from "@/app/admin/portal-auth";
import type { AuditCategory, AuditSeverity } from "@/domain/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { request: req } = await adminContext();
  if (!(await hasAdminPermission(req, "audit.read"))) {
    return NextResponse.json({ message: "Forbidden: Audit access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "15", 10);
  const search = searchParams.get("search") ?? "";
  const severity = (searchParams.get("severity") ?? "ALL") as AuditSeverity | "ALL";
  const category = (searchParams.get("category") ?? "ALL") as AuditCategory | "ALL";
  const actor = searchParams.get("actor") ?? "ALL";
  const dateRange = (searchParams.get("dateRange") ?? "all") as "24h" | "7d" | "30d" | "all";

  const result = await listAuditEntries(db(), {
    page,
    limit,
    search,
    severity,
    category,
    actor,
    dateRange,
  });

  const metrics = await getAuditMetrics(db());

  return NextResponse.json({
    data: {
      ...result,
      metrics,
    },
  });
}
