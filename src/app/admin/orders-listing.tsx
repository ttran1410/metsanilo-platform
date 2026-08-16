"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { orders } from "@/db/schema";
import { getOrderTriageReasons, orderTriageScore } from "@/domain/order-triage";
import { getLegalOrderTransitions, type OrderStatus } from "@/domain/order-transitions";
import { AdminEmptyState, AdminNotice, AdminPageHeader, AdminStatusBadge, formatAdminMoney } from "./presentation";
import { OrderInspector } from "./order-inspector";
import { PickupTerminal } from "./orders/pickup-terminal";
import { PackingKanban } from "./orders/packing-kanban";
import { BatchPackingSlip } from "./orders/batch-packing-slip";

export type AdminOrder = typeof orders.$inferSelect & {
  paidCents?: number;
  outstandingCents?: number | null;
  paymentStatus?: string;
};

export type OrdersView =
  | "TRIAGE"
  | "ALL"
  | "TODAY"
  | "NEEDS_CONFIRMATION"
  | "PICKUP_TODAY"
  | "DELIVERY_TODAY"
  | "UNPAID";

type WorkspaceMode = "TABLE" | "KANBAN" | "TERMINAL";
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
  { key: "fulfillment", label: "Fulfillment" },
  { key: "source", label: "Source" },
  { key: "status", label: "Status" },
  { key: "payment", label: "Payment" },
  { key: "updated", label: "Updated" },
];

const statusLabel = (value: string) =>
  value === "OUT_FOR_DELIVERY" ? "Out for delivery" : value.replaceAll("_", " ");

const todayStr = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki" }).format(new Date());

function addDaysStr(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getPresetDates(preset: DatePreset): { from: string; to: string } {
  const day = todayStr();
  if (preset === "TODAY") return { from: day, to: day };
  if (preset === "TOMORROW") {
    const next = addDaysStr(day, 1);
    return { from: next, to: next };
  }
  if (preset === "YESTERDAY") {
    const prev = addDaysStr(day, -1);
    return { from: prev, to: prev };
  }
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

export function OrdersListing({
  initialOrders,
  initialView = "TODAY",
  initialStatus = "ALL",
  canExport,
  canCreate,
  canTransition,
  canUpdate = false,
}: {
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
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("TABLE");
  const [showPackingSlip, setShowPackingSlip] = useState(false);

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
  const [savedViews, setSavedViews] = useState<
    Array<{
      name: string;
      view: OrdersView;
      from: string;
      to: string;
      method: string;
      status: string;
      source: string;
    }>
  >([]);
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
      if (announce) setNotice("Order queue synced.");
    } catch (err) {
      if (announce) setError(err instanceof Error ? err.message : "Sync failed.");
    }
  }, []);

  useEffect(() => {
    async function loadSources() {
      try {
        const response = await fetch("/api/admin/settings");
        const body = await response.json();
        if (response.ok && body.data?.sources) {
          setSources(body.data.sources);
        }
      } catch {
        /* Ignore */
      }
    }
    void loadSources();

    const storedViews = localStorage.getItem("metsanilo_saved_order_views");
    if (storedViews) {
      try {
        setSavedViews(JSON.parse(storedViews));
      } catch {
        /* Ignore */
      }
    }
    const storedDensity = localStorage.getItem("metsanilo_orders_density");
    if (storedDensity === "compact" || storedDensity === "comfortable") {
      setDensity(storedDensity);
    }
    const storedColumns = localStorage.getItem("metsanilo_orders_columns");
    if (storedColumns) {
      try {
        setColumns(JSON.parse(storedColumns));
      } catch {
        /* Ignore */
      }
    }
  }, []);

  function handleDatePresetChange(preset: DatePreset) {
    setDatePreset(preset);
    if (preset === "CUSTOM") return;
    const { from: f, to: t } = getPresetDates(preset);
    setFrom(f);
    setTo(t);
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
    } else if (targetView === "TRIAGE" || targetView === "UNPAID" || targetView === "ALL") {
      setDatePreset("ALL");
      setFrom("");
      setTo("");
      setStatus("ALL");
      setMethod("ALL");
      setSource("ALL");
    }
  }

  const matchesQuickView = useCallback((order: AdminOrder, selectedView: OrdersView) => {
    const day = todayStr();
    return (
      selectedView === "ALL" ||
      (selectedView === "TRIAGE" && getOrderTriageReasons(order).length > 0) ||
      (selectedView === "TODAY" && order.fulfillmentDate === day) ||
      (selectedView === "NEEDS_CONFIRMATION" && order.status === "NEW") ||
      (selectedView === "PICKUP_TODAY" && order.fulfillmentDate === day && order.fulfillmentMethod === "PICKUP") ||
      (selectedView === "DELIVERY_TODAY" && order.fulfillmentDate === day && order.fulfillmentMethod === "DELIVERY") ||
      (selectedView === "UNPAID" && order.paymentStatus === "UNPAID")
    );
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((order) => {
      const query = search.trim().toLowerCase();
      const text = `${order.publicReference} ${order.customerName} ${order.mobile} ${order.email ?? ""}`.toLowerCase();
      const matchesSearch = !query || text.includes(query);
      const matchesDate =
        (!from || order.fulfillmentDate >= from) && (!to || order.fulfillmentDate <= to);
      const matchesMethod = method === "ALL" || order.fulfillmentMethod === method;
      const matchesStatus = status === "ALL" || order.status === status;
      const matchesSource = source === "ALL" || order.orderSource === source;

      return (
        matchesSearch &&
        matchesDate &&
        matchesMethod &&
        matchesStatus &&
        matchesSource &&
        matchesQuickView(order, view)
      );
    });
  }, [rows, search, from, to, method, status, source, view, matchesQuickView]);

  const sortedRows = useMemo(() => {
    if (view === "TRIAGE") {
      return [...filtered].sort((a, b) => orderTriageScore(b) - orderTriageScore(a));
    }
    return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [filtered, view]);

  const totalPages = Math.ceil(sortedRows.length / 50) || 1;
  const visibleRows = useMemo(() => {
    const start = (page - 1) * 50;
    return sortedRows.slice(start, start + 50);
  }, [sortedRows, page]);

  const selectedOrders = useMemo(() => {
    return rows.filter((order) => selected.includes(order.id));
  }, [rows, selected]);

  const allSelected = visibleRows.length > 0 && visibleRows.every((order) => selected.includes(order.id));

  function toggleColumn(col: Column) {
    const next = columns.includes(col) ? columns.filter((c) => c !== col) : [...columns, col];
    setColumns(next);
    localStorage.setItem("metsanilo_orders_columns", JSON.stringify(next));
  }

  function changeDensity(next: "compact" | "comfortable") {
    setDensity(next);
    localStorage.setItem("metsanilo_orders_density", next);
  }

  function saveCurrentView() {
    if (!viewName.trim()) return;
    const next = [
      ...savedViews.filter((v) => v.name !== viewName.trim()),
      { name: viewName.trim(), view, from, to, method, status, source },
    ];
    setSavedViews(next);
    localStorage.setItem("metsanilo_saved_order_views", JSON.stringify(next));
    setViewName("");
  }

  function requestTransition(order: AdminOrder, target: OrderStatus) {
    setPending({ target, orders: [order] });
    setReason("");
  }

  function requestBatchTransition(target: OrderStatus) {
    if (!selectedOrders.length) return;
    setPending({ target, orders: selectedOrders });
    setReason("");
  }

  async function confirmTransition() {
    if (!pending) return;
    setError("");
    setNotice("");

    try {
      for (const order of pending.orders) {
        const response = await fetch(`/api/admin/orders/${order.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "transition", status: pending.target, reason: reason.trim() || undefined }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? `Transition failed for ${order.publicReference}`);
      }
      setNotice(`Updated ${pending.orders.length} order(s) to ${statusLabel(pending.target)}.`);
      setSelected([]);
      setPending(null);
      await refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch transition failed.");
    }
  }

  return (
    <section className="shell pb-10 flex flex-col gap-3">
      {/* HEADER & SUB-VIEW WORKSPACE MODE SWITCHER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <AdminPageHeader
          eyebrow="OPERATIONS WORKSPACE"
          title="Orders &amp; Fulfillment Queue"
          description={`Updated ${lastUpdated.toLocaleTimeString("fi-FI")}`}
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* 3 SUB-VIEW SWITCHER PIS */}
          <div className="flex items-center gap-1 bg-surface-muted p-1 rounded-xl border border-line text-xs font-bold">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                workspaceMode === "TABLE" ? "bg-surface text-primary shadow-xs border border-line" : "text-ink/70 hover:text-ink"
              }`}
              onClick={() => setWorkspaceMode("TABLE")}
            >
              📋 Table View
            </button>

            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                workspaceMode === "KANBAN" ? "bg-surface text-primary shadow-xs border border-line" : "text-ink/70 hover:text-ink"
              }`}
              onClick={() => setWorkspaceMode("KANBAN")}
            >
              📊 Packing Board
            </button>

            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                workspaceMode === "TERMINAL" ? "bg-surface text-primary shadow-xs border border-line" : "text-ink/70 hover:text-ink"
              }`}
              onClick={() => setWorkspaceMode("TERMINAL")}
            >
              📱 Pickup Mode
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary text-xs py-1.5 px-3 font-semibold"
            onClick={() => setShowPackingSlip(true)}
          >
            🖨️ Batch Packing Slip
          </button>

          {canCreate && (
            <Link className="btn text-xs py-1.5 px-3 font-bold" href="/admin/manual-orders/new">
              ＋ New Order
            </Link>
          )}
        </div>
      </div>

      {notice && <AdminNotice tone="success" live>{notice}</AdminNotice>}
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      {/* RENDER SELECTED WORKSPACE SUB-VIEW */}
      {workspaceMode === "KANBAN" && (
        <PackingKanban orders={rows} canTransition={canTransition} onRefresh={() => void refreshOrders()} />
      )}

      {workspaceMode === "TERMINAL" && (
        <PickupTerminal orders={rows} canTransition={canTransition} onRefresh={() => void refreshOrders()} />
      )}

      {workspaceMode === "TABLE" && (
        <div className="flex flex-col gap-3">
          {/* QUICK VIEW CHIPS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {QUICK_VIEWS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
                  view === chip.key
                    ? "bg-primary text-on-primary shadow-xs"
                    : "bg-surface-muted text-ink/70 hover:bg-surface-muted/80"
                }`}
                onClick={() => selectQuickView(chip.key)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* SEARCH & FILTERS BAR */}
          <div className="card p-3 flex flex-wrap items-center gap-3">
            <input
              placeholder="Search reference, customer name, or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[220px] text-xs py-1.5 px-3 rounded-lg border border-line bg-surface"
            />

            <select
              aria-label="Filter status"
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-line bg-surface"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">NEW</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="PICKING">PICKING</option>
              <option value="READY">READY</option>
              <option value="PICKED_UP">PICKED_UP</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>

            <select
              aria-label="Filter fulfillment method"
              value={method}
              onChange={(e) => handleMethodChange(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-line bg-surface"
            >
              <option value="ALL">All Methods</option>
              <option value="PICKUP">📍 Pickup</option>
              <option value="DELIVERY">🚚 Delivery</option>
            </select>

            {canExport && (
              <a className="btn btn-secondary text-xs py-1.5 px-3" href="/api/admin/orders/export" download>
                📥 Export CSV
              </a>
            )}
          </div>

          {/* TABLE DATA DISPLAY */}
          <div className="card overflow-x-auto border border-line rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted border-b border-line text-muted uppercase font-bold text-[11px] tracking-wider">
                <tr>
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => setSelected(e.target.checked ? visibleRows.map((r) => r.id) : [])}
                    />
                  </th>
                  <th className="p-3">Order Ref</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Fulfillment</th>
                  <th className="p-3">Items &amp; Vol</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibleRows.map((order) => {
                  const isPaid = (order.outstandingCents ?? 0) <= 0;
                  const isClosed = ["CANCELLED", "REJECTED", "NO_SHOW", "DELIVERED", "PICKED_UP"].includes(order.status);
                  const isDelivery = order.fulfillmentMethod === "DELIVERY";
                  const mapsUrl = isDelivery
                    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        (order.streetAddress ? `${order.streetAddress}, ` : "") + (order.city || "Pori") + ", Finland"
                      )}`
                    : null;

                  return (
                    <tr key={order.id} className="hover:bg-surface-muted/40 transition-colors">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(order.id)}
                          onChange={(e) =>
                            setSelected((cur) =>
                              e.target.checked ? [...cur, order.id] : cur.filter((id) => id !== order.id)
                            )
                          }
                        />
                      </td>

                      <td className="p-3 font-bold">
                        <Link className="text-primary hover:underline font-mono" href={`/admin/orders/${order.id}`}>
                          {order.publicReference}
                        </Link>
                        <span className="muted block text-[11px] font-normal">{order.createdAt.slice(0, 10)}</span>
                      </td>

                      <td className="p-3">
                        <strong className="text-ink block font-bold">{order.customerName}</strong>
                        <span className="muted text-[11px]">📞 {order.mobile}</span>
                      </td>

                      <td className="p-3">
                        <span className="font-bold block text-ink">
                          {order.fulfillmentMethod === "PICKUP" ? "📍 Pickup" : "🚚 Delivery"}
                        </span>
                        <span className="muted text-[11px] block">{order.fulfillmentDate}</span>
                        {isDelivery && mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-blue-700 hover:underline inline-flex items-center gap-1 mt-0.5"
                          >
                            🗺️ Route Maps
                          </a>
                        )}
                      </td>

                      <td className="p-3">
                        <span className="font-bold text-ink block">{order.packageLabelFi}</span>
                        <span className="muted text-[11px] block font-mono">{(order.volumeMl / 1000).toFixed(1)} L</span>
                      </td>

                      <td className="p-3">
                        <span className={`font-bold block ${isPaid ? "text-emerald-700" : "text-amber-800"}`}>
                          {formatAdminMoney(order.finalTotalCents ?? order.itemSubtotalCents)}
                        </span>
                        <span className="muted text-[11px] block">{isPaid ? "🟢 Paid" : "🟡 Unpaid"}</span>
                      </td>

                      <td className="p-3">
                        <AdminStatusBadge status={order.status} />
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link className="btn btn-secondary text-xs py-1 px-2.5" href={`/admin/orders/${order.id}`}>
                            Inspect
                          </Link>

                          {canUpdate && !isClosed && (
                            <Link
                              className="btn btn-secondary text-xs py-1 px-2.5"
                              href={`/admin/orders/${order.id}/edit`}
                            >
                              Edit
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs muted italic">
                      No orders found matching your search or filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRINTABLE BATCH PACKING SLIP MODAL */}
      {showPackingSlip && (
        <BatchPackingSlip
          orders={rows}
          date={from || todayStr()}
          onClose={() => setShowPackingSlip(false)}
        />
      )}

      {/* TRANSITION CONFIRMATION MODAL */}
      {pending && (
        <div className="admin-dialog-backdrop">
          <div className="admin-dialog card max-w-md w-full p-5 flex flex-col gap-3">
            <h3 className="text-lg font-bold text-ink">Confirm Status Transition</h3>
            <p className="text-xs muted">
              Move {pending.orders.length} order(s) to <strong>{statusLabel(pending.target)}</strong>?
            </p>

            <label className="field">
              <span>Optional Audit Reason</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Packed in warehouse #2"
              />
            </label>

            <div className="profile-actions justify-end gap-2 mt-2">
              <button className="btn btn-secondary text-xs" type="button" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button className="btn text-xs font-bold" type="button" onClick={() => void confirmTransition()}>
                Confirm Transition
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
