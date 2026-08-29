import { AdminStatusBadge } from "../presentation";
import type { AdminOrder } from "../orders-listing";

export function OrderRowStatusCell({ order }: { order: AdminOrder }) {
  return <td data-label="Status" className="p-3"><div className="flex flex-col items-start gap-1"><AdminStatusBadge status={order.status} />{order.archived && <span className="text-[10px] font-bold text-purple-900 bg-purple-100 px-1.5 py-0.2 rounded border border-purple-300">Archived</span>}</div></td>;
}
