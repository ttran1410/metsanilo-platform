import { db } from "@/db/client";
import { DomainError } from "@/domain/errors";
import { getReport, reportCsv, type ReportKey } from "@/domain/reports";
import { failure, success } from "../../../response";
import { authenticateAdmin } from "../../module";

export const runtime = "nodejs";

const permissions = { sales: "reports.sales.read", capacity: "reports.capacity.read", payments: "reports.payments.read", customers: "reports.customers.read" } as const;

function validDate(value: string | null, fallback: string) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback; }
function previousPeriod(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  end.setUTCDate(end.getUTCDate() - days);
  start.setUTCDate(start.getUTCDate() - days);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export async function GET(request: Request, context: { params: Promise<{ report: string }> }) {
  try {
    const { report: rawReport } = await context.params;
    if (!(rawReport in permissions)) throw new DomainError("NOT_FOUND", "Report not found", 404);
    const report = rawReport as ReportKey;
    await authenticateAdmin(request, permissions[report]);
    const url = new URL(request.url);
    const today = new Date().toISOString().slice(0, 10);
    const from = validDate(url.searchParams.get("from"), today);
    const to = validDate(url.searchParams.get("to"), today);
    if (from > to) throw new DomainError("VALIDATION_ERROR", "Report start date cannot be after end date", 422);
    const reportFilters = { from, to, productId: url.searchParams.get("productId") || undefined, method: (url.searchParams.get("method") as "PICKUP" | "DELIVERY" | null) ?? undefined, source: url.searchParams.get("source") || undefined, outcome: url.searchParams.get("outcome") || undefined, groupBy: (url.searchParams.get("groupBy") as "day" | "week" | "month" | null) ?? "day" };
    const data = await getReport(db(), reportFilters);
    const previous = previousPeriod(from, to);
    const previousData = await getReport(db(), { ...reportFilters, ...previous });
    const comparison = { from: previous.from, to: previous.to, fulfilledSalesCents: previousData.sales.fulfilledSalesCents, fulfilledLitresMl: previousData.sales.fulfilledLitresMl, fulfilledOrders: previousData.sales.fulfilledOrders, capacityUtilizationPercent: previousData.capacity.utilizationPercent };
    if (url.searchParams.get("format") === "csv") {
      return new Response(reportCsv(data, report), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="metsanilo-${report}-${from}-${to}.csv"` } });
    }
    return success({ ...data, comparison });
  } catch (error) { return failure(error, request); }
}
