import { DomainError } from "@/domain/errors";
import { getReport, reportCsv, type ReportKey } from "@/domain/reports";
import { failure, success } from "../../../response";
import { executeAdmin } from "../../module";

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
    const result = await executeAdmin(request, { permission: permissions[report], parse: async () => new URL(request.url).searchParams, run: async (params, { database }) => {
    const today = new Date().toISOString().slice(0, 10);
    const from = validDate(params.get("from"), today);
    const to = validDate(params.get("to"), today);
    if (from > to) throw new DomainError("VALIDATION_ERROR", "Report start date cannot be after end date", 422);
    const reportFilters = { from, to, productId: params.get("productId") || undefined, method: (params.get("method") as "PICKUP" | "DELIVERY" | null) ?? undefined, source: params.get("source") || undefined, outcome: params.get("outcome") || undefined, groupBy: (params.get("groupBy") as "day" | "week" | "month" | null) ?? "day" };
    const data = await getReport(database, reportFilters);
    const previous = previousPeriod(from, to);
    const previousData = await getReport(database, { ...reportFilters, ...previous });
    const comparison = { from: previous.from, to: previous.to, fulfilledSalesCents: previousData.sales.fulfilledSalesCents, fulfilledLitresMl: previousData.sales.fulfilledLitresMl, fulfilledOrders: previousData.sales.fulfilledOrders, capacityUtilizationPercent: previousData.capacity.utilizationPercent };
    if (params.get("format") === "csv") {
      return new Response(reportCsv(data, report), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="metsanilo-${report}-${from}-${to}.csv"` } });
    }
    return success({ ...data, comparison });
    } });
    return result;
  } catch (error) { return failure(error, request); }
}
