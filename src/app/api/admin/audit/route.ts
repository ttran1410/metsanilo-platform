import { failure, success } from "../../response";
import { executeAdmin } from "../module";
import { db } from "@/db/client";
import { getAuditMetrics, listAuditEntries, type AuditCategory, type AuditSeverity } from "@/domain/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const result = await executeAdmin(request, {
      permission: "audit.read",
      parse: async () => new URL(request.url).searchParams,
      run: async (params) => {
        const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
        const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? "15") || 15));
        const severity = (params.get("severity") ?? "ALL") as AuditSeverity | "ALL";
        const category = (params.get("category") ?? "ALL") as AuditCategory | "ALL";
        const actor = params.get("actor") ?? "ALL";
        const dateRange = (params.get("dateRange") ?? "all") as "24h" | "7d" | "30d" | "all";
        const [entries, metrics] = await Promise.all([
          listAuditEntries(db(), { page, limit, search: params.get("q") ?? params.get("search") ?? "", severity, category, actor, dateRange }),
          getAuditMetrics(db()),
        ]);
        return { ...entries, metrics };
      },
    });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
