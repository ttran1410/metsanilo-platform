"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { orders } from "@/db/schema";
import { getOrderTriageReasons, orderTriageScore } from "@/domain/order-triage";
import { getLegalOrderTransitions, type OrderStatus } from "@/domain/order-transitions";
import { AdminEmptyState, AdminNotice, AdminPageHeader, AdminStatusBadge, formatAdminMoney } from "./presentation";
import { OrderInspector } from "./order-inspector";

export type AdminOrder = typeof orders.$inferSelect & { paidCents?: number; outstandingCents?: number | null; paymentStatus?: string };
export type OrdersView = "TRIAGE" | "ALL" | "TODAY" | "NEEDS_CONFIRMATION" | "PICKUP_TODAY" | "DELIVERY_TODAY" | "UNPAID";
type DatePreset = "TODAY" | "TOMORROW" | "YESTERDAY" | "THIS_WEEK" | "LAST_WEEK" | "LAST_7_DAYS" | "ALL" | "CUSTOM";
type Column = "fulfillment" | "source" | "status" | "payment" | "updated";
type PendingAction = { target: OrderStatus; orders: AdminOrder[] };

const QUICK_VIEWS: Array<{ key: OrdersView; label: string }> = [
  { key: "TODAY", label: "Today" },
  { key: "TRIAGE", label: "Action required" },
  { key: "NEEDS_CONFIRMATION", label: "Needs confirmation" },
  { key: "PICKUP_TODAY", label: "Pickup today" },
  { key: "DELIVERY_TODAY", label: "Delivery today" },
  { key: "UNPAID", label: "Unpaid" },
  { key: "ALL", label: "All orders" },
];
const ALL_COLUMNS: Array<{ key: Column; label: string }> = [
  { key: "fulfillment", label: "Fulfillment" }, { key: "source", label: "Source" }, { key: "status", label: "Status" }, { key: "payment", label: "Payment" }, { key: "updated", label: "Updated" },
];
const statusLabel = (value: string) => value === "OUT_FOR_DELIVERY" ? "Out for delivery" : value.replaceAll("_", " ");
const todayStr = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki" }).format(new Date());

function addDaysStr(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getPresetDates(preset: DatePreset): { from: string; to: string } {
  const day = todayStr();
  if (preset === "TODAY") return { from: day, to: day };
  if (preset === "TOMORROW") { const next = addDaysStr(day, 1); return { from: next, to: next }; }
  if (preset === "YESTERDAY") { const prev = addDaysStr(day, -1); return { from: prev, to: prev }; }
  if (preset === "LAST_7_DAYS") return { from: addDaysStr(day, -6), to: day };
  if (preset === "THIS_WEEK") {
    const d = new Date(`${day}T00:00:00Z`);
    const dayOfWeek = d.getUTCDay() || 7;
    const monday = addDaysStr(day, 1 - dayOfWeek);
    const sunday = addDaysStr(day, 7 - dayOfWeek);
    return { from: monday, to: sunday };
  }
  if (preset === "LAST_WEEK") {
    const d = new Date(`${day}T00:00:00Z`);
    const dayOfWeek = d.getUTCDay() || 7;
    const monday = addDaysStr(day, -6 - dayOfWeek);
    const sunday = addDaysStr(day, -dayOfWeek);
    return { from: monday, to: sunday };
  }
  return { from: "", to: "" };
}

export function OrdersListing({ initialOrders, initialView = "TODAY", initialStatus = "ALL", canExport, canCreate, canTransition, canUpdate = false }: {
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
  const [datePreset, setDatePreset] = useState<DatePreset>("TODAY");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [method, setMethod] = useState("ALL");
  const [status, setStatus] = useState(initialStatus);
  const [source, setSource] = useState("ALL");
  const [sources, setSources] = useState<Array<{ key: string; labelEn: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<AdminOrder | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
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
    if (!notice && !error) return;
    const timer = window.setTimeout(() => { setNotice(""); setError(""); }, 10_000);
    return () => window.clearTimeout(timer);
  }, [notice, error]);

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

  useEffect(() => { const timer = window.setTimeout(() => setPage(1), 0); return () => window.clearTimeout(timer); }, [view, search, from, to, method, status, source, datePreset]);

  function handleDatePresetChange(nextPreset: DatePreset) {
    setDatePreset(nextPreset);
    if (nextPreset !== "CUSTOM") {
      const dates = getPresetDates(nextPreset);
      setFrom(dates.from);
      setTo(dates.to);
    }
    setView("ALL");
  }

  function handleStatusChange(nextStatus: string) {
    setStatus(nextStatus);
    setView("ALL");
  }

  function handleMethodChange(nextMethod: string) {
    setMethod(nextMethod);
    setView("ALL");
  }

  function handleSourceChange(nextSource: string) {
    setSource(nextSource);
    setView("ALL");
  }

  function handleFromChange(nextFrom: string) {
    setFrom(nextFrom);
    setDatePreset("CUSTOM");
    setView("ALL");
  }

  function handleToChange(nextTo: string) {
    setTo(nextTo);
    setDatePreset("CUSTOM");
    setView("ALL");
  }

  function selectQuickView(targetView: OrdersView) {
    setView(targetView);
    const today = todayStr();

    if (targetView === "TODAY") {
      setDatePreset("TODAY");
      setFrom(today);
      setTo(today);
      setStatus("ALL");
      setMethod("ALL");
      setSource("ALL");
    } else if (targetView === "PICKUP_TODAY") {
      setDatePreset("TODAY");
      setFrom(today);
      setTo(today);
      setStatus("ALL");
      setMethod("PICKUP");
      setSource("ALL");
    } else if (targetView === "DELIVERY_TODAY") {
      setDatePreset("TODAY");
      setFrom(today);
      setTo(today);
      setStatus("ALL");
      setMethod("DELIVERY");
      setSource("ALL");
    } else if (targetView === "NEEDS_CONFIRMATION") {
      setDatePreset("ALL");
      setFrom("");
      setTo("");
      setStatus("NEW");
      setMethod("ALL");
      setSource("ALL");
    } else if (targetView === "TRIAGE") {
      setDatePreset("ALL");
      setFrom("");
      setTo("");
      setStatus("ALL");
      setMethod("ALL");
      setSource("ALL");
    } else if (targetView === "UNPAID") {
      setDatePreset("ALL");
      setFrom("");
      setTo("");
      setStatus("ALL");
      setMethod("ALL");
      setSource("ALL");
    } else if (targetView === "ALL") {
      setDatePreset("ALL");
      setFrom("");
      setTo("");
      setStatus("ALL");
      setMethod("ALL");
      setSource("ALL");
    }
  }

  const normalizedStatus = status === "ALL" ? "ALL" : status.replaceAll(" ", "_").toUpperCase();
  const matchesQuickView = useCallback((order: AdminOrder, selectedView: OrdersView) => {
    const day = todayStr();
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

  const quickCounts = useMemo(() => {
    const day = todayStr();
    return {
      ALL: rows.length,
      TRIAGE: rows.filter((order) => getOrderTriageReasons(order).length > 0).length,
      TODAY: rows.filter((order) => order.fulfillmentDate === day).length,
      NEEDS_CONFIRMATION: rows.filter((order) => order.status === "NEW").length,
      PICKUP_TODAY: rows.filter((order) => order.fulfillmentDate === day && order.fulfillmentMethod === "PICKUP").length,
      DELIVERY_TODAY: rows.filter((order) => order.fulfillmentDate === day && order.fulfillmentMethod === "DELIVERY").length,
      UNPAID: rows.filter((order) => order.paymentStatus === "UNPAID").length,
    };
  }, [rows]);

  const unpaidTotalCents = useMemo(() => rows.filter((o) => o.paymentStatus === "UNPAID").reduce((sum, o) => sum + (o.outstandingCents ?? 0), 0), [rows]);


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
      if (event.key === "Escape") { if (inspectingId) setInspectingId(null); setOpenMenuId(null); }
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

  function loadSavedView(item: typeof savedViews[number]) {
    setView("ALL");
    setFrom(item.from);
    setTo(item.to);
    setMethod(item.method);
    setStatus(item.status);
    setSource(item.source);
    setDatePreset(item.from || item.to ? "CUSTOM" : "ALL");
    setNotice(`Loaded saved view “${item.name}”.`);
  }

  function nextStatuses(order: AdminOrder) { return getLegalOrderTransitions(order).filter((action) => action.available).map((action) => action.status); }


  async function transition(order: AdminOrder, target: string, transitionReason?: string) {
    const response = await fetch(`/api/admin/orders/${order.id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: target, expectedVersion: order.version, reason: transitionReason || undefined }) });
    const body = await response.json();
    if (!response.ok) { setError(body.message ?? "Status update failed."); return false; }
    updateOrder(body.data);
    return true;
  }
  function updateOrder(order: AdminOrder) { setRows((current) => current.map((item) => item.id === order.id ? { ...item, ...order } : item)); }
  
  async function deleteOrder(order: AdminOrder) {
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Failed to delete order");
      setRows((current) => current.filter((item) => item.id !== order.id));
      setSelected((current) => current.filter((id) => id !== order.id));
      setDeletingOrder(null);
      setNotice(`Order ${order.publicReference} deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete order");
    }
  }

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

  return (
    <main className="shell py-8 admin-orders-workspace">
      <AdminPageHeader
        eyebrow="RESERVATIONS &amp; CAPACITY"
        title={view === "TRIAGE" ? "Action required" : "Orders Queue"}
        description="Operational order queue for pickup, delivery, and historical orders."
        meta={<><span>Updated {lastUpdated.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}</span><button className="text-button" type="button" onClick={() => void refreshOrders(true)}>Refresh</button></>}
      />

      {/* Dismissible Notice Banners */}
      {notice && <AdminNotice tone="success" live>{notice}</AdminNotice>}
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      {/* Top Operational Metric KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <button type="button" className={`card text-left p-3 transition hover:shadow-md ${view === "TRIAGE" ? "border-primary bg-primary-soft" : ""}`} onClick={() => selectQuickView("TRIAGE")}>
          <span className="text-xs font-bold uppercase muted block">🔴 Action Needed</span>
          <strong className="text-2xl font-bold block mt-1">{quickCounts.TRIAGE}</strong>
          <span className="text-xs text-primary font-medium">Urgent attention ➔</span>
        </button>

        <button type="button" className={`card text-left p-3 transition hover:shadow-md ${view === "NEEDS_CONFIRMATION" ? "border-primary bg-primary-soft" : ""}`} onClick={() => selectQuickView("NEEDS_CONFIRMATION")}>
          <span className="text-xs font-bold uppercase muted block">⏳ Needs Confirm</span>
          <strong className="text-2xl font-bold block mt-1">{quickCounts.NEEDS_CONFIRMATION}</strong>
          <span className="text-xs text-primary font-medium">Unconfirmed new ➔</span>
        </button>

        <button type="button" className={`card text-left p-3 transition hover:shadow-md ${view === "TODAY" ? "border-primary bg-primary-soft" : ""}`} onClick={() => selectQuickView("TODAY")}>
          <span className="text-xs font-bold uppercase muted block">📦 Today's Queue</span>
          <strong className="text-2xl font-bold block mt-1">{quickCounts.TODAY}</strong>
          <span className="text-xs muted block">{quickCounts.PICKUP_TODAY} Pickup · {quickCounts.DELIVERY_TODAY} Delivery</span>
        </button>

        <button type="button" className={`card text-left p-3 transition hover:shadow-md ${view === "UNPAID" ? "border-primary bg-primary-soft" : ""}`} onClick={() => selectQuickView("UNPAID")}>
          <span className="text-xs font-bold uppercase muted block">💵 Unpaid Orders</span>
          <strong className="text-2xl font-bold block mt-1">{quickCounts.UNPAID}</strong>
          <span className="text-xs text-primary font-medium">{formatAdminMoney(unpaidTotalCents)} due</span>
        </button>
      </div>

      {/* Main Search & Quick View Toolbar */}
      <div className="admin-orders-toolbar mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Always-Visible Primary Search Input */}
          <div className="relative min-w-[260px] flex-1 max-w-md">
            <input
              className="w-full pl-3 pr-8 py-2 text-sm border border-line rounded-md"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reference, customer, mobile..."
            />
            {search && (
              <button type="button" className="absolute right-2.5 top-2.5 text-xs text-muted hover:text-ink font-bold" onClick={() => setSearch("")}>×</button>
            )}
          </div>
        </div>

        <div className="profile-actions flex items-center gap-2">
          {canCreate && <Link className="btn text-sm" href="/admin/manual-orders">+ Create order</Link>}
          {canExport && <button className="btn btn-secondary text-sm" onClick={exportCsv}>Export CSV</button>}
        </div>
      </div>

      {/* Quick View Segmented Tabs */}
      <div className="admin-quick-views flex flex-wrap gap-2 mt-4">
        {QUICK_VIEWS.map(({ key, label }) => (
          <button className={`btn ${view === key ? "" : "btn-secondary"}${key === "TRIAGE" && quickCounts[key] > 0 ? " triage-filter" : ""}`} key={key} onClick={() => selectQuickView(key)}>
            {label} <span className="quick-view-count">{quickCounts[key]}</span>
          </button>
        ))}
      </div>


      {/* Filters and Presets Drawer */}
      <details className="admin-filter-panel card mt-3">
        <summary className="cursor-pointer font-semibold text-sm">Filters &amp; Date Presets</summary>
        
        <div className="admin-filter-grid mt-3">
          {/* Date Preset Selector */}
          <label className="field">
            <span>Date Range Preset</span>
            <select value={datePreset} onChange={(e) => handleDatePresetChange(e.target.value as DatePreset)}>
              <option value="TODAY">Today ({todayStr()})</option>
              <option value="TOMORROW">Tomorrow</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="THIS_WEEK">This Week (Mon–Sun)</option>
              <option value="LAST_WEEK">Last Week</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="ALL">All Dates</option>
              <option value="CUSTOM">Custom Date Range...</option>
            </select>
          </label>

          {/* Conditional From/To Date Pickers (Only visible if CUSTOM preset selected) */}
          {datePreset === "CUSTOM" && (
            <>
              <label className="field">
                <span>From Date</span>
                <input type="date" value={from} onChange={(event) => handleFromChange(event.target.value)} />
              </label>
              <label className="field">
                <span>To Date</span>
                <input type="date" value={to} onChange={(event) => handleToChange(event.target.value)} />
              </label>
            </>
          )}

          <label className="field">
            <span>Status</span>
            <select value={status} onChange={(event) => handleStatusChange(event.target.value)}>
              <option value="ALL">All statuses</option>
              {["NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED", "CANCELLED", "NO_SHOW", "REJECTED"].map((value) => (
                <option key={value} value={value}>{statusLabel(value)}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Method</span>
            <select value={method} onChange={(event) => handleMethodChange(event.target.value)}>
              <option value="ALL">Pickup &amp; Delivery</option>
              <option value="PICKUP">Pickup</option>
              <option value="DELIVERY">Delivery</option>
            </select>
          </label>

          <label className="field">
            <span>Order Source</span>
            <select value={source} onChange={(event) => handleSourceChange(event.target.value)}>
              <option value="ALL">All sources</option>
              {sources.map((item) => <option key={item.key} value={item.key}>{item.labelEn}</option>)}
              <option value="HISTORICAL">Historical</option>
            </select>
          </label>
        </div>

        {/* Conditional Saved Views (Only renders if savedViews.length > 0) */}
        <div className="admin-saved-views mt-3 pt-3 border-t border-line flex flex-wrap items-center gap-3">
          {savedViews.length > 0 && (
            <label className="field min-w-[200px]">
              <span>Saved View</span>
              <select value="" onChange={(event) => { const found = savedViews.find((item) => item.name === event.target.value); if (found) loadSavedView(found); }}>
                <option value="">Load saved view…</option>
                {savedViews.map((item) => <option key={item.name}>{item.name}</option>)}
              </select>
            </label>
          )}
          
          <label className="field flex-1 min-w-[200px]">
            <span>Save current view as</span>
            <input value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="e.g. Tomorrow Delivery" />
          </label>

          <div className="flex items-center gap-2 self-end">
            <button className="btn btn-secondary text-xs" type="button" onClick={saveCurrentView} disabled={!viewName.trim()}>Save view</button>
            <button className="text-button text-xs" type="button" onClick={() => { setSearch(""); selectQuickView("ALL"); }}>Clear filters</button>
          </div>
        </div>

      </details>

      {/* Table Preferences & Density Controls */}
      <div className="admin-table-preferences flex items-center justify-between mt-3 text-xs muted">
        <fieldset className="flex items-center gap-3">
          <legend className="sr-only">Density</legend>
          <label><input type="radio" name="density" checked={density === "compact"} onChange={() => changeDensity("compact")} /> Compact</label>
          <label><input type="radio" name="density" checked={density === "comfortable"} onChange={() => changeDensity("comfortable")} /> Comfortable</label>
        </fieldset>
        <div className="flex items-center gap-3">
          <details className="relative inline-block">
            <summary className="cursor-pointer underline">Columns ({columns.length})</summary>
            <div className="absolute right-0 bottom-full mb-1 p-2 card bg-surface shadow-lg z-20 flex flex-col gap-1 min-w-[140px]">
              {ALL_COLUMNS.map((column) => (
                <label key={column.key} className="flex items-center gap-2">
                  <input type="checkbox" checked={columns.includes(column.key)} onChange={() => toggleColumn(column.key)} /> {column.label}
                </label>
              ))}
            </div>
          </details>
          <span className="admin-key-hint">J/K move · Enter quick view</span>
        </div>
      </div>

      {/* Desktop Orders Data Table */}
      <div className={`admin-orders-table-wrap card mt-3 hidden md:block density-${density}`}>
        <table className="admin-orders-table">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  aria-label="Select all orders"
                  onChange={(event) => setSelected(event.target.checked ? filtered.map(({ id }) => id) : [])}
                />
              </th>
              <th>Order Ref</th>
              <th>Customer</th>
              {columns.includes("fulfillment") && <th>Fulfillment</th>}
              {columns.includes("source") && <th>Source</th>}
              {columns.includes("status") && <th>Status</th>}
              {columns.includes("payment") && <th>Payment</th>}
              {columns.includes("updated") && <th>Updated</th>}
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((order) => {
              const triage = getOrderTriageReasons(order);
              const isClosed = ["CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW", "DELIVERED", "PICKED_UP", "REFUNDED"].includes(order.status);
              const isTriage = triage.length > 0;
              const hasPayment = (order.paidCents ?? 0) > 0;

              return (
                <tr
                  key={order.id}
                  className={`${activeId === order.id ? "is-keyboard-active" : ""} ${isTriage ? "bg-amber-50/50" : ""}`}
                  onClick={() => { setActiveId(order.id); setInspectingId(order.id); }}
                >
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(order.id)}
                      aria-label={`Select ${order.publicReference}`}
                      onChange={(event) => setSelected((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))}
                    />
                  </td>

                  <td>
                    <button type="button" className="admin-order-cell text-left">
                      <strong className="ops-tabular block">{order.publicReference}</strong>
                      {triage[0] ? (
                        <small className={`triage-reason ${triage[0].severity}`}>{triage[0].label}</small>
                      ) : (
                        <small className="muted">{order.createdAt.slice(0, 16).replace("T", " ")}</small>
                      )}
                    </button>
                  </td>

                  <td>
                    <strong className="block">{order.customerName}</strong>
                    <small className="muted">{order.mobile}</small>
                  </td>

                  {columns.includes("fulfillment") && (
                    <td>
                      <strong className="ops-tabular block">{order.fulfillmentDate}</strong>
                      <small className="muted">
                        {order.fulfillmentMethod === "PICKUP" ? "📦 Pickup" : "🚛 Delivery"} · <span className="ops-tabular">{order.volumeMl / 1000} L</span>
                      </small>
                    </td>
                  )}

                  {columns.includes("source") && (
                    <td>
                      <span className="pill text-xs">{order.historicalEntry ? "Historical" : order.orderSource}</span>
                    </td>
                  )}

                  {columns.includes("status") && (
                    <td>
                      <AdminStatusBadge status={order.status} label={statusLabel(order.status)} />
                    </td>
                  )}

                  {columns.includes("payment") && (
                    <td>
                      <AdminStatusBadge status={order.paymentStatus ?? "PENDING_FEE"} />
                      <small className="block muted text-xs">{formatAdminMoney(order.outstandingCents)} due</small>
                    </td>
                  )}

                  {columns.includes("updated") && (
                    <td>
                      <small className="ops-tabular muted">{new Date(order.updatedAt).toLocaleString("fi-FI", { dateStyle: "short", timeStyle: "short" })}</small>
                    </td>
                  )}

                  {/* Quick Action Context Menu (···) */}
                  <td onClick={(event) => event.stopPropagation()} className="text-right relative">
                    <div className="inline-block text-left">
                      <button
                        type="button"
                        className="btn btn-secondary text-xs py-1 px-2.5"
                        onClick={() => setOpenMenuId(openMenuId === order.id ? null : order.id)}
                        aria-label="Actions menu"
                      >
                        ···
                      </button>

                      {openMenuId === order.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 card bg-surface shadow-xl z-30 py-1 text-xs flex flex-col gap-1 text-left">
                          <button
                            type="button"
                            className="w-full text-left px-3 py-1.5 hover:bg-surface-muted flex items-center gap-2"
                            onClick={() => { setInspectingId(order.id); setOpenMenuId(null); }}
                          >
                            👁️ Quick View
                          </button>

                          <Link
                            className="w-full text-left px-3 py-1.5 hover:bg-surface-muted flex items-center gap-2 text-ink"
                            href={`/admin/orders/${order.id}`}
                            onClick={() => setOpenMenuId(null)}
                          >
                            📄 View Details
                          </Link>

                          {canUpdate && !isClosed && (
                            <Link
                              className="w-full text-left px-3 py-1.5 hover:bg-surface-muted flex items-center gap-2 text-ink"
                              href={`/admin/orders/${order.id}/edit`}
                              onClick={() => setOpenMenuId(null)}
                            >
                              ✏️ Edit Order
                            </Link>
                          )}

                          {canTransition && !isClosed && (
                            <button
                              type="button"
                              className="w-full text-left px-3 py-1.5 hover:bg-surface-muted flex items-center gap-2 text-danger"
                              onClick={() => { requestTransition(order, "CANCELLED"); setOpenMenuId(null); }}
                            >
                              📁 Archive Order
                            </button>
                          )}

                          {canUpdate && !hasPayment && (
                            <button
                              type="button"
                              className="w-full text-left px-3 py-1.5 hover:bg-surface-muted flex items-center gap-2 text-danger font-semibold border-t border-line"
                              onClick={() => { setDeletingOrder(order); setOpenMenuId(null); }}
                            >
                              🗑️ Delete Order
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <AdminEmptyState title={view === "TRIAGE" ? "Triage queue is clear" : "No matching orders"} description={view === "TRIAGE" ? "There are no overdue or incomplete orders." : "Try adjusting date presets or search terms."} />
        )}
      </div>

      {/* Mobile Orders Card View */}
      <div className="grid gap-3 md:hidden mt-3">
        {visibleRows.map((order) => {
          const isClosed = ["CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW", "DELIVERED", "PICKED_UP", "REFUNDED"].includes(order.status);
          return (
            <article className="card admin-order-card" key={order.id} onClick={() => setInspectingId(order.id)}>
              <div className="flex gap-3">
                <input
                  type="checkbox"
                  checked={selected.includes(order.id)}
                  aria-label={`Select ${order.publicReference}`}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setSelected((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <strong className="ops-tabular">{order.publicReference}</strong>
                    {canUpdate && !isClosed && (
                      <Link className="btn btn-secondary text-xs py-0.5 px-2" href={`/admin/orders/${order.id}/edit`} onClick={(e) => e.stopPropagation()}>
                        Edit ✏️
                      </Link>
                    )}
                  </div>
                  <p className="text-sm font-semibold mt-0.5">{order.customerName} · {order.mobile}</p>
                  <p className="ops-tabular text-xs muted">{order.fulfillmentDate} · {order.fulfillmentMethod}</p>
                  <p className="text-sm mt-1">
                    <AdminStatusBadge status={order.status} label={statusLabel(order.status)} />
                  </p>
                  {getOrderTriageReasons(order).map((item) => (
                    <span className={`triage-reason ${item.severity}`} key={item.code}>{item.label}</span>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Pagination Controls */}
      <div className="admin-pagination flex items-center justify-between mt-4 text-xs muted" aria-label="Pagination">
        <span>Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary py-1 px-3 text-xs" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
          <span>Page {page} / {totalPages}</span>
          <button className="btn btn-secondary py-1 px-3 text-xs" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
        </div>
      </div>

      {/* Sticky Floating Bulk Selection Toolbar */}
      {selected.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-ink text-on-primary py-3 px-5 rounded-xl shadow-2xl z-50 flex items-center gap-4 text-sm max-w-2xl w-[90%] flex-wrap justify-between border border-line">
          <span className="font-bold">{selected.length} orders selected</span>
          
          <div className="flex items-center gap-2 flex-wrap">
            {canTransition && available.map((value) => (
              <button
                key={value}
                className="btn btn-secondary text-xs py-1 px-2.5 bg-surface text-ink"
                onClick={() => setPending({ target: value as OrderStatus, orders: rows.filter(({ id }) => selected.includes(id)) })}
              >
                {statusLabel(value)} ({rows.filter((order) => selected.includes(order.id) && nextStatuses(order).includes(value)).length})
              </button>
            ))}
            
            {canExport && (
              <button className="btn btn-secondary text-xs py-1 px-2.5 bg-surface text-ink" onClick={exportCsv}>Export CSV</button>
            )}

            <button type="button" className="text-xs text-on-primary underline font-medium" onClick={() => setSelected([])}>Clear</button>
          </div>
        </div>
      )}

      {/* Quick View Side Drawer */}
      {inspectedOrder && (
        <OrderInspector
          order={inspectedOrder}
          canTransition={canTransition}
          canUpdate={canUpdate}
          onClose={() => setInspectingId(null)}
          onPrevious={inspectedIndex > 0 ? () => setInspectingId(filtered[inspectedIndex - 1].id) : undefined}
          onNext={inspectedIndex < filtered.length - 1 ? () => setInspectingId(filtered[inspectedIndex + 1].id) : undefined}
          onOrderUpdated={updateOrder}
        />
      )}

      {/* Status Action Confirmation Dialog */}
      {pending && (
        <div className="admin-dialog-backdrop">
          <form className="admin-dialog card" onSubmit={(event) => { event.preventDefault(); void applyPending(); }}>
            <p className="eyebrow">ORDER ACTION</p>
            <h2>{statusLabel(pending.target)}?</h2>
            <p>{pending.orders.length} eligible order{pending.orders.length === 1 ? "" : "s"} will be updated. Destructive actions require a reason.</p>
            {["CANCELLED", "CUSTOMER_DECLINED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW"].includes(pending.target) && (
              <label className="field">
                <span>Reason *</span>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} required placeholder="Explain reason for status change..." />
              </label>
            )}
            <div className="profile-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setPending(null)}>Cancel</button>
              <button className="btn" type="submit">Confirm</button>
            </div>
          </form>
        </div>
      )}

      {/* Permanent Delete Order Confirmation Dialog */}
      {deletingOrder && (
        <div className="admin-dialog-backdrop">
          <div className="admin-dialog card flex flex-col gap-3">
            <p className="eyebrow text-danger">PERMANENT DELETE</p>
            <h2 className="text-lg font-bold">Delete Order {deletingOrder.publicReference}?</h2>
            <p className="text-sm muted">
              Are you sure you want to permanently delete this order for <strong>{deletingOrder.customerName}</strong>? This action cannot be undone.
            </p>
            <div className="profile-actions justify-end gap-2 mt-2">
              <button className="btn btn-secondary" type="button" onClick={() => setDeletingOrder(null)}>Cancel</button>
              <button className="btn btn-danger" type="button" onClick={() => void deleteOrder(deletingOrder)}>Delete Order</button>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}


function isTyping(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}
