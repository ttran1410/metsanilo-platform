import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { listAuditEntries } from "@/domain/audit";
import { authenticateAdmin } from "@/app/api/admin/module";
import { failure } from "@/app/api/response";
import type { AuditCategory, AuditSeverity } from "@/domain/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
  await authenticateAdmin(request, "audit.export");

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "csv";
  const search = searchParams.get("search") ?? "";
  const severity = (searchParams.get("severity") ?? "ALL") as AuditSeverity | "ALL";
  const category = (searchParams.get("category") ?? "ALL") as AuditCategory | "ALL";
  const actor = searchParams.get("actor") ?? "ALL";
  const dateRange = (searchParams.get("dateRange") ?? "all") as "24h" | "7d" | "30d" | "all";

  // Fetch all matching records without pagination for full export
  const result = await listAuditEntries(db(), {
    page: 1,
    limit: 10000,
    search,
    severity,
    category,
    actor,
    dateRange,
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    const jsonBody = JSON.stringify(result.items, null, 2);
    return new NextResponse(jsonBody, {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="security-audit-export-${todayStr}.json"`,
      },
    });
  }

  // Generate CSV
  const headers = ["Timestamp", "Actor", "Role/Email", "Severity", "Category", "Action", "Entity Type", "Entity ID", "Correlation ID", "Summary / Reason", "Raw JSON"];
  const rows = result.items.map((item) => {
    return [
      `"${item.createdAt}"`,
      `"${item.actorDisplayName ?? item.actor}"`,
      `"${item.actorEmail ?? ""}"`,
      `"${item.severity}"`,
      `"${item.category}"`,
      `"${item.action}"`,
      `"${item.entityType}"`,
      `"${item.entityId}"`,
      `"${item.correlationId ?? ""}"`,
      `"${(item.diff.summary + (item.diff.reason ? ` - ${item.diff.reason}` : "")).replace(/"/g, '""')}"`,
      `"${item.detailsJson.replace(/"/g, '""')}"`,
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="security-audit-export-${todayStr}.csv"`,
    },
  });
  } catch (error) { return failure(error); }
}
