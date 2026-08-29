import { formatAdminMoney } from "../presentation";
import { formatOrderSourceBadge } from "./order-row-summary-utils";
import type { AdminOrder } from "./types/admin-order";

export function OrderRowSummaryCells({ order }: { order: AdminOrder }) {
  const isPaid = (order.outstandingCents ?? 0) <= 0;
  const isDelivery = order.fulfillmentMethod === "DELIVERY";
  const mapsUrl = isDelivery ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((order.streetAddress ? `${order.streetAddress}, ` : "") + (order.city || "Pori") + ", Finland")}` : null;
  return <>
    <td data-label="Fulfillment" className="p-3"><span className="font-bold block text-ink">{isDelivery ? "Delivery" : "Pickup"}</span><span className="muted text-[11px] block">{order.fulfillmentDate}</span>{mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-700 hover:underline inline-flex items-center gap-1 mt-0.5">Open route</a>}</td>
    <td data-label="Source" className="p-3">{formatOrderSourceBadge(order)}</td>
    <td data-label="Order" className="p-3"><span className="font-bold text-ink block">{order.packageLabelFi}</span><span className="muted text-[11px] block font-mono">{(order.volumeMl / 1000).toFixed(1)} L</span></td>
    <td data-label="Payment" className="p-3"><span className={`font-bold block ${isPaid ? "text-emerald-700" : "text-amber-800"}`}>{formatAdminMoney(order.finalTotalCents ?? order.itemSubtotalCents)}</span><span className="muted text-[11px] block">{isPaid ? "Paid" : "Unpaid"}</span></td>
  </>;
}
