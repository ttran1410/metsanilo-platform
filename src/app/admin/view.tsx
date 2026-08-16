"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { auditEntries, availability, orderNotes, orderPayments, orders, products } from "@/db/schema";
import type { AvailabilityWorkspace } from "@/domain/availability";
import { AdminEmptyState, AdminNotice, AdminPageHeader } from "./presentation";
import { OrdersListing } from "./orders-listing";

type Order = typeof orders.$inferSelect;
type AvailabilityRow = { availability: typeof availability.$inferSelect; product: typeof products.$inferSelect };
type OrderDetail = { order: Order; notes: Array<typeof orderNotes.$inferSelect>; payments: Array<typeof orderPayments.$inferSelect>; audit: Array<typeof auditEntries.$inferSelect>; paymentSummary: { paidCents: number; refundedCents: number; outstandingCents: number; status: string } };

function OrdersWorkspaceFinal({ initialOrders, canExportOrders, canCreateOrders, canTransitionOrders }: { initialOrders: Order[]; canExportOrders: boolean; canCreateOrders: boolean; canTransitionOrders: boolean }) {
  const [rows, setRows] = useState(initialOrders); const [search, setSearch] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [statusFilter, setStatusFilter] = useState("ALL"); const [methodFilter, setMethodFilter] = useState("ALL"); const [sourceFilter, setSourceFilter] = useState("ALL"); const [sources, setSources] = useState<Array<{ key: string; labelEn: string }>>([]); const [selected, setSelected] = useState<string[]>([]); const [pending, setPending] = useState<{ order: Order; next: string } | null>(null); const [reason, setReason] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  useEffect(() => { void fetch("/api/admin/order-sources").then(async (response) => { if (response.ok) setSources((await response.json()).data.filter((item: { active: boolean }) => item.active)); }).catch(() => undefined); }, []);
  const filtered = rows.filter((order) => (statusFilter === "ALL" || order.status === statusFilter) && (methodFilter === "ALL" || order.fulfillmentMethod === methodFilter) && (sourceFilter === "ALL" || (sourceFilter === "HISTORICAL" ? order.historicalEntry : !order.historicalEntry && order.orderSource === sourceFilter)) && (!from || order.fulfillmentDate >= from) && (!to || order.fulfillmentDate <= to) && `${order.publicReference} ${order.customerName} ${order.mobile}`.toLowerCase().includes(search.toLowerCase()));
  const nextStatuses = (order: Order) => order.status === "NEW" ? ["CONFIRMED", "CANCELLED"] : order.status === "CONFIRMED" ? ["PICKING", "CANCELLED"] : order.status === "PICKING" ? ["READY", "CANCELLED"] : order.status === "READY" ? [order.fulfillmentMethod === "PICKUP" ? "PICKED_UP" : "OUT_FOR_DELIVERY", "CANCELLED"] : order.status === "OUT_FOR_DELIVERY" ? ["DELIVERED"] : [];
  const label = (status: string) => status === "OUT_FOR_DELIVERY" ? "Mark out for delivery" : status.replaceAll("_", " ");
  function requestTransition(order: Order, next: string) { if (!canTransitionOrders) return; setReason(""); setPending({ order, next }); }
  async function applyTransition() { if (!pending) return; const needsReason = ["CANCELLED", "REJECTED", "NO_SHOW"].includes(pending.next); if (needsReason && reason.trim().length < 2) return setError("A reason is required."); setError(""); const response = await fetch(`/api/admin/orders/${pending.order.id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: pending.next, expectedVersion: pending.order.version, reason: reason.trim() || undefined }) }); const body = await response.json(); if (!response.ok) { setPending(null); return setError(body.message ?? body.code ?? "Could not update order"); } setRows((current) => current.map((item) => item.id === pending.order.id ? body.data : item)); setPending(null); setMessage(`${pending.order.publicReference} moved to ${label(pending.next)}.`); }
  function exportCsv() { const lines = [["Reference", "Customer", "Fulfillment date", "Method", "Source", "Status", "Updated", "Total"], ...filtered.map((o) => [o.publicReference, o.customerName, o.fulfillmentDate, o.fulfillmentMethod, o.historicalEntry ? "Historical" : o.orderSource, o.status, o.updatedAt, o.finalTotalCents === null ? "Pending" : (o.finalTotalCents / 100).toFixed(2)])]; const csv = lines.map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = "metsanilo-orders.csv"; link.click(); }
  const row = (order: Order, mobile = false) => <article className={mobile ? "card admin-order-card" : undefined} key={order.id}><div className="flex items-start gap-3"><input type="checkbox" aria-label={`Select ${order.publicReference}`} checked={selected.includes(order.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{order.publicReference}</strong><span className="pill">{label(order.status)}</span></div><p>{order.customerName} · {order.mobile}</p><p>{order.fulfillmentDate} · {order.fulfillmentMethod} · {order.volumeMl / 1000} L</p><p className="text-sm">Updated {new Date(order.updatedAt).toLocaleString("fi-FI", { dateStyle: "short", timeStyle: "short" })}</p>{mobile && <p className="text-sm">{order.finalTotalCents === null ? "Payment pending" : `${(order.finalTotalCents / 100).toFixed(2)} €`}</p>}</div></div><div className="profile-actions mt-3"><a className="btn btn-secondary" href={`/admin/orders/${order.id}`}>View</a>{canTransitionOrders && nextStatuses(order).length > 0 && <select aria-label={`Change status for ${order.publicReference}`} value="" onChange={(event) => event.target.value && requestTransition(order, event.target.value)}><option value="">Change status</option>{nextStatuses(order).map((value) => <option key={value} value={value}>{label(value)}</option>)}</select>}</div></article>;
  const allSelected = filtered.length > 0 && filtered.every((order) => selected.includes(order.id));
  return <main className="shell py-8"><AdminPageHeader eyebrow="RESERVATIONS & CAPACITY" title="Orders" description="One operational queue for website, manual and historical orders." />{message && <AdminNotice tone="success" live>{message}</AdminNotice>}{error && <AdminNotice tone="error" live>{error}</AdminNotice>}<section className="mt-8"><div className="admin-orders-toolbar"><div><p className="admin-section-kicker">Order queue</p><h2>All orders</h2><p className="admin-section-description">Filter, review and move orders through fulfilment.</p></div><div className="profile-actions">{canCreateOrders && <a className="btn" href="/admin/manual-orders">+ Create order</a>}{canExportOrders && <button className="btn btn-secondary" type="button" onClick={exportCsv}>Export CSV</button>}</div></div><div className="card mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><label className="field"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference, customer, mobile" /></label><label className="field"><span>Fulfillment from</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="field"><span>Fulfillment to</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><label className="field"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option>{["NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED", "CANCELLED", "REFUNDED"].map((value) => <option key={value}>{label(value)}</option>)}</select></label><label className="field"><span>Fulfillment method</span><select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}><option value="ALL">Pickup &amp; delivery</option><option value="PICKUP">Pickup</option><option value="DELIVERY">Delivery</option></select></label><label className="field"><span>Source</span><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="ALL">All sources</option>{sources.map((source) => <option key={source.key} value={source.key}>{source.labelEn}</option>)}<option value="HISTORICAL">Historical</option></select></label></div><div className="card mt-3 flex flex-wrap items-center gap-3"><label className="flex items-center gap-2"><input type="checkbox" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? filtered.map((order) => order.id) : [])} /> Select filtered ({filtered.length})</label><span>{selected.length} selected</span></div><div className="admin-orders-table-wrap card mt-3 hidden md:block"><table className="admin-orders-table"><thead><tr><th>Select</th><th>Order</th><th>Customer</th><th>Fulfillment</th><th>Source</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead><tbody>{filtered.map((order) => <tr key={order.id}><td><input type="checkbox" aria-label={`Select ${order.publicReference}`} checked={selected.includes(order.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))} /></td><td><strong>{order.publicReference}</strong><small>{order.createdAt.slice(0, 16).replace("T", " ")}</small></td><td><strong>{order.customerName}</strong><small>{order.mobile}</small></td><td><strong>{order.fulfillmentDate}</strong><small>{order.fulfillmentMethod} · {order.volumeMl / 1000} L</small></td><td><span className="pill">{order.historicalEntry ? "Historical" : order.orderSource}</span></td><td><span className="pill">{label(order.status)}</span></td><td><small>{new Date(order.updatedAt).toLocaleString("fi-FI", { dateStyle: "short", timeStyle: "short" })}</small></td><td>{canTransitionOrders && nextStatuses(order).length > 0 ? <select aria-label={`Change status for ${order.publicReference}`} value="" onChange={(event) => event.target.value && requestTransition(order, event.target.value)}><option value="">Change status</option>{nextStatuses(order).map((value) => <option key={value}>{label(value)}</option>)}</select> : <a className="btn btn-secondary" href={`/admin/orders/${order.id}`}>View</a>}</td></tr>)}</tbody></table>{filtered.length === 0 && <AdminEmptyState title="No matching orders" description="Adjust the date range or filters." />}</div><div className="grid gap-3 md:hidden">{filtered.map((order) => row(order, true))}</div></section>{pending && <div className="admin-dialog-backdrop"><form className="admin-dialog card" onSubmit={(event) => { event.preventDefault(); void applyTransition(); }}><p className="eyebrow">ORDER ACTION</p><h2>{label(pending.next)}?</h2><p>Confirm this status change for {pending.order.publicReference}.</p>{["CANCELLED", "REJECTED", "NO_SHOW"].includes(pending.next) && <label className="field"><span>Reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} required /></label>}<div className="profile-actions"><button className="btn btn-secondary" type="button" onClick={() => setPending(null)}>Cancel</button><button className="btn" type="submit">Confirm</button></div></form></div>}</main>;
}

function OrdersWorkspaceOperations({ initialOrders, canExportOrders, canCreateOrders, canTransitionOrders }: { initialOrders: Order[]; canExportOrders: boolean; canCreateOrders: boolean; canTransitionOrders: boolean }) {
  const [rows, setRows] = useState(initialOrders); const [selected, setSelected] = useState<string[]>([]); const [bulkTarget, setBulkTarget] = useState<string | null>(null); const [reason, setReason] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [search, setSearch] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [status, setStatus] = useState("ALL"); const [method, setMethod] = useState("ALL");
  const filtered = rows.filter((o) => (status === "ALL" || o.status === status) && (method === "ALL" || o.fulfillmentMethod === method) && (!from || o.fulfillmentDate >= from) && (!to || o.fulfillmentDate <= to) && `${o.publicReference} ${o.customerName} ${o.mobile}`.toLowerCase().includes(search.toLowerCase()));
  const next = (o: Order) => o.status === "NEW" ? ["CONFIRMED", "CANCELLED", "CUSTOMER_DECLINED"] : o.status === "CONFIRMED" ? ["PICKING", "CANCELLED"] : o.status === "PICKING" ? ["READY", "CANCELLED"] : o.status === "READY" ? [o.fulfillmentMethod === "PICKUP" ? "PICKED_UP" : "OUT_FOR_DELIVERY", "NO_SHOW", "REJECTED"] : o.status === "OUT_FOR_DELIVERY" ? ["DELIVERED", "NO_SHOW"] : [];
  const label = (value: string) => value === "OUT_FOR_DELIVERY" ? "Mark out for delivery" : value.replaceAll("_", " ");
  async function apply(order: Order, target: string, why?: string) { const response = await fetch(`/api/admin/orders/${order.id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: target, expectedVersion: order.version, reason: why || undefined }) }); const body = await response.json(); if (!response.ok) return false; setRows((current) => current.map((item) => item.id === order.id ? body.data : item)); return true; }
  async function confirmBulk() { if (!bulkTarget || !canTransitionOrders) return; const targets = rows.filter((o) => selected.includes(o.id)); const needsReason = ["CANCELLED", "CUSTOMER_DECLINED", "REJECTED", "NO_SHOW"].includes(bulkTarget); if (needsReason && reason.trim().length < 2) return setError("A reason is required."); let changed = 0; for (const order of targets) if (next(order).includes(bulkTarget) && await apply(order, bulkTarget, reason.trim())) changed += 1; setSelected([]); setBulkTarget(null); setReason(""); setError(changed === targets.length ? "" : `${changed} updated; ineligible orders were skipped.`); setMessage(`${changed} order(s) moved to ${label(bulkTarget)}.`); }
  const availableBulk = [...new Set(rows.filter((o) => selected.includes(o.id)).flatMap(next))]; const allSelected = filtered.length > 0 && filtered.every((o) => selected.includes(o.id));
  const exportCsv = () => { const csv = [["Reference", "Customer", "Date", "Method", "Status", "Updated"], ...filtered.map((o) => [o.publicReference, o.customerName, o.fulfillmentDate, o.fulfillmentMethod, o.status, o.updatedAt])].map((line) => line.join(",")).join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = "metsanilo-orders.csv"; link.click(); };
  const card = (o: Order) => <article className="card admin-order-card" key={o.id}><div className="flex items-start gap-3"><input type="checkbox" checked={selected.includes(o.id)} aria-label={`Select ${o.publicReference}`} onChange={(e) => setSelected((current) => e.target.checked ? [...current, o.id] : current.filter((id) => id !== o.id))} /><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><strong>{o.publicReference}</strong><span className="pill">{label(o.status)}</span></div><p>{o.customerName} · {o.mobile}</p><p>{o.fulfillmentDate} · {o.fulfillmentMethod} · Updated {new Date(o.updatedAt).toLocaleDateString("fi-FI")}</p></div></div><div className="profile-actions mt-3"><a className="btn btn-secondary" href={`/admin/orders/${o.id}`}>View</a>{canTransitionOrders && next(o).length > 0 && <select aria-label={`Change status for ${o.publicReference}`} value="" onChange={(e) => e.target.value && setBulkTarget(`${o.id}:${e.target.value}`)}><option value="">Change status</option>{next(o).map((value) => <option key={value} value={`${o.id}:${value}`}>{label(value)}</option>)}</select>}</div></article>;
  return <main className="shell py-8"><AdminPageHeader eyebrow="RESERVATIONS & CAPACITY" title="Orders" description="One operational queue for website, manual and historical orders." />{message && <AdminNotice tone="success" live>{message}</AdminNotice>}{error && <AdminNotice tone="error" live>{error}</AdminNotice>}<div className="admin-orders-toolbar mt-8"><div><p className="admin-section-kicker">Order queue</p><h2>All orders</h2><p className="admin-section-description">Filter and safely move reservations through fulfilment.</p></div><div className="profile-actions">{canCreateOrders && <a className="btn" href="/admin/manual-orders">+ Create order</a>}{canExportOrders && <button className="btn btn-secondary" onClick={exportCsv}>Export CSV</button>}</div></div><div className="card mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><label className="field"><span>Search</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Reference, customer, mobile" /></label><label className="field"><span>From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="field"><span>To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label><label className="field"><span>Status</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">All statuses</option>{["NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED", "CANCELLED", "NO_SHOW", "REJECTED"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="field"><span>Method</span><select value={method} onChange={(e) => setMethod(e.target.value)}><option value="ALL">Pickup &amp; delivery</option><option value="PICKUP">Pickup</option><option value="DELIVERY">Delivery</option></select></label></div><div className="card mt-3 flex flex-wrap items-center gap-3"><label className="flex items-center gap-2"><input type="checkbox" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? filtered.map((o) => o.id) : [])} /> Select filtered ({filtered.length})</label><span>{selected.length} selected</span>{canTransitionOrders && selected.length > 0 && <div className="profile-actions">{availableBulk.filter((value) => ["CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED"].includes(value)).map((value) => <button className="btn" key={value} onClick={() => { setReason(""); setBulkTarget(value); }}>{label(value)}</button>)}</div>}</div><div className="admin-orders-table-wrap card mt-3 hidden md:block"><table className="admin-orders-table"><thead><tr><th>Select</th><th>Order</th><th>Customer</th><th>Fulfillment</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead><tbody>{filtered.map((o) => <tr key={o.id}><td><input type="checkbox" checked={selected.includes(o.id)} aria-label={`Select ${o.publicReference}`} onChange={(e) => setSelected((current) => e.target.checked ? [...current, o.id] : current.filter((id) => id !== o.id))} /></td><td><strong>{o.publicReference}</strong><small>{o.createdAt.slice(0, 16).replace("T", " ")}</small></td><td><strong>{o.customerName}</strong><small>{o.mobile}</small></td><td><strong>{o.fulfillmentDate}</strong><small>{o.fulfillmentMethod} · {o.volumeMl / 1000} L</small></td><td><span className="pill">{label(o.status)}</span></td><td><small>{new Date(o.updatedAt).toLocaleString("fi-FI", { dateStyle: "short", timeStyle: "short" })}</small></td><td><a className="btn btn-secondary" href={`/admin/orders/${o.id}`}>View</a></td></tr>)}</tbody></table></div><div className="grid gap-3 md:hidden">{filtered.map(card)}</div>{bulkTarget && !bulkTarget.includes(":") && <div className="admin-dialog-backdrop"><form className="admin-dialog card" onSubmit={(e) => { e.preventDefault(); void confirmBulk(); }}><p className="eyebrow">ORDER ACTION</p><h2>{label(bulkTarget)}?</h2><p>This action skips orders that are not eligible for the selected transition.</p>{["CANCELLED", "CUSTOMER_DECLINED", "REJECTED", "NO_SHOW"].includes(bulkTarget) && <label className="field"><span>Reason</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} required /></label>}<div className="profile-actions"><button className="btn btn-secondary" type="button" onClick={() => setBulkTarget(null)}>Cancel</button><button className="btn" type="submit">Confirm</button></div></form></div>}{bulkTarget?.includes(":") && <div className="admin-dialog-backdrop"><div className="admin-dialog card"><h2>{label(bulkTarget.split(":")[1])}?</h2><p>Confirm this status change.</p><div className="profile-actions"><button className="btn btn-secondary" onClick={() => setBulkTarget(null)}>Cancel</button><button className="btn" onClick={() => { const [id, target] = bulkTarget.split(":"); const order = rows.find((o) => o.id === id); if (order) void apply(order, target).then((ok) => { setBulkTarget(null); if (ok) setMessage(`${order.publicReference} moved to ${label(target)}.`); }); }}>Confirm</button></div></div></div>}</main>;
}

export function ManagerView({
  initialOrders,
  initialAvailability,
  canViewOrders,
  canViewAvailability = false,
  canManageAvailability,
  canExportOrders = false,
  canCreateOrders = false,
  canTransitionOrders = false,
  mode = "all",
  workspace,
}: {
  initialOrders: Order[];
  initialAvailability: AvailabilityRow[];
  canViewOrders: boolean;
  canViewAvailability?: boolean;
  canManageAvailability: boolean;
  canExportOrders?: boolean;
  canCreateOrders?: boolean;
  canTransitionOrders?: boolean;
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
  const [dateToFilter, setDateToFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sourceOptions, setSourceOptions] = useState<Array<{ key: string; labelEn: string; active: boolean }>>([]);
  useEffect(() => { if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("created")) setMessage("Order created successfully and added to the order list."); void fetch("/api/admin/order-sources").then(async (response) => response.ok ? setSourceOptions((await response.json()).data.filter((item: { active: boolean }) => item.active)) : undefined).catch(() => undefined); }, []);
  const filteredOrders = orderRows.filter((order) => (statusFilter === "ALL" || order.status === statusFilter) && (methodFilter === "ALL" || order.fulfillmentMethod === methodFilter) && (sourceFilter === "ALL" || (sourceFilter === "HISTORICAL" ? order.historicalEntry : order.orderSource === sourceFilter && !order.historicalEntry)) && (!dateFilter || order.fulfillmentDate >= dateFilter) && (!dateToFilter || order.fulfillmentDate <= dateToFilter) && `${order.publicReference} ${order.customerName} ${order.mobile}`.toLowerCase().includes(search.toLowerCase()));

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
        : { amountCents: Math.round(Number(values.get("paymentEuros")) * 100), method: values.get("method"), reference: String(values.get("reference") ?? "").trim() || undefined };
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

  if (mode === "orders" && canViewOrders) return <OrdersListing initialOrders={initialOrders} canExport={canExportOrders} canCreate={canCreateOrders} canTransition={canTransitionOrders} />;

  return (
    <main className="shell py-8">
      <AdminPageHeader eyebrow="RESERVATIONS & CAPACITY" title={mode === "availability" ? "Harvest availability" : "Orders"} description={mode === "availability" ? "Plan harvest capacity and keep sold-out dates accurate." : "Review reservations, confirm customers, and move each order to its next step."} />
      {message && <AdminNotice tone={messageTone} live>{message}</AdminNotice>}

      {canViewOrders && (mode === "all" || mode === "orders") && <section id="orders" className="admin-orders-section mt-8">
        <div className="admin-orders-toolbar"><div><p className="admin-section-kicker">Order queue</p><h2>Orders</h2><p className="admin-section-description">Search, filter and safely move reservations through fulfilment.</p></div><div className="admin-filter-bar"><input className="rounded-lg border p-3" aria-label="Search orders" placeholder="Search orders" value={search} onChange={(event) => setSearch(event.target.value)} /><label className="field"><span>Fulfillment from</span><input type="date" aria-label="Fulfillment date from" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label><label className="field"><span>To</span><input type="date" aria-label="Fulfillment date to" value={dateToFilter} onChange={(event) => setDateToFilter(event.target.value)} /></label><select className="rounded-lg border p-3" aria-label="Filter order status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option>{["NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED", "CANCELLED", "REFUNDED"].map((status) => <option key={status} value={status}>{status}</option>)}</select><select className="rounded-lg border p-3" aria-label="Filter fulfilment method" value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}><option value="ALL">Pickup & delivery</option><option value="PICKUP">Pickup</option><option value="DELIVERY">Delivery</option></select><select className="rounded-lg border p-3" aria-label="Filter order source" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="ALL">All sources</option>{sourceOptions.map((source) => <option key={source.key} value={source.key}>{source.labelEn}</option>)}<option value="HISTORICAL">Historical</option></select>{canExportOrders && <button className="btn btn-secondary" type="button" onClick={exportOrders}>Export CSV</button>}</div></div>
        {filteredOrders.length > 0 && <div className="card mt-3 flex flex-wrap items-center gap-2"><label className="flex items-center gap-2"><input type="checkbox" checked={filteredOrders.length > 0 && filteredOrders.every((order) => selectedIds.includes(order.id))} onChange={(event) => setSelectedIds(event.target.checked ? filteredOrders.map((order) => order.id) : [])} /> Select filtered ({filteredOrders.length})</label><span className="text-sm text-slate-600">{selectedIds.length} selected</span>{selectedIds.length > 0 && <><button className="btn" type="button" onClick={() => void bulkTransition("CONFIRMED")}>Confirm</button><button className="btn" type="button" onClick={() => void bulkTransition("PICKING")}>Start picking</button><button className="btn" type="button" onClick={() => void bulkTransition("READY")}>Mark ready</button><button className="btn" type="button" onClick={() => void bulkTransition("OUT_FOR_DELIVERY")}>Dispatch delivery</button><button className="btn" type="button" onClick={() => void bulkTransition("PICKED_UP")}>Confirm pickup</button><button className="btn" type="button" onClick={() => void bulkTransition("DELIVERED")}>Mark delivered</button></>}</div>}
        <div className="admin-orders-table-wrap card mt-3"><table className="admin-orders-table"><thead><tr><th>Order</th><th>Customer</th><th>Fulfilment</th><th>Source</th><th>Status</th><th>Payment</th><th>Action</th></tr></thead><tbody>{filteredOrders.map((order) => <tr key={order.id}><td><strong>{order.publicReference}</strong><small>{order.createdAt.slice(0, 16).replace("T", " ")}</small></td><td><strong>{order.customerName}</strong><small>{order.mobile}</small></td><td><strong>{order.fulfillmentDate}</strong><small>{order.fulfillmentMethod} · {order.volumeMl / 1000} l</small></td><td><span className="pill">{order.historicalEntry ? "Historical" : order.orderSource === "PHONE" ? "Phone/message" : order.orderSource}</span></td><td><span className="pill">{order.status}</span></td><td><small>{order.finalTotalCents === null ? "Pending" : `${(order.finalTotalCents / 100).toFixed(2)} €`}</small></td><td><div className="admin-table-actions"><a className="btn btn-secondary" href={`/admin/orders/${order.id}`}>Inspect</a>{order.status === "NEW" && <button className="btn" type="button" onClick={() => void status(order, "CONFIRMED")}>Confirm</button>}{order.status === "CONFIRMED" && <button className="btn" type="button" onClick={() => void status(order, "PICKING")}>Picking</button>}{order.status === "PICKING" && <button className="btn" type="button" onClick={() => void status(order, "READY")}>Ready</button>}{order.status === "READY" && <button className="btn" type="button" onClick={() => void status(order, order.fulfillmentMethod === "PICKUP" ? "PICKED_UP" : "OUT_FOR_DELIVERY")}>{order.fulfillmentMethod === "PICKUP" ? "Picked up" : "Dispatch"}</button>}{order.status === "OUT_FOR_DELIVERY" && <button className="btn" type="button" onClick={() => void status(order, "DELIVERED")}>Delivered</button>}</div></td></tr>)}</tbody></table>{filteredOrders.length === 0 && <AdminEmptyState title="No matching orders" description="Try another search or status filter." />}</div>
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

      {canViewAvailability && (mode === "all" || mode === "availability") && <section id="availability" className="admin-availability-section mt-10">
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
        {canManageAvailability && <><div className="admin-section-heading"><div><p className="admin-section-kicker">Harvest planning</p><h2>Plan availability</h2><p className="admin-section-description">Set capacity and fulfillment dates for each seasonal product.</p></div></div>
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
        </form></>}

        {canManageAvailability && <><div className="admin-section-heading"><div><p className="admin-section-kicker">Capacity control</p><h2>Today and future capacity</h2><p className="admin-section-description">Review reserved volume and adjust availability before customers reserve.</p></div></div>
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
        </div></>}
      </section>}
    </main>
  );
}
