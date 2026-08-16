"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdminOrder } from "../orders-listing";
import { AdminStatusBadge, formatAdminMoney } from "../presentation";

function cleanLitres(ml: number) {
  return `${(ml / 1000).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} L`;
}

export function PackingKanban({
  orders,
  canTransition,
  onRefresh,
}: {
  orders: AdminOrder[];
  canTransition: boolean;
  onRefresh: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const columns = useMemo(() => {
    const confirmed = orders.filter((o) => o.status === "CONFIRMED" || o.status === "NEW");
    const picking = orders.filter((o) => o.status === "PICKING");
    const ready = orders.filter((o) => o.status === "READY" || o.status === "OUT_FOR_DELIVERY");
    const fulfilled = orders.filter((o) => o.status === "PICKED_UP" || o.status === "DELIVERED");

    return [
      { key: "CONFIRMED", title: "🟡 CONFIRMED (To Pack)", orders: confirmed, nextStatus: "PICKING", nextLabel: "⚙️ Start Packing" },
      { key: "PICKING", title: "⚙️ PICKING (In Progress)", orders: picking, nextStatus: "READY", nextLabel: "📦 Mark Packed & Ready" },
      { key: "READY", title: "📦 READY (Staged)", orders: ready, nextStatus: "PICKED_UP", nextLabel: "✅ Mark Fulfilled" },
      { key: "FULFILLED", title: "⚪ FULFILLED (Completed)", orders: fulfilled, nextStatus: null, nextLabel: null },
    ];
  }, [orders]);

  async function handleTransition(orderId: string, nextStatus: string) {
    setBusyId(orderId);
    const response = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "transition", status: nextStatus }),
    });
    setBusyId(null);
    if (response.ok) onRefresh();
  }

  return (
    <div className="card p-4 md:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <span className="eyebrow text-primary">PACKING SHED TABLET BOARD</span>
          <h2 className="text-xl font-bold text-ink">Fulfillment Packing Kanban</h2>
        </div>
      </div>

      {/* KANBAN 4-COLUMN GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {columns.map((col) => (
          <div key={col.key} className="flex flex-col gap-3 bg-surface-muted/40 p-3 rounded-2xl border border-line">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h3 className="text-xs font-bold uppercase text-ink">{col.title}</h3>
              <span className="text-xs font-bold text-primary bg-surface px-2 py-0.5 rounded border border-line ops-tabular">
                {col.orders.length}
              </span>
            </div>

            <div className="flex flex-col gap-2.5 min-h-[400px]">
              {col.orders.map((order) => {
                const isBusy = busyId === order.id;

                return (
                  <div
                    key={order.id}
                    className="card p-3 flex flex-col justify-between gap-2 border hover:border-primary transition-colors shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 border-b border-line/60 pb-1.5">
                        <Link
                          className="font-bold text-primary text-xs hover:underline ops-tabular"
                          href={`/admin/orders/${order.id}`}
                        >
                          {order.publicReference}
                        </Link>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface border border-line text-ink">
                          {order.fulfillmentMethod === "PICKUP" ? "📍 Pickup" : "🚚 Delivery"}
                        </span>
                      </div>

                      <strong className="text-sm font-bold text-ink block mt-1">{order.customerName}</strong>
                      <span className="text-xs muted block">
                        {order.packageLabelFi} ({cleanLitres(order.volumeMl)})
                      </span>
                      <span className="text-[11px] text-ink/80 block mt-0.5">
                        📅 {order.fulfillmentDate}
                      </span>
                    </div>

                    {canTransition && col.nextStatus && col.nextLabel && (
                      <button
                        type="button"
                        className="btn btn-secondary text-xs py-1.5 w-full justify-center font-bold mt-1"
                        onClick={() => void handleTransition(order.id, col.nextStatus!)}
                        disabled={isBusy}
                      >
                        {isBusy ? "Updating…" : col.nextLabel}
                      </button>
                    )}
                  </div>
                );
              })}

              {col.orders.length === 0 && (
                <div className="py-8 text-center text-xs muted italic">No orders in this column</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
