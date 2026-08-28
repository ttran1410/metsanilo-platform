"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Filter, List, PackageCheck, Plus, Store } from "lucide-react";
import { AdminSearchField } from "./ui/admin-search-field";
import type { orders } from "@/db/schema";
import { getOrderTriageReasons, orderTriageScore } from "@/domain/order-triage";
import { getLegalOrderTransitions, type OrderStatus } from "@/domain/order-transitions";
import { AdminNotice, AdminPageHeader, AdminStatusBadge, formatAdminMoney } from "./presentation";
import { OrderInspector } from "./order-inspector";
import { PickupTerminal } from "./orders/pickup-terminal";
import { PackingKanban } from "./orders/packing-kanban";
import { BatchPackingSlip } from "./orders/batch-packing-slip";
import { AdminPagination } from "./ui/admin-pagination";
import { AdminRowActionMenu, IconCopy, IconEye, IconPencil, IconTrash } from "./ui/admin-row-action-menu";
import { parseOrdersUrlState, serializeOrdersUrlState, type ArchiveScope, type DatePreset, type EntryTypeFilter, type OrdersView, type WorkspaceMode } from "./orders-url-state";

export type AdminOrder = typeof orders.$inferSelect & {
  paidCents?: number;
  outstandingCents?: number | null;
  paymentStatus?: string;
  archived?: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
};

type SortField = "fulfillment" | "ref" | "customer" | "source" | "payment" | "status";
type PendingAction = { target: OrderStatus; orders: AdminOrder[] };
export type { OrdersView } from "./orders-url-state";

function formatOrderSourceBadge(order: AdminOrder) {
  const srcMap: Record<string, { label: string }> = {
    WEBSITE: { label: "Website" }, SMS: { label: "SMS" }, WHATSAPP: { label: "WhatsApp" },
    FACEBOOK_MESSAGE: { label: "Facebook" }, FACEBOOK: { label: "Facebook" },
    MANUAL: { label: "Phone" }, PHONE: { label: "Phone" }, HISTORICAL: { label: "Phone" },
  };

  const info = srcMap[order.orderSource?.toUpperCase() ?? "WEBSITE"] ?? {
    label: order.orderSource ?? "Website",
  };

  return (
    <div className="inline-flex items-center gap-1">
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-muted border border-line inline-flex items-center gap-1 text-ink">
        <span>{info.label}</span>
      </span>
      {order.historicalEntry && (
        <span
          className="text-xs cursor-help select-none"
          title="Imported from Historical CSV record"
        >
          Historical
        </span>
      )}
    </div>
  );
}

const QUICK_VIEWS: Array<{ key: OrdersView; label: string }> = [
  { key: "TODAY", label: "Today" },
  { key: "TRIAGE", label: "Needs attention" },
  { key: "NEEDS_CONFIRMATION", label: "New orders" },
  { key: "PICKUP_TODAY", label: "Pickup today" },
  { key: "DELIVERY_TODAY", label: "Delivery today" },
  { key: "UNPAID", label: "Unpaid" },
  { key: "ALL", label: "All orders" },
  { key: "ARCHIVED", label: "Archived" },
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

function getInitialPresetDatesForView(targetView: OrdersView): { from: string; to: string; datePreset: DatePreset } {
  const today = todayStr();
  if (targetView === "TODAY" || targetView === "PICKUP_TODAY" || targetView === "DELIVERY_TODAY") {
    return { from: today, to: today, datePreset: "TODAY" };
  }
  return { from: "", to: "", datePreset: "ALL" };
}

export function OrdersListing({
  initialOrders,
  initialLoadedAt,
  initialView = "TODAY",
  initialStatus = "ALL",
  canExport,
  canCreate,
  canTransition,
  canRecordPayment = false,
  canUpdate = false,
  canDelete = false,
  canArchive = false,
  loadInitialFromApi = false,
}: {
  initialOrders?: AdminOrder[];
  initialLoadedAt?: string;
  initialView?: OrdersView;
  initialStatus?: string;
  canExport: boolean;
  canCreate: boolean;
  canTransition: boolean;
  canRecordPayment?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  canArchive?: boolean;
  loadInitialFromApi?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDefaults = getInitialPresetDatesForView(initialView ?? "TODAY");
  const parsedUrlState = parseOrdersUrlState(searchParams, { view: initialView ?? "TODAY", status: initialStatus, from: initialDefaults.from, to: initialDefaults.to, preset: initialDefaults.datePreset });
  const resolvedView = parsedUrlState.view;

  const [rows, setRows] = useState<AdminOrder[]>(initialOrders ?? []);
  const [loading, setLoading] = useState(loadInitialFromApi);
  const [view, setView] = useState<OrdersView>(resolvedView);
  const [archiveScope, setArchiveScope] = useState<ArchiveScope>(resolvedView === "ARCHIVED" ? "ARCHIVED_ONLY" : "ACTIVE_ONLY");
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(parsedUrlState.mode);
  const [showPackingSlip, setShowPackingSlip] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [datePreset, setDatePreset] = useState<DatePreset>(parsedUrlState.preset);
  const [search, setSearch] = useState(parsedUrlState.query);
  const [from, setFrom] = useState(parsedUrlState.from);
  const [to, setTo] = useState(parsedUrlState.to);
  const [method, setMethod] = useState(parsedUrlState.method);
  const [status, setStatus] = useState(parsedUrlState.status);
  const [source, setSource] = useState(parsedUrlState.source);
  const [entryType, setEntryType] = useState<EntryTypeFilter>(parsedUrlState.entry);
  const [sources, setSources] = useState<Array<{ key: string; labelEn: string }>>([
    { key: "WEBSITE", labelEn: "Website" },
    { key: "SMS", labelEn: "SMS" },
    { key: "WHATSAPP", labelEn: "WhatsApp" },
    { key: "FACEBOOK_MESSAGE", labelEn: "Facebook Message" },
    { key: "MANUAL", labelEn: "Manual / Phone" },
  ]);

  const [sortField, setSortField] = useState<SortField>("fulfillment");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  function handleHeaderSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "ref" || field === "customer" ? "asc" : "desc");
    }
  }

  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ deletable: AdminOrder[]; skippedPaid: AdminOrder[] } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [reason, setReason] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [lastUpdated, setLastUpdated] = useState<string | null>(initialLoadedAt ?? null);
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const ordersRequestRef = useRef<AbortController | null>(null);
  const initialLoadCompleteRef = useRef(false);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [serverQuickViewCounts, setServerQuickViewCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    const next = serializeOrdersUrlState(searchParams, { view, mode: workspaceMode, query: search, from, to, preset: datePreset, method, status, source, entry: entryType });
    if (next.toString() !== searchParams.toString()) router.replace(`?${next.toString()}`, { scroll: false });
  }, [datePreset, entryType, from, method, router, search, searchParams, source, status, to, view, workspaceMode]);

  function getNextQuickAction(order: AdminOrder): { target: OrderStatus; label: string } | null {
    const preferred: Partial<Record<OrderStatus, OrderStatus>> = {
      NEW: "CONFIRMED", CONFIRMED: "PICKING", PICKING: "READY",
      READY: order.fulfillmentMethod === "PICKUP" ? "PICKED_UP" : "OUT_FOR_DELIVERY",
      OUT_FOR_DELIVERY: "DELIVERED",
    };
    const target = preferred[order.status as OrderStatus];
    if (!target) return null;
    const transition = getLegalOrderTransitions(order).find((item) => item.status === target && item.available);
    return transition ? { target: transition.status, label: transition.label } : null;
  }

  useEffect(() => {
    // Reset pagination after a filter changes; this state sync is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [search, from, to, method, status, source, entryType, view, archiveScope]);

  const refreshOrders = useCallback(async (announce = false) => {
    ordersRequestRef.current?.abort();
    const controller = new AbortController();
    setError("");
    ordersRequestRef.current = controller;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store", signal: controller.signal, headers: { "x-admin-request-scope": "orders-list" } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Order refresh failed");
      setRows(Array.isArray(body.data) ? body.data : body.data.items ?? []);
      setServerTotal(null);
      setServerQuickViewCounts(null);
      setLastUpdated(new Date().toISOString());
      if (announce) setNotice("Order queue synced.");
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => () => ordersRequestRef.current?.abort(), []);

  useEffect(() => {
    if (!loadInitialFromApi) return;
    const initial = window.setTimeout(async () => { await refreshOrders(); initialLoadCompleteRef.current = true; }, 0);
    return () => window.clearTimeout(initial);
  }, [loadInitialFromApi, refreshOrders]);

  useEffect(() => {
    if (!loadInitialFromApi || !initialLoadCompleteRef.current) return;
    const controller = new AbortController();
    ordersRequestRef.current?.abort();
    ordersRequestRef.current = controller;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({ q: search.trim(), page: String(page), pageSize: String(limit), includeCounts: "true" });
      if (view === "TRIAGE") params.set("triage", "true");
      if (view === "UNPAID") params.set("unpaid", "true");
      if (status !== "ALL") params.set("status", status === "FULFILLED" ? "PICKED_UP" : status === "READY_STAGE" ? "READY" : status);
      if (method !== "ALL") params.set("fulfillmentMethod", method);
      if (source !== "ALL") params.set("source", source === "MANUAL" ? "MANUAL" : source);
      if (entryType !== "ALL") params.set("historicalEntry", entryType === "HISTORICAL_ONLY" ? "true" : "false");
      if (archiveScope !== "ALL") params.set("archived", archiveScope === "ARCHIVED_ONLY" ? "true" : "false");
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      try {
        const response = await fetch(`/api/admin/orders?${params.toString()}`, { cache: "no-store", signal: controller.signal, headers: { "x-admin-request-scope": "orders-list" } });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? "Order query failed");
        setRows(body.data.items ?? []);
        setServerTotal(body.data.total ?? 0);
        setServerQuickViewCounts(body.data.quickViewCounts ?? null);
        setLastUpdated(new Date().toISOString());
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setError(error instanceof Error ? error.message : "Order query failed");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search.trim() ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [archiveScope, entryType, from, limit, loadInitialFromApi, method, page, search, source, status, to, view]);

  const selectQuickView = useCallback((targetView: OrdersView, customStatus?: string) => {
    setView(targetView);
    const today = todayStr();

    if (targetView === "ARCHIVED") {
      setArchiveScope("ARCHIVED_ONLY");
    } else {
      setArchiveScope("ACTIVE_ONLY");
    }

    if (targetView === "TODAY") {
      setDatePreset("TODAY");
      setFrom(today);
      setTo(today);
      setStatus(customStatus ?? "ALL");
      setMethod("ALL");
      setSource("ALL");
    } else if (targetView === "PICKUP_TODAY") {
      setDatePreset("TODAY");
      setFrom(today);
      setTo(today);
      setStatus(customStatus ?? "ALL");
      setMethod("PICKUP");
      setSource("ALL");
    } else if (targetView === "DELIVERY_TODAY") {
      setDatePreset("TODAY");
      setFrom(today);
      setTo(today);
      setStatus(customStatus ?? "ALL");
      setMethod("DELIVERY");
      setSource("ALL");
    } else if (targetView === "NEEDS_CONFIRMATION") {
      setDatePreset("ALL");
      setFrom("");
      setTo("");
      setStatus(customStatus ?? "NEW");
      setMethod("ALL");
      setSource("ALL");
    } else if (targetView === "TRIAGE" || targetView === "UNPAID" || targetView === "ALL" || targetView === "ARCHIVED") {
      setDatePreset("ALL");
      setFrom("");
      setTo("");
      setStatus(customStatus ?? "ALL");
      setMethod("ALL");
      setSource("ALL");
    }
  }, []);

  useEffect(() => {
    async function loadSources() {
      try {
        const response = await fetch("/api/admin/order-sources", { cache: "no-store" });
        const body = await response.json();
        if (response.ok && Array.isArray(body.data)) {
          setSources(
            (body.data as Array<{ key: string; labelEn: string }>).filter(
              (s) => s.key !== "HISTORICAL"
            )
          );
        }
      } catch {
        /* Ignore */
      }
    }
    void loadSources();
  }, []);

  function handleArchiveScopeChange(newScope: ArchiveScope) {
    setArchiveScope(newScope);
    if (newScope === "ARCHIVED_ONLY") {
      setView("ARCHIVED");
    } else if (newScope === "ACTIVE_ONLY") {
      if (view === "ARCHIVED") setView("ALL");
    } else if (newScope === "ALL") {
      if (view === "ARCHIVED") setView("ALL");
    }
  }

  // Filter change handlers automatically switch active tab to "ALL" (Custom Filtered View)
  function handleDatePresetChange(preset: DatePreset) {
    setDatePreset(preset);
    if (preset === "CUSTOM") {
      setShowAdvancedFilters(true);
      setView("ALL");
      return;
    }
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

  function handleEntryTypeChange(nextEntryType: EntryTypeFilter) {
    setEntryType(nextEntryType);
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

  function handleClearFilters() {
    setSearch("");
    setEntryType("ALL");
    setArchiveScope("ACTIVE_ONLY");
    selectQuickView("ALL");
  }

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (datePreset !== "ALL") count++;
    if (status !== "ALL") count++;
    if (method !== "ALL") count++;
    if (source !== "ALL") count++;
    if (entryType !== "ALL") count++;
    if (archiveScope !== "ACTIVE_ONLY") count++;
    if (search.trim()) count++;
    return count;
  }, [datePreset, status, method, source, entryType, archiveScope, search]);

  const computedQuickViewCounts = useMemo(() => {
    const day = todayStr();
    const activeRows = rows.filter((o) => !o.archived);
    return {
      TODAY: activeRows.filter((o) => o.fulfillmentDate === day).length,
      TRIAGE: activeRows.filter((o) => getOrderTriageReasons(o).length > 0).length,
      NEEDS_CONFIRMATION: activeRows.filter((o) => o.status === "NEW").length,
      PICKUP_TODAY: activeRows.filter((o) => o.fulfillmentDate === day && o.fulfillmentMethod === "PICKUP").length,
      DELIVERY_TODAY: activeRows.filter((o) => o.fulfillmentDate === day && o.fulfillmentMethod === "DELIVERY").length,
      UNPAID: activeRows.filter((o) => o.paymentStatus === "UNPAID").length,
      ALL: activeRows.length,
      ARCHIVED: rows.filter((o) => Boolean(o.archived)).length,
    };
  }, [rows]);
  const quickViewCounts = serverQuickViewCounts ?? computedQuickViewCounts;

  const matchesQuickView = useCallback((order: AdminOrder, selectedView: OrdersView, scope: ArchiveScope) => {
    const day = todayStr();

    if (scope === "ARCHIVED_ONLY" || selectedView === "ARCHIVED") {
      if (!order.archived) return false;
    } else if (scope === "ACTIVE_ONLY") {
      if (order.archived) return false;
    }

    return (
      selectedView === "ALL" ||
      selectedView === "ARCHIVED" ||
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
      const queryStr = search.trim().toLowerCase();
      const text = `${order.publicReference} ${order.customerName} ${order.mobile} ${order.email ?? ""}`.toLowerCase();
      const matchesSearch = !queryStr || text.includes(queryStr);
      const matchesDate =
        (!from || order.fulfillmentDate >= from) && (!to || order.fulfillmentDate <= to);
      const matchesMethod = method === "ALL" || order.fulfillmentMethod === method;
      const matchesStatus =
        status === "ALL"
          ? true
          : status === "FULFILLED"
          ? order.status === "PICKED_UP" || order.status === "DELIVERED"
          : status === "READY_STAGE"
          ? order.status === "READY" || order.status === "OUT_FOR_DELIVERY"
          : order.status === status;
      const matchesSource =
        source === "ALL"
          ? true
          : source === "FACEBOOK_MESSAGE" || source === "FACEBOOK"
          ? order.orderSource === "FACEBOOK_MESSAGE" || order.orderSource === "FACEBOOK"
          : source === "MANUAL" || source === "PHONE"
          ? order.orderSource === "MANUAL" || order.orderSource === "PHONE"
          : order.orderSource === source;

      const matchesEntryType =
        entryType === "ALL"
          ? true
          : entryType === "HISTORICAL_ONLY"
          ? Boolean(order.historicalEntry)
          : !order.historicalEntry;

      return (
        matchesSearch &&
        matchesDate &&
        matchesMethod &&
        matchesStatus &&
        matchesSource &&
        matchesEntryType &&
        matchesQuickView(order, view, archiveScope)
      );
    });
  }, [rows, search, from, to, method, status, source, entryType, view, archiveScope, matchesQuickView]);

  const sortedRows = useMemo(() => {
    if (view === "TRIAGE") {
      return [...filtered].sort((a, b) => orderTriageScore(b) - orderTriageScore(a));
    }
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "ref") {
        cmp = a.publicReference.localeCompare(b.publicReference);
      } else if (sortField === "customer") {
        cmp = a.customerName.localeCompare(b.customerName);
      } else if (sortField === "fulfillment") {
        cmp = (a.fulfillmentDate || "").localeCompare(b.fulfillmentDate || "");
      } else if (sortField === "source") {
        cmp = (a.orderSource || "").localeCompare(b.orderSource || "");
      } else if (sortField === "payment") {
        cmp = (a.paymentStatus || "").localeCompare(b.paymentStatus || "");
      } else if (sortField === "status") {
        cmp = a.status.localeCompare(b.status);
      }
      if (cmp === 0) {
        cmp = b.createdAt.localeCompare(a.createdAt);
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, view, sortField, sortDirection]);

  const visibleRows = useMemo(() => {
    const start = (page - 1) * limit;
    return serverTotal !== null ? sortedRows : sortedRows.slice(start, start + limit);
  }, [serverTotal, sortedRows, page, limit]);

  const selectedOrders = useMemo(() => {
    return rows.filter((order) => selected.includes(order.id));
  }, [rows, selected]);
  const commonBatchTransitions = useMemo(() => {
    const operationalStatuses: OrderStatus[] = ["CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED"];
    if (!selectedOrders.length) return [];
    return operationalStatuses.filter((target) => selectedOrders.every((order) =>
      getLegalOrderTransitions(order).some((transition) => transition.status === target && transition.available)
    ));
  }, [selectedOrders]);
  const inspectingOrder = rows.find((order) => order.id === inspectingId) ?? null;

  const allSelected = visibleRows.length > 0 && visibleRows.every((order) => selected.includes(order.id));

  async function confirmTransition() {
    if (!pending) return;
    setError("");
    setNotice("");

    try {
      for (const order of pending.orders) {
        const response = await fetch(`/api/admin/orders/${order.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "transition",
            status: pending.target,
            expectedVersion: order.version,
            reason: reason.trim() || undefined,
          }),
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

  async function handleConfirmDeleteBatch() {
    if (!pendingDelete || pendingDelete.deletable.length === 0) return;
    setDeleting(true);
    setError("");
    setNotice("");

    try {
      const ids = pendingDelete.deletable.map((o) => o.id);
      const response = await fetch("/api/admin/orders/batch-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      const body = await response.json();
      setDeleting(false);

      if (!response.ok) {
        throw new Error(body.message ?? "Batch delete failed.");
      }

      setNotice(
        `Permanently deleted ${body.data.deletedCount} order(s).` +
          (body.data.skippedPaidCount > 0 ? ` (${body.data.skippedPaidCount} paid order(s) were protected from deletion)` : "")
      );
      setSelected([]);
      setPendingDelete(null);
      await refreshOrders();
    } catch (err) {
      setDeleting(false);
      setError(err instanceof Error ? err.message : "Batch delete failed.");
    }
  }

  async function handleBatchArchive(action: "archive" | "unarchive") {
    if (selected.length === 0) return;
    setArchiving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/orders/batch-archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: selected, action }),
      });

      const body = await response.json();
      setArchiving(false);

      if (!response.ok) {
        throw new Error(body.message ?? "Batch archive operation failed.");
      }

      if (action === "archive") {
        setNotice(
          `Archived ${body.data.processedCount} order(s).` +
            (body.data.skippedActiveCount > 0
              ? ` (${body.data.skippedActiveCount} active in-flight order(s) could not be archived)`
              : "")
        );
      } else {
        setNotice(`Restored ${body.data.processedCount} order(s) from archive.`);
      }

      setSelected([]);
      await refreshOrders();
    } catch (err) {
      setArchiving(false);
      setError(err instanceof Error ? err.message : "Batch archive operation failed.");
    }
  }

  return (
    <section className="admin-orders-workspace shell pb-10 flex flex-col gap-3">
      {/* HEADER & SUB-VIEW WORKSPACE MODE SWITCHER */}
      <div className="admin-orders-header flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <AdminPageHeader
          eyebrow="Operations"
          title="Orders and fulfillment"
          description={lastUpdated ? `Last synced ${new Date(lastUpdated).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" })}` : undefined}
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* 3 SUB-VIEW SWITCHER PINS */}
          <div className="orders-mode-switch" role="tablist" aria-label="Order workspace">
            <button
              type="button"
              role="tab" aria-selected={workspaceMode === "TABLE"} className={workspaceMode === "TABLE" ? "is-active" : ""}
              onClick={() => setWorkspaceMode("TABLE")}
            >
              <List aria-hidden="true" />Queue
            </button>

            <button
              type="button"
              role="tab" aria-selected={workspaceMode === "KANBAN"} className={workspaceMode === "KANBAN" ? "is-active" : ""}
              onClick={() => setWorkspaceMode("KANBAN")}
            >
              <PackageCheck aria-hidden="true" />Packing
            </button>

            <button
              type="button"
              role="tab" aria-selected={workspaceMode === "TERMINAL"} className={workspaceMode === "TERMINAL" ? "is-active" : ""}
              onClick={() => setWorkspaceMode("TERMINAL")}
            >
              <Store aria-hidden="true" />Pickup
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary text-xs py-1.5 px-3 font-semibold"
            onClick={() => setShowPackingSlip(true)}
          >
            <Download aria-hidden="true" />Packing slip
          </button>

          {canCreate && (
            <Link className="btn text-xs py-1.5 px-3 font-bold" href="/admin/manual-orders">
              <Plus aria-hidden="true" />New order
            </Link>
          )}
        </div>
      </div>

      {notice && <AdminNotice tone="success" live>{notice}</AdminNotice>}
      {error && <AdminNotice tone="error" live><span>{error}</span> <button type="button" className="btn btn-secondary text-xs ml-2" onClick={() => void refreshOrders(true)} disabled={loading}>Retry</button></AdminNotice>}
      {loading && <AdminNotice tone="neutral" live>Loading orders…</AdminNotice>}

      {/* RENDER SELECTED WORKSPACE SUB-VIEW */}
      {workspaceMode === "KANBAN" && (
        <PackingKanban orders={rows.filter((o) => !o.archived)} canTransition={canTransition} onRefresh={() => void refreshOrders()} />
      )}

      {workspaceMode === "TERMINAL" && (
        <PickupTerminal orders={rows.filter((o) => !o.archived)} canTransition={canTransition} canRecordPayment={canRecordPayment} onRefresh={() => void refreshOrders()} />
      )}

      {workspaceMode === "TABLE" && (
        <div className="flex flex-col gap-3">
          {/* QUICK VIEW CHIPS WITH PROMINENT ACTIVE HIGHLIGHT & NO BORDER OVERLAP */}
          <label className="orders-mobile-quick-view"><span>Queue view</span><select value={view} onChange={(event) => selectQuickView(event.target.value as OrdersView)}>{QUICK_VIEWS.map((item) => <option key={item.key} value={item.key}>{item.label} ({quickViewCounts[item.key] ?? 0})</option>)}</select></label>
          <div className="orders-quick-views">
            {QUICK_VIEWS.map((chip) => {
              const isSelected = view === chip.key;
              const count = quickViewCounts[chip.key] ?? 0;

              return (
                <button
                  key={chip.key}
                  type="button"
                  className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border-2 ${
                    isSelected
                      ? "bg-primary text-on-primary border-primary font-extrabold shadow-md"
                      : "bg-surface-muted text-ink/70 hover:bg-surface-muted/80 hover:text-ink border-transparent"
                  }`}
                  onClick={() => selectQuickView(chip.key)}
                >
                  <span>{chip.label}</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isSelected
                        ? "bg-surface text-primary"
                        : chip.key === "TRIAGE" && count > 0
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : "bg-surface/60 text-ink/80 border border-line"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* PRIMARY FILTER BAR WITH DATE PRESETS & ADVANCED FILTERS TOGGLE */}
          <div className="card orders-filter-bar">
            <AdminSearchField wrapperClassName="orders-search"
              placeholder="Search reference, customer name, or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[220px] text-xs py-1.5 px-3 rounded-lg border border-line bg-surface"
            />

            {/* DATE PRESETS DROPDOWN */}
            <label className="text-xs font-bold text-ink flex items-center gap-1.5 bg-surface-muted px-2.5 py-1.5 rounded-lg border border-line">
              <span>Date</span>
              <select
                value={datePreset}
                onChange={(e) => handleDatePresetChange(e.target.value as DatePreset)}
                className="bg-surface border border-line rounded px-2 py-0.5 text-xs font-bold"
              >
                <option value="TODAY">Today</option>
                <option value="TOMORROW">Tomorrow</option>
                <option value="YESTERDAY">Yesterday</option>
                <option value="THIS_WEEK">This Week</option>
                <option value="LAST_WEEK">Last Week</option>
                <option value="LAST_7_DAYS">Last 7 Days</option>
                <option value="ALL">All Time</option>
                <option value="CUSTOM">Custom Range…</option>
              </select>
            </label>

            {/* ADVANCED FILTERS TOGGLE BUTTON */}
            <button
              type="button"
              className={`btn text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold ${
                showAdvancedFilters || activeFilterCount > 0
                  ? "btn-primary shadow-xs"
                  : "btn-secondary"
              }`}
              onClick={() => setShowAdvancedFilters((open) => !open)}
            >
              <Filter aria-hidden="true" />Filters
              {activeFilterCount > 0 && (
                <span className="text-[10px] bg-surface text-primary px-1.5 py-0.2 rounded-full font-mono">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {canExport && (
              <a className="btn btn-secondary text-xs py-1.5 px-3" href="/api/admin/orders/export" download>
                <Download aria-hidden="true" />Export CSV
              </a>
            )}
          </div>

          {/* EXPANDABLE ADVANCED FILTERS PANEL */}
          {showAdvancedFilters && (
            <div className="card p-4 bg-surface-muted/60 border border-line rounded-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="eyebrow text-primary">CUSTOM ADVANCED FILTERS</span>
                <button
                  type="button"
                  className="text-xs font-bold text-primary hover:underline"
                  onClick={handleClearFilters}
                >
                  ↺ Reset All Filters
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* Date Range Inputs: Hidden when ALL, Read-Only when Fixed Preset, Editable when CUSTOM */}
                {datePreset === "ALL" ? (
                  <div className="col-span-1 sm:col-span-2 p-2.5 rounded-xl bg-surface-muted border border-line flex items-center justify-between text-xs text-ink/70">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span>📅</span> Date Range: <strong className="text-ink">All Time</strong> (No date boundaries)
                    </span>
                    <button
                      type="button"
                      className="text-primary font-bold hover:underline cursor-pointer"
                      onClick={() => handleDatePresetChange("CUSTOM")}
                    >
                      Set Custom Range…
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="field">
                      <span className="flex items-center justify-between">
                        <span>From Date</span>
                        {datePreset !== "CUSTOM" && (
                          <span className="text-[10px] font-semibold text-ink/50">(Read-Only)</span>
                        )}
                      </span>
                      <input
                        type="date"
                        value={from}
                        readOnly={datePreset !== "CUSTOM"}
                        onChange={(e) => handleFromChange(e.target.value)}
                        onClick={(e) => {
                          if (datePreset === "CUSTOM") e.currentTarget.showPicker?.();
                        }}
                        className={datePreset !== "CUSTOM" ? "bg-surface-muted cursor-not-allowed opacity-80" : ""}
                      />
                    </label>

                    <label className="field">
                      <span className="flex items-center justify-between">
                        <span>To Date</span>
                        {datePreset !== "CUSTOM" && (
                          <span className="text-[10px] font-semibold text-ink/50">(Read-Only)</span>
                        )}
                      </span>
                      <input
                        type="date"
                        value={to}
                        readOnly={datePreset !== "CUSTOM"}
                        onChange={(e) => handleToChange(e.target.value)}
                        onClick={(e) => {
                          if (datePreset === "CUSTOM") e.currentTarget.showPicker?.();
                        }}
                        className={datePreset !== "CUSTOM" ? "bg-surface-muted cursor-not-allowed opacity-80" : ""}
                      />
                    </label>
                  </>
                )}

                {/* Status Dropdown */}
                <label className="field">
                  <span>Status Filter</span>
                  <select value={status} onChange={(e) => handleStatusChange(e.target.value)}>
                    <option value="ALL">All Statuses</option>
                    <option value="NEW">NEW</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="PICKING">PICKING</option>
                    <option value="READY">READY</option>
                    <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                    <option value="READY_STAGE">READY &amp; OUT_FOR_DELIVERY</option>
                    <option value="PICKED_UP">PICKED_UP</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="FULFILLED">FULFILLED (Picked up &amp; Delivered)</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="NO_SHOW">NO_SHOW</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </label>

                {/* Fulfillment Method Dropdown */}
                <label className="field">
                  <span>Method Filter</span>
                  <select value={method} onChange={(e) => handleMethodChange(e.target.value)}>
                    <option value="ALL">All Methods</option>
                    <option value="PICKUP">Pickup</option>
                    <option value="DELIVERY">Delivery</option>
                  </select>
                </label>

                {/* Order Source Dropdown */}
                <label className="field">
                  <span>Order Source Filter</span>
                  <select value={source} onChange={(e) => handleSourceChange(e.target.value)}>
                    <option value="ALL">All Channels</option>
                    {sources.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.labelEn}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Entry Type Dropdown */}
                <label className="field">
                  <span>Entry Type Filter</span>
                  <select value={entryType} onChange={(e) => handleEntryTypeChange(e.target.value as EntryTypeFilter)}>
                    <option value="ALL">All Entries (Live &amp; Historical)</option>
                    <option value="LIVE_ONLY">Live orders only</option>
                    <option value="HISTORICAL_ONLY">Historical entries only</option>
                  </select>
                </label>

                {/* Archive Scope Filter Dropdown */}
                <label className="field">
                  <span>Archive Scope Filter</span>
                  <select
                    value={archiveScope}
                    onChange={(e) => handleArchiveScopeChange(e.target.value as ArchiveScope)}
                  >
                    <option value="ACTIVE_ONLY">Active orders only</option>
                    <option value="ARCHIVED_ONLY">Archived orders only</option>
                    <option value="ALL">All orders including archived</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* TABLE DATA DISPLAY */}
          <div className="card admin-orders-table-wrap overflow-x-auto border border-line rounded-2xl">
            <table className="admin-orders-table w-full text-left text-xs">
              <thead className="bg-surface-muted border-b border-line text-muted uppercase font-bold text-[11px] tracking-wider">
                <tr>
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => setSelected(e.target.checked ? visibleRows.map((r) => r.id) : [])}
                    />
                  </th>
                  {([
                    { key: "ref", label: "Order Ref" },
                    { key: "customer", label: "Customer" },
                    { key: "fulfillment", label: "Fulfillment" },
                    { key: "source", label: "Source" },
                  ] satisfies Array<{ key: SortField; label: string }>).map((col) => (
                    <th
                      key={col.key}
                      className="p-3 cursor-pointer select-none hover:bg-slate-200/60 transition-colors"
                      onClick={() => handleHeaderSort(col.key)}
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>{col.label}</span>
                        <span className={`text-[10px] font-bold ${sortField === col.key ? "text-primary opacity-100" : "text-slate-400 opacity-40"}`}>
                          {sortField === col.key ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="p-3">Items &amp; Vol</th>
                  {([
                    { key: "payment", label: "Payment" },
                    { key: "status", label: "Status" },
                  ] satisfies Array<{ key: SortField; label: string }>).map((col) => (
                    <th
                      key={col.key}
                      className="p-3 cursor-pointer select-none hover:bg-slate-200/60 transition-colors"
                      onClick={() => handleHeaderSort(col.key)}
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>{col.label}</span>
                        <span className={`text-[10px] font-bold ${sortField === col.key ? "text-primary opacity-100" : "text-slate-400 opacity-40"}`}>
                          {sortField === col.key ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibleRows.map((order) => {
                  const isPaid = (order.outstandingCents ?? 0) <= 0;
                  const isDelivery = order.fulfillmentMethod === "DELIVERY";
                  const mapsUrl = isDelivery
                    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        (order.streetAddress ? `${order.streetAddress}, ` : "") + (order.city || "Pori") + ", Finland"
                      )}`
                    : null;

                  return (
                    <tr key={order.id} className="hover:bg-surface-muted/40 transition-colors">
                      <td data-label="Select" className="p-3">
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

                      <td data-label="Order" className="p-3 font-bold">
                        <div className="inline-flex items-center gap-1.5">
                          <Link className="text-primary hover:underline font-mono" href={`/admin/orders/${order.id}`}>
                            {order.publicReference}
                          </Link>
                          <button
                            type="button"
                            title="Copy Order Reference"
                            className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              void navigator.clipboard.writeText(order.publicReference);
                              setNotice(`Copied ${order.publicReference} to clipboard.`);
                            }}
                          >
                            <IconCopy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="muted block text-[11px] font-normal">{order.createdAt.slice(0, 10)}</span>
                      </td>

                      <td data-label="Customer" className="p-3">
                        {order.customerId ? (
                          <Link
                            className="text-primary hover:underline font-bold block w-fit"
                            href={`/admin/customers/${order.customerId}`}
                            title="View customer detail"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {order.customerName}
                          </Link>
                        ) : (
                          <strong className="text-ink block font-bold">{order.customerName}</strong>
                        )}
                        <div className="inline-flex items-center gap-1">
                          <span className="muted text-[11px]">{order.mobile}</span>
                          {order.mobile && (
                            <button
                              type="button"
                              title="Copy Customer Mobile Phone"
                              className="p-0.5 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (order.mobile) {
                                  void navigator.clipboard.writeText(order.mobile);
                                  setNotice(`Copied ${order.mobile} to clipboard.`);
                                }
                              }}
                            >
                              <IconCopy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      <td data-label="Fulfillment" className="p-3">
                        <span className="font-bold block text-ink">
                          {order.fulfillmentMethod === "PICKUP" ? "Pickup" : "Delivery"}
                        </span>
                        <span className="muted text-[11px] block">{order.fulfillmentDate}</span>
                        {isDelivery && mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-blue-700 hover:underline inline-flex items-center gap-1 mt-0.5"
                          >
                            Open route
                          </a>
                        )}
                      </td>

                      <td data-label="Source" className="p-3">
                        {formatOrderSourceBadge(order)}
                      </td>

                      <td data-label="Order" className="p-3">
                        <span className="font-bold text-ink block">{order.packageLabelFi}</span>
                        <span className="muted text-[11px] block font-mono">{(order.volumeMl / 1000).toFixed(1)} L</span>
                      </td>

                      <td data-label="Payment" className="p-3">
                        <span className={`font-bold block ${isPaid ? "text-emerald-700" : "text-amber-800"}`}>
                          {formatAdminMoney(order.finalTotalCents ?? order.itemSubtotalCents)}
                        </span>
                        <span className="muted text-[11px] block">{isPaid ? "Paid" : "Unpaid"}</span>
                      </td>

                      <td data-label="Status" className="p-3">
                        <div className="flex flex-col items-start gap-1">
                          <AdminStatusBadge status={order.status} />
                          {order.archived && (
                            <span className="text-[10px] font-bold text-purple-900 bg-purple-100 px-1.5 py-0.2 rounded border border-purple-300">
                              Archived
                            </span>
                          )}
                        </div>
                      </td>

                      <td data-label="Actions" className="p-3 text-right">
                        <AdminRowActionMenu
                          items={[
                            {
                              id: "view-details",
                              label: "View Details",
                              icon: <IconEye />,
                              onClick: () => setInspectingId(order.id),
                            },
                            ...(canUpdate
                              ? [
                                  {
                                    id: "edit-order",
                                    label: "Edit Order",
                                    icon: <IconPencil />,
                                    onClick: () => router.push(`/admin/orders/${order.id}/edit`),
                                  },
                                ]
                              : []),
                            ...(canTransition && getNextQuickAction(order)
                              ? [
                                  {
                                    id: "quick-transition",
                                    label: getNextQuickAction(order)!.label,
                                    icon: <span className="text-emerald-600 font-bold">→</span>,
                                    onClick: () => {
                                      const quick = getNextQuickAction(order)!;
                                      setPending({ target: quick.target, orders: [order] });
                                    },
                                  },
                                ]
                              : []),
                            {
                              id: "delete-order",
                              label: "Delete Order",
                              icon: <IconTrash />,
                              danger: true,
                              disabled: !canDelete,
                              onClick: () => {
                                setSelected([order.id]);
                                const isPaidOrder = (order.outstandingCents ?? 0) <= 0 || order.paymentStatus === "PAID" || (order.paidCents ?? 0) > 0;
                                setPendingDelete({
                                  deletable: isPaidOrder ? [] : [order],
                                  skippedPaid: isPaidOrder ? [order] : [],
                                });
                              },
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}

                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-xs muted italic">
                      {view === "ARCHIVED" || archiveScope === "ARCHIVED_ONLY"
                        ? "No archived orders found."
                        : "No orders found matching your search or filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <AdminPagination
            page={page}
            limit={limit}
            total={serverTotal ?? sortedRows.length}
            onPageChange={setPage}
            onLimitChange={(newLimit) => setLimit(newLimit)}
            itemLabel="orders"
          />
        </div>
      )}

      {inspectingOrder && <OrderInspector
        order={inspectingOrder}
        canTransition={canTransition}
        canUpdate={canUpdate}
        onClose={() => setInspectingId(null)}
        onPrevious={visibleRows.findIndex((order) => order.id === inspectingOrder.id) > 0 ? () => {
          const index = visibleRows.findIndex((order) => order.id === inspectingOrder.id);
          setInspectingId(visibleRows[index - 1]?.id ?? inspectingOrder.id);
        } : undefined}
        onNext={visibleRows.findIndex((order) => order.id === inspectingOrder.id) < visibleRows.length - 1 ? () => {
          const index = visibleRows.findIndex((order) => order.id === inspectingOrder.id);
          setInspectingId(visibleRows[index + 1]?.id ?? inspectingOrder.id);
        } : undefined}
        onOrderUpdated={(updated) => setRows((current) => current.map((order) => order.id === updated.id ? { ...order, ...updated } : order))}
      />}

      {/* STICKY FLOATING BULK SELECTION TOOLBAR */}
      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-forest text-on-primary p-3.5 px-5 rounded-2xl shadow-2xl border border-emerald-700/50 flex flex-wrap items-center gap-3 text-xs animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2 font-bold pr-2 border-r border-emerald-700/60">
            <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-mono text-xs">
              {selected.length}
            </span>
            <span>order(s) selected</span>
          </div>

          {canTransition && view !== "ARCHIVED" && commonBatchTransitions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {commonBatchTransitions.map((target) => (
                <button
                  key={target}
                  type="button"
                  className="btn btn-secondary text-xs py-1.5 px-3 font-bold bg-emerald-800 text-white border-emerald-600 hover:bg-emerald-700"
                  onClick={() => setPending({ target, orders: selectedOrders })}
                >
                  {statusLabel(target)} ({selected.length})
                </button>
              ))}
            </div>
          )}

          {/* BATCH ARCHIVE / UNARCHIVE BUTTON */}
          {view === "ARCHIVED" || archiveScope === "ARCHIVED_ONLY" ? (
            <button
              type="button"
              className="btn btn-secondary text-xs py-1.5 px-3 font-bold bg-purple-900 text-purple-100 border-purple-700 hover:bg-purple-800"
              onClick={() => void handleBatchArchive("unarchive")}
              disabled={archiving}
            >
              {archiving ? "Restoring…" : `↺ Un-archive (${selected.length})`}
            </button>
          ) : canArchive ? (
            <button
              type="button"
              className="btn btn-secondary text-xs py-1.5 px-3 font-bold bg-purple-900 text-purple-100 border-purple-700 hover:bg-purple-800"
              onClick={() => void handleBatchArchive("archive")}
              disabled={archiving}
            >
              {archiving ? "Archiving…" : `Archive (${selected.length})`}
            </button>
          ) : null}

          {canExport && (
            <button
              type="button"
              className="btn btn-secondary text-xs py-1.5 px-3 font-semibold bg-emerald-900/60 text-emerald-100 border-emerald-700 hover:bg-emerald-800"
              onClick={() => {
                const ids = selected.join(",");
                window.open(`/api/admin/orders/export?ids=${encodeURIComponent(ids)}`, "_blank");
              }}
            >
              Export selected CSV
            </button>
          )}

          <button
            type="button"
            className="text-emerald-300 hover:text-white font-bold ml-2 text-xs"
            onClick={() => setSelected([])}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* DELETE ORDER SAFE-GUARD MODAL */}
      {pendingDelete && (
        <div className="admin-dialog-backdrop">
          <div className="admin-dialog card max-w-lg w-full p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-danger border-b border-line pb-2">
              <span className="text-xl">⚠️</span>
              <h3 className="text-lg font-bold text-ink">Permanently Delete Orders</h3>
            </div>

            {pendingDelete.skippedPaid.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex flex-col gap-1 font-medium">
                <strong className="font-bold flex items-center gap-1 text-amber-950">
                  🔒 {pendingDelete.skippedPaid.length} Paid Order(s) Protected from Deletion
                </strong>
                <span>
                  Paid orders cannot be deleted to preserve financial audit compliance ({pendingDelete.skippedPaid.map((o) => o.publicReference).join(", ")}). Please refund or cancel these orders instead.
                </span>
              </div>
            )}

            {pendingDelete.deletable.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-ink leading-relaxed">
                  Are you sure you want to <strong>permanently delete</strong> the following <strong>{pendingDelete.deletable.length} unpaid order(s)</strong>? This action cannot be undone, will release reserved harvest capacity, and recalculate customer statistics.
                </p>

                <div className="max-h-40 overflow-y-auto bg-surface-muted p-2.5 rounded-xl border border-line flex flex-col gap-1 text-xs font-mono">
                  {pendingDelete.deletable.map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-ink">
                      <span>{o.publicReference} · {o.customerName}</span>
                      <span className="text-muted">{(o.volumeMl / 1000).toFixed(1)} L</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink/70 italic">
                No unpaid orders selected for deletion. All selected orders are paid and protected.
              </p>
            )}

            <div className="profile-actions justify-end gap-2 border-t border-line pt-3">
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>

              {pendingDelete.deletable.length > 0 && (
                <button
                  type="button"
                  className="btn text-xs font-bold bg-danger text-white py-1.5 px-4 shadow-md"
                  onClick={() => void handleConfirmDeleteBatch()}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : `🗑️ Yes, Delete ${pendingDelete.deletable.length} Order(s)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE BATCH PACKING SLIP MODAL */}
      {showPackingSlip && (
        <BatchPackingSlip
          orders={rows.filter((o) => !o.archived)}
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
