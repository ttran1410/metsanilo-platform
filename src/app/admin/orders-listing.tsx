"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { orders } from "@/db/schema";
import { getOrderTriageReasons, orderTriageScore } from "@/domain/order-triage";
import { getLegalOrderTransitions, type OrderStatus } from "@/domain/order-transitions";
import { AdminEmptyState, AdminNotice, AdminPageHeader, AdminSelectionToolbar, AdminStatusBadge, formatAdminMoney } from "./presentation";
import { OrderInspector } from "./order-inspector";

export type AdminOrder = typeof orders.$inferSelect & { paidCents?: number; outstandingCents?: number | null; paymentStatus?: string };
export type OrdersView = "TRIAGE" | "ALL" | "TODAY" | "NEEDS_CONFIRMATION" | "PICKUP_TODAY" | "DELIVERY_TODAY" | "UNPAID";
type Column = "fulfillment" | "source" | "status" | "payment" | "updated";
type PendingAction = { target: OrderStatus; orders: AdminOrder[] };

const QUICK_VIEWS: Array<{ key: OrdersView; label: string }> = [
  { key: "TRIAGE", label: "Action required" },
  { key: "ALL", label: "All orders" },
  { key: "TODAY", label: "Today" },
  { key: "NEEDS_CONFIRMATION", label: "Needs confirmation" },
  { key: "PICKUP_TODAY", label: "Pickup today" },
  { key: "DELIVERY_TODAY", label: "Delivery today" },
  { key: "UNPAID", label: "Unpaid" },
];
const ALL_COLUMNS: Array<{ key: Column; label: string }> = [
  { key: "fulfillment", label: "Fulfillment" }, { key: "source", label: "Source" }, { key: "status", label: "Status" }, { key: "payment", label: "Payment" }, { key: "updated", label: "Updated" },
];
const statusLabel = (value: string) => value === "OUT_FOR_DELIVERY" ? "Out for delivery" : value.replaceAll("_", " ");
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki" }).format(new Date());

export function OrdersListing({ initialOrders, initialView = "ALL", initialStatus = "ALL", canExport, canCreate, canTransition, canUpdate = false }: {
  initialOrders: AdminOrder[];
  initialView?: OrdersView;
  initialStatus?: string;
  canExport: boolean;
  canCreate: boolean;
  canTransition: boolean;
  canUpdate?: boolean;
}) {
  const [rows, setRows] = useState(initialOrders);
  const [view, setView] = useState<OrdersView>(initialView);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [method, setMethod] = useState("ALL");
  const [status, setStatus] = useState(initialStatus);
  const [source, setSource] = useState("ALL");
  const [sources, setSources] = useState<Array<{ key: string; labelEn: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [page, setPage] = useState(1);
  const [savedViews, setSavedViews] = useState<Array<{ name: string; view: OrdersView; from: string; to: string; method: string; status: string; source: string }>>([]);
  const [viewName, setViewName] = useState("");
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");
  const [columns, setColumns] = useState<Column[]>(ALL_COLUMNS.map(({ key }) => key));

  const refreshOrders = useCallback(async (announce = false) => {
    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Order refresh failed");
      setRows(body.data);
      setLastUpdated(new Date());
      if (announce) setNotice("Order queue refreshed.");
    } catch (refreshError) {
      if (announce) setError(refreshError instanceof Error ? refreshError.message : "Order refresh failed");
    }
  }, []);

  useEffect(() => {
    void fetch("/api/admin/order-sources").then(async (response) => {
      if (!response.ok) throw new Error("source settings unavailable");
      const data = await response.json();
      setSources(data.data.filter((item: { active: boolean }) => item.active));
    }).catch(() => setSources([{ key: "WEBSITE", labelEn: "Website" }, { key: "SMS", labelEn: "SMS" }, { key: "WHATSAPP", labelEn: "WhatsApp" }, { key: "FACEBOOK_MESSAGE", labelEn: "Facebook Message" }]));
    const initial = window.setTimeout(() => {
      try {
        const storedViews = window.localStorage.getItem("metsanilo-admin-order-views");
        const storedDensity = window.localStorage.getItem("metsanilo-admin-density");
        const storedColumns = window.localStorage.getItem("metsanilo-admin-order-columns");
        if (storedViews) setSavedViews(JSON.parse(storedViews));
        if (storedDensity === "compact" || storedDensity === "comfortable") setDensity(storedDensity);
        if (storedColumns) setColumns(JSON.parse(storedColumns));
      } catch { /* Local preferences are optional. */ }
    }, 0);
    return () => window.clearTimeout(initial);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => { if (!document.hidden) void refreshOrders(); }, 30_000);
    const onVisible = () => { if (!document.hidden) void refreshOrders(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [refreshOrders]);

  useEffect(() => { const timer = window.setTimeout(() => setPage(1), 0); return () => window.clearTimeout(timer); }, [view, search, from, to, method, status, source]);

  const normalizedStatus = status === "ALL" ? "ALL" : status.replaceAll(" ", "_").toUpperCase();
  const matchesQuickView = useCallback((order: AdminOrder, selectedView: OrdersView) => {
    const day = today();
    return selectedView === "ALL"
      || selectedView === "TRIAGE" && getOrderTriageReasons(order).length > 0
      || selectedView === "TODAY" && order.fulfillmentDate === day
      || selectedView === "NEEDS_CONFIRMATION" && order.status === "NEW"
      || selectedView === "PICKUP_TODAY" && order.fulfillmentDate === day && order.fulfillmentMethod === "PICKUP"
      || selectedView === "DELIVERY_TODAY" && order.fulfillmentDate === day && order.fulfillmentMethod === "DELIVERY"
      || selectedView === "UNPAID" && order.paymentStatus === "UNPAID";
  }, []);

  const filtered = useMemo(() => rows.filter((order) => matchesQuickView(order, view)
    && (source === "ALL" || (source === "HISTORICAL" ? order.historicalEntry : !order.historicalEntry && order.orderSource === source))
    && (normalizedStatus === "ALL" || order.status === normalizedStatus)
    && (method === "ALL" || order.fulfillmentMethod === method)
    && (!from || order.fulfillmentDate >= from)
    && (!to || order.fulfillmentDate <= to)
    && `${order.publicReference} ${order.customerName} ${order.mobile}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => orderTriageScore(b) - orderTriageScore(a) || a.fulfillmentDate.localeCompare(b.fulfillmentDate) || a.createdAt.localeCompare(b.createdAt)), [rows, view, source, normalizedStatus, method, from, to, search, matchesQuickView]);

  const quickCounts = useMemo(() => Object.fromEntries(QUICK_VIEWS.map(({ key }) => [key, rows.filter((order) => matchesQuickView(order, key)).length])) as Record<OrdersView, number>, [rows, matchesQuickView]);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const inspectedIndex = inspectingId ? filtered.findIndex(({ id }) => id === inspectingId) : -1;
  const inspectedOrder = inspectedIndex >= 0 ? filtered[inspectedIndex] : null;

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "j" || event.key === "k" || event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "j" || event.key === "ArrowDown" ? 1 : -1;
        const current = filtered.findIndex(({ id }) => id === (inspectingId ?? activeId));
        const nextIndex = Math.min(filtered.length - 1, Math.max(0, (current < 0 ? (direction > 0 ? -1 : filtered.length) : current) + direction));
        const nextOrder = filtered[nextIndex];
        if (nextOrder) { setActiveId(nextOrder.id); if (inspectingId) setInspectingId(nextOrder.id); }
      }
      if (event.key === "Enter" && activeId && !inspectingId) { event.preventDefault(); setInspectingId(activeId); }
      if (event.key === "Escape" && inspectingId) setInspectingId(null);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [activeId, filtered, inspectingId]);

  function saveCurrentView() {
    const name = viewName.trim();
    if (!name) return;
    const next = [...savedViews.filter((item) => item.name !== name), { name, view, from, to, method, status, source }];
    setSavedViews(next);
    window.localStorage.setItem("metsanilo-admin-order-views", JSON.stringify(next));
    setViewName("");
    setNotice(`Saved view “${name}”.`);
  }
  function loadSavedView(item: typeof savedViews[number]) { setView(item.view); setFrom(item.from); setTo(item.to); setMethod(item.method); setStatus(item.status); setSource(item.source); }
  function nextStatuses(order: AdminOrder) { return getLegalOrderTransitions(order).filter((action) => action.available).map((action) => action.status); }
  async function transition(order: AdminOrder, target: string, transitionReason?: string) {
    const response = await fetch(`/api/admin/orders/${order.id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: target, expectedVersion: order.version, reason: transitionReason || undefined }) });
    const body = await response.json();
    if (!response.ok) { setError(body.message ?? "Status update failed."); return false; }
    updateOrder(body.data);
    return true;
  }
  function updateOrder(order: AdminOrder) { setRows((current) => current.map((item) => item.id === order.id ? { ...item, ...order } : item)); }
  async function applyPending() {
    if (!pending || !canTransition) return;
    const needsReason = ["CANCELLED", "CUSTOMER_DECLINED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW"].includes(pending.target);
    if (needsReason && reason.trim().length < 2) return setError("A reason is required.");
    let count = 0;
    for (const order of pending.orders) if (nextStatuses(order).includes(pending.target) && await transition(order, pending.target, reason)) count += 1;
    setSelected([]); setPending(null); setReason(""); setNotice(`${count} order(s) moved to ${statusLabel(pending.target)}.`);
  }
  function requestTransition(order: AdminOrder, target: string) { setError(""); setReason(""); setPending({ target: target as OrderStatus, orders: [order] }); }
  function exportCsv() {
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [["Reference", "Customer", "Date", "Method", "Source", "Status", "Payment", "Updated"], ...filtered.map((order) => [order.publicReference, order.customerName, order.fulfillmentDate, order.fulfillmentMethod, order.historicalEntry ? "Historical" : order.orderSource, order.status, order.paymentStatus, order.updatedAt])].map((line) => line.map(escape).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = "metsanilo-orders.csv"; link.click(); URL.revokeObjectURL(link.href);
  }
  function toggleColumn(column: Column) {
    const next = columns.includes(column) ? columns.filter((item) => item !== column) : [...columns, column];
    setColumns(next); window.localStorage.setItem("metsanilo-admin-order-columns", JSON.stringify(next));
  }
  function changeDensity(next: "compact" | "comfortable") { setDensity(next); window.localStorage.setItem("metsanilo-admin-density", next); }

  const allSelected = filtered.length > 0 && filtered.every(({ id }) => selected.includes(id));
  const available = [...new Set(rows.filter(({ id }) => selected.includes(id)).flatMap(nextStatuses))].filter((value) => ["CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED"].includes(value));

  return <main className="shell py-8 admin-orders-workspace">
    <AdminPageHeader eyebrow="RESERVATIONS & CAPACITY" title={view === "TRIAGE" ? "Action required" : "Orders"} description={view === "TRIAGE" ? "Urgent and incomplete work, ordered by operational risk." : "One operational queue for website, manual and historical orders."} meta={<><span>Updated {lastUpdated.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}</span><button className="text-button" type="button" onClick={() => void refreshOrders(true)}>Refresh</button></>} />
    {notice && <AdminNotice tone="success" live>{notice}</AdminNotice>}{error && <AdminNotice tone="error" live>{error}</AdminNotice>}
    <div className="admin-orders-toolbar mt-8"><div><p className="admin-section-kicker">Order queue</p><h2>{view === "TRIAGE" ? `${quickCounts.TRIAGE} items need attention` : "All orders"}</h2><p className="admin-section-description">Use quick views or filter by fulfillment date, source and status.</p></div><div className="profile-actions">{canCreate && <Link className="btn" href="/admin/manual-orders">+ Create order</Link>}{canExport && <button className="btn btn-secondary" onClick={exportCsv}>Export CSV</button>}</div></div>
    <div className="admin-quick-views flex flex-wrap gap-2 mt-4">{QUICK_VIEWS.map(({ key, label }) => <button className={`btn ${view === key ? "" : "btn-secondary"}${key === "TRIAGE" && quickCounts[key] > 0 ? " triage-filter" : ""}`} key={key} onClick={() => setView(key)}>{label} <span className="quick-view-count">{quickCounts[key]}</span></button>)}</div>
    <details className="admin-filter-panel card mt-3"><summary>Filters and saved views</summary><div className="admin-filter-grid"><label className="field"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference, customer, mobile" /></label><label className="field"><span>From</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="field"><span>To</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option>{["NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED", "CANCELLED", "NO_SHOW", "REJECTED"].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label><label className="field"><span>Method</span><select value={method} onChange={(event) => setMethod(event.target.value)}><option value="ALL">Pickup &amp; delivery</option><option value="PICKUP">Pickup</option><option value="DELIVERY">Delivery</option></select></label><label className="field"><span>Source</span><select value={source} onChange={(event) => setSource(event.target.value)}><option value="ALL">All sources</option>{sources.map((item) => <option key={item.key} value={item.key}>{item.labelEn}</option>)}<option value="HISTORICAL">Historical</option></select></label></div><div className="admin-saved-views"><label className="field"><span>Saved view</span><select value="" onChange={(event) => { const found = savedViews.find((item) => item.name === event.target.value); if (found) loadSavedView(found); }}><option value="">Load saved view…</option>{savedViews.map((item) => <option key={item.name}>{item.name}</option>)}</select></label><label className="field"><span>Save current as</span><input value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="e.g. Tomorrow delivery" /></label><button className="btn btn-secondary" type="button" onClick={saveCurrentView} disabled={!viewName.trim()}>Save view</button><button className="text-button" type="button" onClick={() => { setSearch(""); setFrom(""); setTo(""); setMethod("ALL"); setStatus("ALL"); setSource("ALL"); }}>Clear filters</button></div></details>
    <div className="admin-table-preferences"><fieldset><legend>Density</legend><label><input type="radio" name="density" checked={density === "compact"} onChange={() => changeDensity("compact")} /> Compact</label><label><input type="radio" name="density" checked={density === "comfortable"} onChange={() => changeDensity("comfortable")} /> Comfortable</label></fieldset><details><summary>Columns</summary><div>{ALL_COLUMNS.map((column) => <label key={column.key}><input type="checkbox" checked={columns.includes(column.key)} onChange={() => toggleColumn(column.key)} /> {column.label}</label>)}</div></details><span className="admin-key-hint">J/K move · Enter inspect</span></div>
    <AdminSelectionToolbar count={selected.length} total={filtered.length}><label className="flex items-center gap-2"><input type="checkbox" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? filtered.map(({ id }) => id) : [])} /> Select filtered ({filtered.length})</label>{canTransition && selected.length > 0 && <div className="profile-actions">{available.map((value) => <button className="btn" key={value} onClick={() => setPending({ target: value, orders: rows.filter(({ id }) => selected.includes(id)) })}>{statusLabel(value)} ({rows.filter((order) => selected.includes(order.id) && nextStatuses(order).includes(value)).length})</button>)}</div>}</AdminSelectionToolbar>
    <div className={`admin-orders-table-wrap card mt-3 hidden md:block density-${density}`}><table className="admin-orders-table"><thead><tr><th>Select</th><th>Order</th><th>Customer</th>{columns.includes("fulfillment") && <th>Fulfillment</th>}{columns.includes("source") && <th>Source</th>}{columns.includes("status") && <th>Status</th>}{columns.includes("payment") && <th>Payment</th>}{columns.includes("updated") && <th>Updated</th>}<th>Quick action</th></tr></thead><tbody>{visibleRows.map((order) => { const triage = getOrderTriageReasons(order); const isClosed = ["CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW", "DELIVERED", "PICKED_UP", "REFUNDED"].includes(order.status); return <tr key={order.id} className={activeId === order.id ? "is-keyboard-active" : ""} onClick={() => { setActiveId(order.id); setInspectingId(order.id); }}><td onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selected.includes(order.id)} aria-label={`Select ${order.publicReference}`} onChange={(event) => setSelected((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))} /></td><td><button type="button" className="admin-order-cell"><strong className="ops-tabular">{order.publicReference}</strong>{triage[0] ? <small className={`triage-reason ${triage[0].severity}`}>{triage[0].label}</small> : <small>{order.createdAt.slice(0, 16).replace("T", " ")}</small>}</button></td><td><strong>{order.customerName}</strong><small>{order.mobile}</small></td>{columns.includes("fulfillment") && <td><strong className="ops-tabular">{order.fulfillmentDate}</strong><small>{order.fulfillmentMethod} · <span className="ops-tabular">{order.volumeMl / 1000} L</span></small></td>}{columns.includes("source") && <td><span className="pill">{order.historicalEntry ? "Historical" : order.orderSource}</span></td>}{columns.includes("status") && <td><AdminStatusBadge status={order.status} label={statusLabel(order.status)} /></td>}{columns.includes("payment") && <td><AdminStatusBadge status={order.paymentStatus ?? "PENDING_FEE"} /><small>{formatAdminMoney(order.outstandingCents)} due</small></td>}{columns.includes("updated") && <td><small className="ops-tabular">{new Date(order.updatedAt).toLocaleString("fi-FI", { dateStyle: "short", timeStyle: "short" })}</small></td>}<td onClick={(event) => event.stopPropagation()}><div className="flex items-center gap-1.5">{canUpdate && !isClosed && <Link className="btn btn-secondary text-xs py-1 px-2" href={`/admin/orders/${order.id}/edit`}>Edit ✏️</Link>}{canTransition && nextStatuses(order).length > 0 ? <select aria-label={`Change status for ${order.publicReference}`} defaultValue="" onChange={(event) => { if (event.target.value) requestTransition(order, event.target.value); event.currentTarget.value = ""; }}><option value="">Status…</option>{nextStatuses(order).map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select> : <button className="btn btn-secondary text-xs py-1 px-2" type="button" onClick={() => setInspectingId(order.id)}>Inspect</button>}</div></td></tr>; })}</tbody></table>{filtered.length === 0 && <AdminEmptyState title={view === "TRIAGE" ? "Triage queue is clear" : "No matching orders"} description={view === "TRIAGE" ? "There are no overdue, incomplete, or exception orders." : "Try another quick view or adjust the filters."} />}</div>
    <div className="grid gap-3 md:hidden">{visibleRows.map((order) => { const isClosed = ["CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW", "DELIVERED", "PICKED_UP", "REFUNDED"].includes(order.status); return <article className="card admin-order-card" key={order.id} onClick={() => setInspectingId(order.id)}><div className="flex gap-3"><input type="checkbox" checked={selected.includes(order.id)} aria-label={`Select ${order.publicReference}`} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelected((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))} /><div className="flex-1"><div className="flex items-center justify-between"><strong className="ops-tabular">{order.publicReference}</strong>{canUpdate && !isClosed && <Link className="btn btn-secondary text-xs py-0.5 px-2" href={`/admin/orders/${order.id}/edit`} onClick={(e) => e.stopPropagation()}>Edit ✏️</Link>}</div><p>{order.customerName} · {order.mobile}</p><p className="ops-tabular">{order.fulfillmentDate} · {order.fulfillmentMethod}</p><p className="text-sm"><AdminStatusBadge status={order.status} label={statusLabel(order.status)} /></p>{getOrderTriageReasons(order).map((item) => <span className={`triage-reason ${item.severity}`} key={item.code}>{item.label}</span>)}</div></div></article>; })}</div>
    <div className="admin-pagination" aria-label="Pagination"><span>Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span><div><button className="btn btn-secondary" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} / {totalPages}</span><button className="btn btn-secondary" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
    {inspectedOrder && <OrderInspector order={inspectedOrder} canTransition={canTransition} canUpdate={canUpdate} onClose={() => setInspectingId(null)} onPrevious={inspectedIndex > 0 ? () => setInspectingId(filtered[inspectedIndex - 1].id) : undefined} onNext={inspectedIndex < filtered.length - 1 ? () => setInspectingId(filtered[inspectedIndex + 1].id) : undefined} onOrderUpdated={updateOrder} />}
    {pending && <div className="admin-dialog-backdrop"><form className="admin-dialog card" onSubmit={(event) => { event.preventDefault(); void applyPending(); }}><p className="eyebrow">ORDER ACTION</p><h2>{statusLabel(pending.target)}?</h2><p>{pending.orders.length} eligible order{pending.orders.length === 1 ? "" : "s"} will be updated. Destructive actions require a reason.</p>{["CANCELLED", "CUSTOMER_DECLINED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW"].includes(pending.target) && <label className="field"><span>Reason *</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} required /></label>}<div className="profile-actions"><button className="btn btn-secondary" type="button" onClick={() => setPending(null)}>Cancel</button><button className="btn" type="submit">Confirm</button></div></form></div>}
  </main>;
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}
