"use client";

import { useMemo, useState } from "react";
import { Banknote, CircleCheck, CreditCard, PackageCheck, Phone, Search, Smartphone } from "lucide-react";
import type { AdminOrder } from "../types/admin-order";
import { AdminConfirmDialog, AdminNotice, AdminStatusBadge, formatAdminMoney } from "../../presentation";

function cleanLitres(ml: number) {
  return `${(ml / 1000).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} L`;
}

function todayInFinland() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki" }).format(new Date());
}

function paymentAmount(order: AdminOrder) {
  return order.outstandingCents ?? order.finalTotalCents ?? order.itemSubtotalCents;
}

type PaymentMethod = "CASH" | "MOBILEPAY" | "CARD";
type PendingAction = { type: "PICKUP"; order: AdminOrder } | { type: "PAYMENT"; order: AdminOrder; method: PaymentMethod };

export function PickupTerminal({ orders, canTransition, canRecordPayment, onRefresh }: {
  orders: AdminOrder[];
  canTransition: boolean;
  canRecordPayment: boolean;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "READY_PAID" | "READY_UNPAID" | "COMPLETED">("ALL");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const today = todayInFinland();

  const pickupOrders = useMemo(
    () => orders.filter((order) => order.fulfillmentMethod === "PICKUP" && order.fulfillmentDate === today),
    [orders, today],
  );

  const filteredOrders = useMemo(() => pickupOrders.filter((order) => {
    const value = query.trim().toLowerCase();
    const text = `${order.customerName} ${order.publicReference} ${order.mobile ?? ""} ${order.packageLabelFi}`.toLowerCase();
    const matchesSearch = !value || text.includes(value) || (order.mobile?.slice(-4) ?? "").includes(value);
    const paid = (order.outstandingCents ?? 0) <= 0;
    const matchesFilter = filterMode === "ALL"
      || (filterMode === "READY_PAID" && order.status === "READY" && paid)
      || (filterMode === "READY_UNPAID" && order.status === "READY" && !paid)
      || (filterMode === "COMPLETED" && order.status === "PICKED_UP");
    return matchesSearch && matchesFilter;
  }), [filterMode, pickupOrders, query]);

  async function executePending() {
    if (!pending) return;
    setBusy(true);
    setError("");
    setNotice("");
    const { order } = pending;
    try {
      const response = pending.type === "PICKUP"
        ? await fetch(`/api/admin/orders/${order.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "transition", status: "PICKED_UP", expectedVersion: order.version }),
          })
        : await fetch(`/api/admin/orders/${order.id}/payment`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ amountCents: paymentAmount(order), method: pending.method, reference: `Pickup desk ${pending.method} ${order.publicReference}` }),
          });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? (pending.type === "PICKUP" ? "Could not confirm pickup." : "Could not record payment."));
      setNotice(pending.type === "PICKUP"
        ? `Pickup confirmed for ${order.customerName} (${order.publicReference}).`
        : `${formatAdminMoney(paymentAmount(order))} recorded via ${pending.method} for ${order.publicReference}.`);
      setPending(null);
      onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pickup action failed.");
    } finally {
      setBusy(false);
    }
  }

  const completed = pickupOrders.filter((order) => order.status === "PICKED_UP").length;

  return (
    <section className="pickup-terminal">
      <header className="pickup-terminal-header">
        <div><p className="eyebrow">Today&apos;s handovers</p><h2>Pickup desk</h2><p>Find the customer, resolve payment, then confirm exactly what is handed over.</p></div>
        <div className="pickup-progress"><strong>{completed}/{pickupOrders.length}</strong><span>completed</span></div>
      </header>

      {notice && <AdminNotice tone="success" live>{notice}</AdminNotice>}
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      <div className="pickup-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, reference, or phone" aria-label="Search today's pickups" /></div>
      <div className="pickup-filters" role="tablist" aria-label="Pickup readiness">
        {([ ["ALL", `All (${pickupOrders.length})`], ["READY_PAID", "Ready · paid"], ["READY_UNPAID", "Ready · unpaid"], ["COMPLETED", "Completed"] ] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filterMode === key} className={filterMode === key ? "is-active" : ""} onClick={() => setFilterMode(key)}>{label}</button>)}
      </div>

      <div className="pickup-order-grid">
        {filteredOrders.map((order) => {
          const paid = (order.outstandingCents ?? 0) <= 0;
          const completedOrder = order.status === "PICKED_UP";
          const ready = order.status === "READY";
          return <article className={`pickup-order-card${completedOrder ? " is-complete" : ""}${!paid ? " has-payment-due" : ""}`} key={order.id}>
            <header><div><h3>{order.customerName}</h3><span>{order.publicReference}</span></div><AdminStatusBadge status={order.status} /></header>
            <dl>
              <div><dt>Order</dt><dd><strong>{order.packageLabelFi}</strong><span>{cleanLitres(order.volumeMl)} · {order.productNameFi}</span></dd></div>
              <div><dt>Payment</dt><dd><strong>{formatAdminMoney(order.finalTotalCents ?? order.itemSubtotalCents)}</strong><span className={paid ? "is-paid" : "is-due"}>{paid ? "Paid" : `${formatAdminMoney(order.outstandingCents ?? 0)} due`}</span></dd></div>
              <div><dt>Phone</dt><dd>{order.mobile ? <a href={`tel:${order.mobile}`}><Phone aria-hidden="true" />{order.mobile}</a> : <span>Not provided</span>}</dd></div>
            </dl>
            {!completedOrder && <div className="pickup-order-actions">
              {!paid && canRecordPayment && <div><span>Record payment</span><div>{([ ["CASH", "Cash", Banknote], ["MOBILEPAY", "MobilePay", Smartphone], ["CARD", "Card", CreditCard] ] as const).map(([method, label, Icon]) => <button type="button" className="btn btn-secondary" key={method} onClick={() => setPending({ type: "PAYMENT", order, method })}><Icon aria-hidden="true" />{label}</button>)}</div></div>}
              {ready && canTransition ? <button type="button" className="btn pickup-confirm" onClick={() => setPending({ type: "PICKUP", order })}><PackageCheck aria-hidden="true" />Review handover</button> : !ready ? <p>Complete packing before handover.</p> : null}
            </div>}
            {completedOrder && <div className="pickup-complete"><CircleCheck aria-hidden="true" />Pickup completed</div>}
          </article>;
        })}
        {!filteredOrders.length && <div className="pickup-empty"><PackageCheck aria-hidden="true" /><strong>No matching pickups</strong><span>{query ? "Try a different name, reference, or phone number." : "No orders match this readiness filter for today."}</span></div>}
      </div>

      <AdminConfirmDialog open={pending !== null} title={pending?.type === "PICKUP" ? "Confirm handover" : "Record payment"} description="Review the order details before completing this pickup desk action." confirmLabel={pending?.type === "PICKUP" ? "Confirm pickup" : "Record payment"} onCancel={() => { if (!busy) setPending(null); }} onConfirm={executePending}>
        {pending && <dl className="pickup-confirm-details"><div><dt>Customer</dt><dd>{pending.order.customerName}</dd></div><div><dt>Reference</dt><dd>{pending.order.publicReference}</dd></div><div><dt>Order</dt><dd>{pending.order.packageLabelFi} · {cleanLitres(pending.order.volumeMl)}</dd></div>{pending.type === "PAYMENT" && <><div><dt>Amount</dt><dd>{formatAdminMoney(paymentAmount(pending.order))}</dd></div><div><dt>Method</dt><dd>{pending.method}</dd></div></>}</dl>}
        {pending?.type === "PICKUP" && (pending.order.outstandingCents ?? 0) > 0 && <AdminNotice tone="warning">This order still has {formatAdminMoney(pending.order.outstandingCents ?? 0)} outstanding. Record payment before confirming handover unless payment is intentionally deferred.</AdminNotice>}
      </AdminConfirmDialog>
    </section>
  );
}
