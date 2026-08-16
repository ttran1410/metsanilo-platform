"use client";

import { useMemo, useState } from "react";
import type { AdminOrder } from "../orders-listing";
import { AdminStatusBadge, formatAdminMoney } from "../presentation";

function cleanLitres(ml: number) {
  return `${(ml / 1000).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} L`;
}

export function PickupTerminal({
  orders,
  canTransition,
  onRefresh,
}: {
  orders: AdminOrder[];
  canTransition: boolean;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "READY_PAID" | "READY_UNPAID" | "PICKED_UP">("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Filter pickup orders for today
  const pickupOrders = useMemo(() => {
    return orders.filter((o) => o.fulfillmentMethod === "PICKUP");
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return pickupOrders.filter((order) => {
      const text = `${order.customerName} ${order.publicReference} ${order.mobile} ${order.packageLabelFi}`.toLowerCase();
      const lastDigits = order.mobile.slice(-4);
      const matchesSearch =
        !query || text.includes(query.toLowerCase()) || lastDigits.includes(query.trim());

      const isPaid = (order.outstandingCents ?? 0) <= 0;
      let matchesFilter = true;
      if (filterMode === "READY_PAID") matchesFilter = order.status === "READY" && isPaid;
      else if (filterMode === "READY_UNPAID") matchesFilter = order.status === "READY" && !isPaid;
      else if (filterMode === "PICKED_UP") matchesFilter = order.status === "PICKED_UP";

      return matchesSearch && matchesFilter;
    });
  }, [pickupOrders, query, filterMode]);

  // 1-Tap Confirm Pickup
  async function handleConfirmPickup(order: AdminOrder) {
    setBusyId(order.id);
    setError("");
    setNotice("");

    const response = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "transition", status: "PICKED_UP" }),
    });

    const body = await response.json();
    setBusyId(null);

    if (!response.ok) {
      return setError(body.message ?? "Could not confirm pickup.");
    }

    setNotice(`✅ Pickup confirmed for ${order.customerName} (${order.publicReference}).`);
    onRefresh();
  }

  // 1-Tap Quick Payment Logging
  async function handleRecordPayment(order: AdminOrder, method: "CASH" | "MOBILEPAY" | "CARD") {
    setBusyId(order.id);
    setError("");
    setNotice("");

    const amountCents = order.outstandingCents ?? order.finalTotalCents ?? order.itemSubtotalCents;

    const response = await fetch(`/api/admin/orders/${order.id}/payments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents,
        method,
        reference: `Terminal ${method} ${order.publicReference}`,
      }),
    });

    const body = await response.json();
    setBusyId(null);

    if (!response.ok) {
      return setError(body.message ?? "Could not record payment.");
    }

    setNotice(`💰 Recorded ${formatAdminMoney(amountCents)} via ${method} for ${order.customerName}.`);
    onRefresh();
  }

  return (
    <div className="card p-4 md:p-6 flex flex-col gap-4 bg-surface text-ink">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">📱 EVENING PICKUP TERMINAL</span>
          <h2 className="text-xl font-bold text-ink">Fast Pickup Check-In Mode</h2>
          <p className="text-xs muted">
            High-contrast, 1-tap check-in tool designed for mobile phones and tablets at market stalls.
          </p>
        </div>

        <div className="text-right">
          <span className="text-2xl font-bold text-emerald-700 ops-tabular">
            {pickupOrders.filter((o) => o.status === "PICKED_UP").length} / {pickupOrders.length}
          </span>
          <span className="text-xs text-muted block font-semibold">Pickups Completed</span>
        </div>
      </div>

      {notice && <p className="text-xs font-bold text-emerald-800 bg-emerald-100 p-3 rounded-xl border border-emerald-300">{notice}</p>}
      {error && <p className="text-xs font-bold text-danger bg-rose-50 p-3 rounded-xl border border-rose-200">{error}</p>}

      {/* SEARCH BAR (High-Contrast Large Input) */}
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Type Customer Name or Last 4 Digits of Phone (e.g. 4567)…"
          className="w-full text-base font-medium py-3 px-4 rounded-xl border-2 border-primary bg-surface shadow-sm focus:ring-2 focus:ring-primary/40"
        />

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { key: "ALL", label: `All Pickups (${pickupOrders.length})` },
            { key: "READY_PAID", label: "🟢 Ready & Paid" },
            { key: "READY_UNPAID", label: "🟡 Ready & Unpaid" },
            { key: "PICKED_UP", label: "✅ Completed" },
          ].map((pill) => (
            <button
              key={pill.key}
              type="button"
              className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
                filterMode === pill.key
                  ? "bg-primary text-on-primary shadow-sm"
                  : "bg-surface-muted text-ink/70 hover:bg-surface-muted/80"
              }`}
              onClick={() => setFilterMode(pill.key as typeof filterMode)}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* LARGE PICKUP CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
        {filteredOrders.map((order) => {
          const isPaid = (order.outstandingCents ?? 0) <= 0;
          const isPickedUp = order.status === "PICKED_UP";
          const isBusy = busyId === order.id;

          return (
            <article
              key={order.id}
              className={`p-4 rounded-2xl border-2 flex flex-col justify-between gap-3 transition-shadow shadow-sm ${
                isPickedUp
                  ? "bg-slate-100/70 border-slate-300 opacity-80"
                  : !isPaid
                  ? "bg-amber-50/60 border-amber-300"
                  : "bg-surface border-primary/40"
              }`}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2 border-b border-line/60 pb-2">
                  <div>
                    <h3 className="text-lg font-bold text-ink">{order.customerName}</h3>
                    <span className="text-xs font-mono font-bold text-primary">{order.publicReference}</span>
                  </div>

                  <AdminStatusBadge status={order.status} />
                </div>

                <div className="flex items-center justify-between text-xs my-1">
                  <div>
                    <strong className="text-sm font-bold text-ink block">{order.packageLabelFi}</strong>
                    <span className="muted font-semibold">{cleanLitres(order.volumeMl)} · {order.productNameFi}</span>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-bold text-ink ops-tabular">
                      {formatAdminMoney(order.finalTotalCents ?? order.itemSubtotalCents)}
                    </span>
                    <span
                      className={`text-[11px] font-bold block ${
                        isPaid ? "text-emerald-700" : "text-amber-800"
                      }`}
                    >
                      {isPaid ? "🟢 Paid" : `🟡 Unpaid (${formatAdminMoney(order.outstandingCents ?? 0)})`}
                    </span>
                  </div>
                </div>

                <div className="text-xs font-mono text-muted">
                  📞 {order.mobile}
                </div>
              </div>

              {/* 1-TAP ACTION BUTTONS */}
              <div className="flex flex-col gap-2 pt-2 border-t border-line/60">
                {!isPickedUp ? (
                  <>
                    {/* 1-Tap Confirm Pickup */}
                    {canTransition && (
                      <button
                        type="button"
                        className="btn w-full py-3.5 text-base font-bold bg-emerald-700 hover:bg-emerald-800 text-on-primary shadow-lg flex items-center justify-center gap-2"
                        onClick={() => void handleConfirmPickup(order)}
                        disabled={isBusy}
                      >
                        {isBusy ? "Processing…" : "✅ 1-TAP CONFIRM PICKUP (Noudettu)"}
                      </button>
                    )}

                    {/* Quick Payment Buttons if Unpaid */}
                    {!isPaid && (
                      <div className="flex flex-col gap-1 text-center">
                        <span className="text-[11px] font-bold text-amber-900 uppercase">Collect Payment:</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            className="btn btn-secondary text-xs py-2 font-bold"
                            onClick={() => void handleRecordPayment(order, "CASH")}
                            disabled={isBusy}
                          >
                            💵 Cash
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary text-xs py-2 font-bold text-blue-700"
                            onClick={() => void handleRecordPayment(order, "MOBILEPAY")}
                            disabled={isBusy}
                          >
                            📱 MobilePay
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary text-xs py-2 font-bold text-purple-700"
                            onClick={() => void handleRecordPayment(order, "CARD")}
                            disabled={isBusy}
                          >
                            💳 Card
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-2 text-xs font-bold text-slate-600 bg-slate-200/60 rounded-xl">
                    ✓ Pickup Completed
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="col-span-full py-8 text-center text-xs muted">
            No pickup orders found matching your search or filter.
          </div>
        )}
      </div>
    </div>
  );
}
