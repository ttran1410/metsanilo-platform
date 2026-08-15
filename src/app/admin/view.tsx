"use client";

import { useState, type FormEvent } from "react";
import type { auditEntries, availability, orderNotes, orderPayments, orders, products } from "@/db/schema";
import type { AvailabilityWorkspace } from "@/domain/availability";
import { AdminEmptyState, AdminNotice, AdminPageHeader } from "./presentation";

type Order = typeof orders.$inferSelect;
type AvailabilityRow = { availability: typeof availability.$inferSelect; product: typeof products.$inferSelect };
type OrderDetail = { order: Order; notes: Array<typeof orderNotes.$inferSelect>; payments: Array<typeof orderPayments.$inferSelect>; audit: Array<typeof auditEntries.$inferSelect>; paymentSummary: { paidCents: number; refundedCents: number; outstandingCents: number; status: string } };

export function ManagerView({
  initialOrders,
  initialAvailability,
  canViewOrders,
  canManageAvailability,
  canExportOrders = false,
  mode = "all",
  workspace,
}: {
  initialOrders: Order[];
  initialAvailability: AvailabilityRow[];
  canViewOrders: boolean;
  canManageAvailability: boolean;
  canExportOrders?: boolean;
  mode?: "all" | "orders" | "availability";
  workspace?: AvailabilityWorkspace;
}) {
  const [orderRows, setOrderRows] = useState(initialOrders);
  const [availabilityRows, setAvailabilityRows] = useState(initialAvailability);
  const [message, setMessage] = useState(""); const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const feedback = (text: string, tone: "success" | "error") => { setMessage(text); setMessageTone(tone); };
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const filteredOrders = orderRows.filter((order) => (statusFilter === "ALL" || order.status === statusFilter) && (methodFilter === "ALL" || order.fulfillmentMethod === methodFilter) && (!dateFilter || order.fulfillmentDate === dateFilter) && `${order.publicReference} ${order.customerName} ${order.mobile}`.toLowerCase().includes(search.toLowerCase()));

  async function logout() {
    await fetch("/api/auth/better/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    window.location.assign("/admin/login");
  }

  async function status(order: Order, next: "CONFIRMED" | "PICKING" | "READY" | "OUT_FOR_DELIVERY" | "PICKED_UP" | "DELIVERED" | "CUSTOMER_DECLINED" | "CANCELLED" | "CANCELLED_BY_CUSTOMER" | "REJECTED" | "NO_SHOW" | "REFUNDED") {
    setMessage("");
    const needsReason = ["CUSTOMER_DECLINED", "CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW", "REFUNDED"].includes(next);
    const reason = needsReason ? window.prompt("Reason for this transition")?.trim() : undefined;
    if (needsReason && !reason) return;
    const response = await fetch(`/api/admin/orders/${order.id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next, expectedVersion: order.version, reason, contactChannel: next === "CONFIRMED" ? "PHONE" : undefined }),
    });
    const body = await response.json();
    if (!response.ok) return feedback(body.code ?? "Request failed", "error");
    setOrderRows((rows) => rows.map((row) => (row.id === order.id ? body.data : row)));
    setMessage(`Order ${order.publicReference}: ${next}`);
  }

  async function bulkTransition(next: "CONFIRMED" | "PICKING" | "READY" | "OUT_FOR_DELIVERY" | "PICKED_UP" | "DELIVERED") {
    const selected = orderRows.filter((order) => selectedIds.includes(order.id));
    if (!selected.length) return;
    if (!window.confirm(`Apply ${next} to ${selected.length} order(s)? Orders with an invalid status will be skipped.`)) return;
    const updated: Order[] = [];
    let skipped = 0;
    for (const order of selected) {
      const response = await fetch(`/api/admin/orders/${order.id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next, expectedVersion: order.version }) });
      const body = await response.json();
      if (response.ok) updated.push(body.data as Order); else skipped += 1;
    }
    setOrderRows((rows) => rows.map((row) => updated.find((item) => item.id === row.id) ?? row));
    setSelectedIds([]);
    feedback(`${updated.length} order(s) updated${skipped ? `, ${skipped} skipped because they changed or were not eligible` : ""}.`, skipped ? "error" : "success");
  }

  function exportOrders() {
    const header = ["Reference", "Customer", "Mobile", "Date", "Method", "Product", "Package", "Quantity", "Status", "Item subtotal", "Delivery fee", "Total"];
    const csv = [header, ...filteredOrders.map((order) => [order.publicReference, order.customerName, order.mobile, order.fulfillmentDate, order.fulfillmentMethod, order.productNameFi, order.packageLabelFi, order.quantity, order.status, (order.itemSubtotalCents / 100).toFixed(2), order.deliveryFeeCents === null ? "pending" : (order.deliveryFeeCents / 100).toFixed(2), order.finalTotalCents === null ? "pending" : (order.finalTotalCents / 100).toFixed(2)])].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `metsanilo-orders-${dateFilter || "filtered"}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  async function openDetail(order: Order) {
    const response = await fetch(`/api/admin/orders/${order.id}`); const body = await response.json();
    if (!response.ok) return feedback(body.code ?? "Request failed", "error");
    setDetail(body.data);
  }

  async function detailAction(event: FormEvent<HTMLFormElement>, action: "note" | "fee" | "payment") {
    event.preventDefault();
    if (!detail) return;
    const values = new FormData(event.currentTarget);
    const endpoint = action === "note" ? "notes" : action === "fee" ? "delivery-fee" : "payment";
    const payload = action === "note"
      ? { body: values.get("body") }
      : action === "fee"
        ? { expectedVersion: detail.order.version, deliveryFeeCents: Math.round(Number(values.get("feeEuros")) * 100) }
        : { amountCents: Math.round(Number(values.get("paymentEuros")) * 100), method: values.get("method"), reference: values.get("reference") };
    const response = await fetch(`/api/admin/orders/${detail.order.id}/${endpoint}`, { method: action === "fee" ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) return feedback(body.code ?? body.message ?? "Request failed", "error");
    if (action === "fee") setDetail((current) => current ? { ...current, order: body.data } : current);
    else await openDetail(detail.order);
    event.currentTarget.reset(); setMessage("Order updated.");
  }

  async function save(row: AvailabilityRow, form: HTMLFormElement) {
    setMessage("");
    const values = new FormData(form);
    const capacityLitres = Number(values.get("capacityLitres"));
    const response = await fetch(`/api/admin/availability/${encodeURIComponent(row.availability.id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: row.availability.version,
        capacityMl: Math.round(capacityLitres * 1000),
        manualSoldOut: values.get("manualSoldOut") === "on",
        soldOutReason: values.get("soldOutReason"),
      }),
    });
    const body = await response.json();
    if (!response.ok) return feedback(body.code ?? "Request failed", "error");
    setAvailabilityRows((rows) =>
      rows.map((item) => item.availability.id === row.availability.id ? { ...item, availability: body.data } : item),
    );
    setMessage(`Availability ${row.availability.businessDate} saved.`);
  }

  async function plan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const frequency = String(values.get("frequency"));
    const response = await fetch("/api/admin/availability/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productId: values.get("productId"), frequency, startDate: values.get("startDate"), endDate: values.get("endDate"),
        dates: String(values.get("dates") ?? "").split(",").map((date) => date.trim()).filter(Boolean),
        capacityMl: Math.round(Number(values.get("capacityLitres")) * 1000),
        manualSoldOut: values.get("manualSoldOut") === "on", soldOutReason: values.get("soldOutReason"),
      }),
    });
    const body = await response.json();
    if (!response.ok) return feedback(body.code ?? body.message ?? "Request failed", "error");
    const planned = body.data as Array<typeof availability.$inferSelect>;
    setAvailabilityRows((rows) => {
      const byId = new Map(rows.map((row) => [row.availability.id, row]));
      const product = rows.find((row) => row.product.id === String(values.get("productId")))?.product;
      for (const item of planned) {
        const existing = byId.get(item.id);
        if (existing) byId.set(item.id, { ...existing, availability: item });
        else if (product) byId.set(item.id, { availability: item, product });
      }
      return [...byId.values()].sort((a, b) => a.availability.businessDate.localeCompare(b.availability.businessDate));
    });
    setMessage(`${planned.length} availability date(s) planned.`);
  }

  return (
    <main className="shell py-8">
      <AdminPageHeader eyebrow="RESERVATIONS & CAPACITY" title={mode === "availability" ? "Harvest availability" : "Orders"} description={mode === "availability" ? "Plan harvest capacity and keep sold-out dates accurate." : "Review reservations, confirm customers, and move each order to its next step."} />
      {message && <AdminNotice tone={messageTone} live>{message}</AdminNotice>}

      {canViewOrders && (mode === "all" || mode === "orders") && <section id="orders" className="admin-orders-section mt-8">
        <div className="admin-orders-toolbar"><div><p className="admin-section-kicker">Order queue</p><h2>Orders</h2><p className="admin-section-description">Search, filter and safely move reservations through fulfilment.</p></div><div className="admin-filter-bar"><input className="rounded-lg border p-3" aria-label="Search orders" placeholder="Search orders" value={search} onChange={(event) => setSearch(event.target.value)} /><input className="rounded-lg border p-3" aria-label="Filter fulfilment date" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /><select className="rounded-lg border p-3" aria-label="Filter order status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option>{["NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED", "CANCELLED", "REFUNDED"].map((status) => <option key={status} value={status}>{status}</option>)}</select><select className="rounded-lg border p-3" aria-label="Filter fulfilment method" value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}><option value="ALL">Pickup & delivery</option><option value="PICKUP">Pickup</option><option value="DELIVERY">Delivery</option></select>{canExportOrders && <button className="btn btn-secondary" type="button" onClick={exportOrders}>Export CSV</button>}</div></div>
        {filteredOrders.length > 0 && <div className="card mt-3 flex flex-wrap items-center gap-2"><label className="flex items-center gap-2"><input type="checkbox" checked={filteredOrders.every((order) => selectedIds.includes(order.id))} onChange={(event) => setSelectedIds(event.target.checked ? filteredOrders.map((order) => order.id) : [])} /> Select filtered ({filteredOrders.length})</label><span className="text-sm text-slate-600">{selectedIds.length} selected</span>{selectedIds.length > 0 && <><button className="btn" type="button" onClick={() => void bulkTransition("CONFIRMED")}>Confirm</button><button className="btn" type="button" onClick={() => void bulkTransition("PICKING")}>Start picking</button><button className="btn" type="button" onClick={() => void bulkTransition("READY")}>Mark ready</button><button className="btn" type="button" onClick={() => void bulkTransition("OUT_FOR_DELIVERY")}>Dispatch delivery</button><button className="btn" type="button" onClick={() => void bulkTransition("PICKED_UP")}>Confirm pickup</button><button className="btn" type="button" onClick={() => void bulkTransition("DELIVERED")}>Mark delivered</button></>}</div>}
        <div className="mt-3 grid gap-3">
          {filteredOrders.length === 0 && <AdminEmptyState title="No matching orders" description="Try another search or status filter." />}
          {filteredOrders.map((order) => (
            <article className="admin-order-card card" key={order.id}>
              <div className="admin-order-card-main">
                <div className="flex gap-3"><input type="checkbox" aria-label={`Select ${order.publicReference}`} checked={selectedIds.includes(order.id)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, order.id] : ids.filter((id) => id !== order.id))} /><div>
                  <h3 className="font-bold">{order.publicReference} <span className="pill">{order.status}</span></h3>
                  <p>{order.customerName} · {order.mobile} · {order.productNameFi} / {order.packageLabelFi}</p>
                  <p>{order.fulfillmentDate} · {order.fulfillmentMethod} · {(order.volumeMl / 1000).toLocaleString("fi-FI")} l</p>
                  {order.fulfillmentMethod === "DELIVERY" && <p>Delivery to be agreed · {order.streetAddress}, {order.postalCode} {order.city}</p>}
                </div></div>
                <div className="admin-order-actions">
                  <a className="btn btn-secondary" href={`/admin/orders/${order.id}`}>Open order</a>
                  {order.status === "NEW" && <><button className="btn" onClick={() => void status(order, "CONFIRMED")}>Confirm</button><button className="btn btn-secondary" onClick={() => void status(order, "CUSTOMER_DECLINED")}>Customer declined</button><button className="btn bg-[var(--berry)]" onClick={() => void status(order, "CANCELLED")}>Cancel</button></>}
                  {order.status === "CONFIRMED" && <><button className="btn" onClick={() => void status(order, "PICKING")}>Start picking</button><button className="btn bg-[var(--berry)]" onClick={() => void status(order, "CANCELLED")}>Cancel</button></>}
                  {order.status === "PICKING" && <button className="btn" onClick={() => void status(order, "READY")}>Mark ready</button>}
                  {order.status === "READY" && (order.fulfillmentMethod === "PICKUP" ? <button className="btn" onClick={() => void status(order, "PICKED_UP")}>Confirm pickup</button> : <button className="btn" onClick={() => void status(order, "OUT_FOR_DELIVERY")}>Dispatch delivery</button>)}
                  {order.status === "OUT_FOR_DELIVERY" && <button className="btn" onClick={() => void status(order, "DELIVERED")}>Mark delivered</button>}
                </div>
              </div>
              {detail?.order.id === order.id && <div className="mt-4 grid gap-3 border-t pt-4">
                <h4 className="font-bold">Order detail</h4>
                <p>Item: {(detail.order.itemSubtotalCents / 100).toFixed(2)} € · Delivery: {detail.order.deliveryFeeCents === null ? "to be agreed" : `${(detail.order.deliveryFeeCents / 100).toFixed(2)} €`} · Total: {detail.order.finalTotalCents === null ? "to be agreed" : `${(detail.order.finalTotalCents / 100).toFixed(2)} €`}</p>
                <p className="text-sm"><strong>Payment summary:</strong> {detail.paymentSummary.status} · Paid {(detail.paymentSummary.paidCents / 100).toFixed(2)} € · Refunded {(detail.paymentSummary.refundedCents / 100).toFixed(2)} € · Outstanding {(detail.paymentSummary.outstandingCents / 100).toFixed(2)} €</p>
                {detail.order.fulfillmentMethod === "DELIVERY" && detail.order.status !== "CANCELLED" && <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => void detailAction(event, "fee")}><label className="field"><span>Delivery fee (€)</span><input name="feeEuros" type="number" min="0" step="0.01" defaultValue={detail.order.deliveryFeeCents === null ? "" : (detail.order.deliveryFeeCents / 100).toFixed(2)} required /></label><button className="btn" type="submit">Save fee</button></form>}
                <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => void detailAction(event, "payment")}><label className="field"><span>Payment (€)</span><input name="paymentEuros" type="number" min="0.01" step="0.01" required /></label><label className="field"><span>Method</span><select name="method" defaultValue="CASH"><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option><option value="MOBILEPAY">MobilePay</option><option value="CARD">Card</option><option value="OTHER">Other</option></select></label><label className="field"><span>Reference</span><input name="reference" maxLength={200} /></label><button className="btn" type="submit">Record payment</button></form>
                <form className="flex items-end gap-2" onSubmit={(event) => void detailAction(event, "note")}><label className="field grow"><span>Internal note</span><textarea name="body" maxLength={2000} required /></label><button className="btn" type="submit">Add note</button></form>
                <div className="text-sm"><strong>Payments:</strong> {detail.payments.length ? detail.payments.map((payment) => `${(payment.amountCents / 100).toFixed(2)} € ${payment.method}`).join(" · ") : "None"}<br /><strong>Notes:</strong> {detail.notes.length ? detail.notes.map((note) => note.body).join(" · ") : "None"}</div>
                <div className="audit-timeline"><strong>Audit timeline</strong>{detail.audit.length ? detail.audit.map((entry) => <div className="audit-event" key={entry.id}><span className="pill">{entry.action.replace("order.", "")}</span><span>{entry.actor}</span><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString("fi-FI")}</time></div>) : <p className="text-sm text-slate-600">No audit events.</p>}</div>
              </div>}
            </article>
          ))}
        </div>
      </section>}

      {canManageAvailability && (mode === "all" || mode === "availability") && <section id="availability" className="admin-availability-section mt-10">
        {workspace && <>
          <div className="admin-section-heading"><div><p className="admin-section-kicker">Operations workspace</p><h2>7-day availability board</h2><p className="admin-section-description">Capacity, package fit and fulfilment queues stay in sync with the customer catalogue.</p></div></div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {workspace.dates.map((date) => {
              const dayRows = workspace.rows.filter((row) => row.availability.businessDate === date);
              return <article className="card" key={date}><p className="admin-section-kicker">{new Date(`${date}T12:00:00Z`).toLocaleDateString("fi-FI", { weekday: "short" })}</p><h3 className="font-bold">{date}</h3>{dayRows.length === 0 ? <p className="mt-2 text-sm text-slate-600">No planned availability</p> : <div className="mt-2 grid gap-2">{dayRows.map((row) => <div key={row.availability.id} className="rounded-lg border p-2"><div className="flex items-center justify-between gap-2"><strong>{row.product.nameFi}</strong>{row.soldOut ? <span className="pill bg-[var(--berry)] text-white">Sold out</span> : row.nearCapacity ? <span className="pill">Near capacity</span> : <span className="pill">Open</span>}</div><p className="text-sm">{(row.remainingMl / 1000).toLocaleString("fi-FI")} l left · {row.utilization}% reserved</p>{row.packages.length > 0 && <div className="mt-1 grid gap-1 text-xs text-slate-600">{row.packages.map((pkg) => <div key={pkg.id}>{pkg.volumeMl / 1000} l · {pkg.availableUnits} package{pkg.availableUnits === 1 ? "" : "s"}{pkg.isDefault ? " · default" : ""}</div>)}</div>}{row.availability.manualSoldOutReason && <p className="text-xs text-[var(--berry)]">Reason: {row.availability.manualSoldOutReason}</p>}</div>)}</div>}</article>;
            })}
          </div>
          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            {(["picking", "pickup", "delivery"] as const).map((queue) => <section className="card" key={queue}><div className="flex items-center justify-between"><h3 className="font-bold">{queue === "picking" ? "Picking queue" : queue === "pickup" ? "Pickup queue" : "Delivery queue"}</h3><span className="pill">{workspace.queues[queue].length}</span></div>{workspace.queues[queue].length === 0 ? <p className="mt-3 text-sm text-slate-600">Nothing queued.</p> : <div className="mt-3 grid gap-2">{workspace.queues[queue].map((order) => <a className="rounded-lg border p-3 hover:border-[var(--forest)]" href={`/admin/orders/${order.id}`} key={order.id}><div className="flex items-center justify-between gap-2"><strong>{order.publicReference}</strong><span className="pill">{order.status}</span></div><p className="text-sm">{order.customerName} · {order.productNameFi}</p><p className="text-xs text-slate-600">{order.fulfillmentDate} · {order.quantity} pcs</p></a>)}</div>}</section>)}
          </div>
        </>}
        <div className="admin-section-heading"><div><p className="admin-section-kicker">Harvest planning</p><h2>Plan availability</h2><p className="admin-section-description">Set capacity and fulfillment dates for each seasonal product.</p></div></div>
        <form className="card mt-3 grid gap-3" onSubmit={plan}>
          <p className="text-sm">DAY applies every date, WEEK every 7 days, MONTH on the same day each month, and CUSTOM to comma-separated dates.</p>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="field"><span>Product</span><select name="productId" required>{[...new Map(availabilityRows.map((row) => [row.product.id, row.product])).values()].map((product) => <option key={product.id} value={product.id}>{product.nameFi}</option>)}</select></label>
            <label className="field"><span>Pattern</span><select name="frequency" defaultValue="DAY"><option value="DAY">Daily</option><option value="WEEK">Weekly</option><option value="MONTH">Monthly</option><option value="CUSTOM">Custom dates</option></select></label>
            <label className="field"><span>Capacity (litres)</span><input name="capacityLitres" type="number" min="0" step="0.001" required /></label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="field"><span>Start date</span><input name="startDate" type="date" required /></label>
            <label className="field"><span>End date</span><input name="endDate" type="date" required /></label>
            <label className="field"><span>Custom dates (YYYY-MM-DD, comma-separated)</span><input name="dates" placeholder="2026-08-20, 2026-08-23" /></label>
          </div>
          <div className="grid gap-2 md:grid-cols-[auto_1fr_auto] md:items-end">
            <label className="flex items-center gap-2"><input name="manualSoldOut" type="checkbox" /> Sold out</label>
            <label className="field"><span>Internal reason (required when sold out)</span><input name="soldOutReason" maxLength={500} /></label>
            <button className="btn" type="submit">Apply plan</button>
          </div>
        </form>
      </section>}

      {canManageAvailability && (mode === "all" || mode === "availability") && <section className="admin-availability-section mt-10">
        <div className="admin-section-heading"><div><p className="admin-section-kicker">Capacity control</p><h2>Today and future capacity</h2><p className="admin-section-description">Review reserved volume and adjust availability before customers reserve.</p></div></div>
        <div className="mt-3 grid gap-3">
          {availabilityRows.length === 0 && <AdminEmptyState title="No availability planned" description="Create a plan above to add harvest dates." />}{availabilityRows.map((row) => (
            <form className="card grid gap-3 md:grid-cols-[1fr_10rem_1fr_auto] md:items-end" key={`${row.availability.id}:${row.availability.version}`} onSubmit={(event) => { event.preventDefault(); void save(row, event.currentTarget); }}>
              <div><strong>{row.product.nameFi}</strong><br />{row.availability.businessDate}<br /><small>Reserved: {row.availability.reservedMl / 1000} l · v{row.availability.version}</small></div>
              <label className="field"><span>Capacity (litres)</span><input name="capacityLitres" type="number" min={row.availability.reservedMl / 1000} step="0.001" defaultValue={row.availability.capacityMl / 1000} required /></label>
              <div className="grid gap-2">
                <label className="flex items-center gap-2"><input name="manualSoldOut" type="checkbox" defaultChecked={row.availability.manualSoldOut} /> Sold out</label>
                <label className="field"><span>Internal reason (required when sold out)</span><input name="soldOutReason" maxLength={500} defaultValue={row.availability.manualSoldOutReason ?? ""} /></label>
              </div>
              <button className="btn" type="submit">Save</button>
            </form>
          ))}
        </div>
      </section>}
    </main>
  );
}
