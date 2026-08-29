import type { AdminOrder } from "../types/admin-order";

export function formatOrderSourceBadge(order: AdminOrder) {
  const labels: Record<string, string> = { WEBSITE: "Website", SMS: "SMS", WHATSAPP: "WhatsApp", FACEBOOK_MESSAGE: "Facebook", FACEBOOK: "Facebook", MANUAL: "Phone", PHONE: "Phone", HISTORICAL: "Phone" };
  const label = labels[order.orderSource?.toUpperCase() ?? "WEBSITE"] ?? order.orderSource ?? "Website";
  return <div className="inline-flex items-center gap-1"><span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-muted border border-line inline-flex items-center gap-1 text-ink"><span>{label}</span></span>{order.historicalEntry && <span className="text-xs cursor-help select-none" title="Imported from Historical CSV record">Historical</span>}</div>;
}
