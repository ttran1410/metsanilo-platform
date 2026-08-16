"use client";

import { useMemo } from "react";
import type { AdminOrder } from "../orders-listing";

function formatLitres(ml: number) {
  return `${(ml / 1000).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} L`;
}

export function BatchPackingSlip({
  orders,
  date,
  onClose,
}: {
  orders: AdminOrder[];
  date: string;
  onClose: () => void;
}) {
  const dayOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        (o.fulfillmentDate === date || !date) &&
        !["CANCELLED", "REJECTED", "NO_SHOW", "CUSTOMER_DECLINED"].includes(o.status)
    );
  }, [orders, date]);

  const totalVolumeMl = useMemo(() => {
    return dayOrders.reduce((sum, o) => sum + o.volumeMl, 0);
  }, [dayOrders]);

  const packageBreakdown = useMemo(() => {
    const counts: Record<string, { label: string; count: number; volumeMl: number }> = {};
    for (const o of dayOrders) {
      const key = o.packageLabelFi;
      if (!counts[key]) counts[key] = { label: o.packageLabelFi, count: 0, volumeMl: 0 };
      counts[key].count += o.quantity;
      counts[key].volumeMl += o.volumeMl;
    }
    return Object.values(counts);
  }, [dayOrders]);

  const groupedByLocation = useMemo(() => {
    const groups: Record<string, AdminOrder[]> = {
      "📍 Pickup: Pori Toriparkki": [],
      "🚚 Home Delivery Routes": [],
    };

    for (const o of dayOrders) {
      if (o.fulfillmentMethod === "PICKUP") {
        groups["📍 Pickup: Pori Toriparkki"].push(o);
      } else {
        groups["🚚 Home Delivery Routes"].push(o);
      }
    }
    return groups;
  }, [dayOrders]);

  function handlePrint() {
    window.print();
  }

  return (
    <div
      className="fixed inset-0 bg-ink/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card max-w-2xl w-full p-6 bg-surface border border-line shadow-2xl rounded-2xl flex flex-col gap-5 print:shadow-none print:border-none print:max-w-none print:w-full">
        {/* Header (Hidden on Print) */}
        <div className="flex items-center justify-between border-b border-line pb-3 print:hidden">
          <div>
            <span className="eyebrow">MORNING HARVEST PREP</span>
            <h2 className="text-xl font-bold text-ink">Batch Packing List ({date || "Today"})</h2>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" className="btn text-xs font-bold py-1.5 px-3" onClick={handlePrint}>
              🖨️ Print Packing Slip
            </button>
            <button type="button" className="btn btn-secondary text-xs py-1.5 px-3" onClick={onClose}>
              ✕ Close
            </button>
          </div>
        </div>

        {/* PRINTABLE PACKING SLIP CONTENT */}
        <div className="flex flex-col gap-4 text-xs text-ink">
          <div className="border-b-2 border-ink pb-3 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-ink tracking-tight">Metsänilo — Morning Packing List</h1>
              <p className="text-sm text-ink/80 font-semibold mt-0.5">Fulfillment Date: {date || "Today"}</p>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold text-primary block ops-tabular">{formatLitres(totalVolumeMl)}</span>
              <span className="text-xs muted font-semibold block">{dayOrders.length} Orders to Pack</span>
            </div>
          </div>

          {/* PACKAGE SUMMARY BREAKDOWN */}
          <div className="p-3.5 rounded-xl bg-surface-muted border border-line flex flex-col gap-2">
            <strong className="text-xs font-bold uppercase tracking-wider text-muted">Required Containers &amp; Packages Breakdown</strong>
            <div className="flex flex-wrap items-center gap-4 text-sm font-bold">
              {packageBreakdown.map((pkg) => (
                <div key={pkg.label} className="bg-surface px-3 py-1.5 rounded-lg border border-line">
                  <span>{pkg.count}× {pkg.label}</span>
                  <span className="muted font-normal text-xs block">({formatLitres(pkg.volumeMl)})</span>
                </div>
              ))}
            </div>
          </div>

          {/* GROUPED ORDERS BY FULFILLMENT LOCATION */}
          {Object.entries(groupedByLocation).map(([groupTitle, groupOrders]) => (
            <div key={groupTitle} className="flex flex-col gap-2 pt-2">
              <h3 className="text-sm font-bold text-ink uppercase tracking-wider border-b border-line pb-1">
                {groupTitle} ({groupOrders.length} orders · {formatLitres(groupOrders.reduce((s, o) => s + o.volumeMl, 0))})
              </h3>

              <div className="divide-y divide-line border border-line rounded-xl overflow-hidden bg-surface">
                {groupOrders.map((order) => (
                  <div key={order.id} className="p-3 flex items-center justify-between gap-3 font-medium">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded border-2 border-ink flex items-center justify-center font-bold text-xs shrink-0">
                        ☐
                      </span>
                      <div>
                        <strong className="text-ink font-bold text-sm block">{order.customerName}</strong>
                        <span className="muted text-xs">
                          {order.publicReference} · 📞 {order.mobile}
                          {order.streetAddress ? ` · 📍 ${order.streetAddress}` : ""}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-ink block">{order.packageLabelFi}</span>
                      <span className="text-xs text-primary font-semibold block ops-tabular">{formatLitres(order.volumeMl)}</span>
                    </div>
                  </div>
                ))}

                {groupOrders.length === 0 && (
                  <p className="p-4 text-xs muted italic text-center">No orders for this channel today.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
