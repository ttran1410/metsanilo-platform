"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { orders } from "@/db/schema";
import type { Role } from "@/lib/permissions";
import { getOrderTriageReasons, orderTriageScore } from "@/domain/order-triage";
import { getLegalOrderTransitions, type OrderStatus } from "@/domain/order-transitions";
import { AdminEmptyState, AdminNotice, AdminPageHeader, AdminStatusBadge, formatAdminMoney } from "./presentation";
import { OrderInspector } from "./order-inspector";
import { PickupTerminal } from "./orders/pickup-terminal";
import { PackingKanban } from "./orders/packing-kanban";
import { BatchPackingSlip } from "./orders/batch-packing-slip";
import { AdminPagination } from "./ui/admin-pagination";
import { AdminRowActionMenu, IconCopy, IconEye, IconPencil, IconTrash } from "./ui/admin-row-action-menu";

export type AdminOrder = typeof orders.$inferSelect & {
  paidCents?: number;
  outstandingCents?: number | null;
  paymentStatus?: string;
  archived?: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
};

export type OrdersView =
  | "TRIAGE"
  | "ALL"
  | "TODAY"
  | "NEEDS_CONFIRMATION"
  | "PICKUP_TODAY"
  | "DELIVERY_TODAY"
  | "UNPAID"
  | "ARCHIVED";

type WorkspaceMode = "TABLE" | "KANBAN" | "TERMINAL";
type DatePreset = "TODAY" | "TOMORROW" | "YESTERDAY" | "THIS_WEEK" | "LAST_WEEK" | "LAST_7_DAYS" | "ALL" | "CUSTOM";
type Column = "fulfillment" | "source" | "status" | "payment" | "updated";
type SortField = "fulfillment" | "ref" | "customer" | "source" | "payment" | "status";
type PendingAction = { target: OrderStatus; orders: AdminOrder[] };
type ArchiveScope = "ACTIVE_ONLY" | "ARCHIVED_ONLY" | "ALL";
type EntryTypeFilter = "ALL" | "LIVE_ONLY" | "HISTORICAL_ONLY";

function formatOrderSourceBadge(order: AdminOrder) {
  const srcMap: Record<string, { label: string; icon: string }> = {
    WEBSITE: { label: "Website", icon: "🌐" },
    SMS: { label: "SMS", icon: "✉️" },
    WHATSAPP: { label: "WhatsApp", icon: "💬" },
    FACEBOOK_MESSAGE: { label: "Facebook", icon: "📘" },
    FACEBOOK: { label: "Facebook", icon: "📘" },
    MANUAL: { label: "Phone", icon: "📞" },
    PHONE: { label: "Phone", icon: "📞" },
    HISTORICAL: { label: "Phone", icon: "📞" },
  };

  const info = srcMap[order.orderSource?.toUpperCase() ?? "WEBSITE"] ?? {
    label: order.orderSource ?? "Website",
    icon: "📋",
  };

  return (
    <div className="inline-flex items-center gap-1">
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-muted border border-line inline-flex items-center gap-1 text-ink">
        <span>{info.icon}</span>
        <span>{info.label}</span>
      </span>
      {order.historicalEntry && (
        <span
          className="text-xs cursor-help select-none"
          title="Imported from Historical CSV record"
        >
          📜
        </span>
      )}
    </div>
  );
}

const QUICK_VIEWS: Array<{ key: OrdersView; label: string }> = [
  { key: "TODAY", label: "Today" },
  { key: "TRIAGE", label: "Action required" },
  { key: "NEEDS_CONFIRMATION", label: "Needs confirmation" },
  { key: "PICKUP_TODAY", label: "Pickup today" },
  { key: "DELIVERY_TODAY", label: "Delivery today" },
  { key: "UNPAID", label: "Unpaid" },
  { key: "ALL", label: "All orders" },
  { key: "ARCHIVED", label: "📦 Archived" },
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

function getInitialPresetDatesForView(targetView: OrdersView): { from: string; to: string; datePreset: DatePreset } {
  const today = todayStr();
  if (targetView === "TODAY" || targetView === "PICKUP_TODAY" || targetView === "DELIVERY_TODAY") {
    return { from: today, to: today, datePreset: "TODAY" };
  }
  return { from: "", to: "", datePreset: "ALL" };
}

export function OrdersListing({
  actorRole = "MANAGER",
  initialOrders,
  initialView = "TODAY",
  initialStatus = "ALL",
  canExport,
  canCreate,
  canTransition,
  canUpdate = false,
  canDelete = false,
  canArchive = false,
}: {
  actorRole?: Role;
  initialOrders: AdminOrder[];
  initialView?: OrdersView;
  initialStatus?: string;
  canExport: boolean;
  canCreate: boolean;
  canTransition: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  canArchive?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlView = searchParams.get("view");
  const resolvedView = QUICK_VIEWS.some((item) => item.key === urlView) ? urlView as OrdersView : initialView;
  const initialDates = getInitialPresetDatesForView(resolvedView);

  const [rows, setRows] = useState(initialOrders);
  const [view, setView] = useState<OrdersView>(resolvedView);
  const [archiveScope, setArchiveScope] = useState<ArchiveScope>(resolvedView === "ARCHIVED" ? "ARCHIVED_ONLY" : "ACTIVE_ONLY");
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() => searchParams.get("mode") === "KANBAN" || searchParams.get("mode") === "TERMINAL" ? searchParams.get("mode") as WorkspaceMode : "TABLE");
  const [showPackingSlip, setShowPackingSlip] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [datePreset, setDatePreset] = useState<DatePreset>(() => searchParams.get("preset") as DatePreset || initialDates.datePreset);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [from, setFrom] = useState(() => searchParams.get("from") ?? initialDates.from);
  const [to, setTo] = useState(() => searchParams.get("to") ?? initialDates.to);
  const [method, setMethod] = useState(() => searchParams.get("method") ?? "ALL");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? initialStatus);
  const [source, setSource] = useState(() => searchParams.get("source") ?? "ALL");
  const [entryType, setEntryType] = useState<EntryTypeFilter>(() => searchParams.get("entry") as EntryTypeFilter || "ALL");
  const [sources, setSources] = useState<Array<{ key: string; labelEn: string }>>([
    { key: "WEBSITE", labelEn: "🌐 Website" },
    { key: "SMS", labelEn: "✉️ SMS" },
    { key: "WHATSAPP", labelEn: "💬 WhatsApp" },
    { key: "FACEBOOK_MESSAGE", labelEn: "📘 Facebook Message" },
    { key: "MANUAL", labelEn: "📞 Manual / Phone" },
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
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", view);
    next.set("mode", workspaceMode);
    if (search) next.set("q", search); else next.delete("q");
    if (from) next.set("from", from); else next.delete("from");
    if (to) next.set("to", to); else next.delete("to");
    if (datePreset !== "ALL") next.set("preset", datePreset); else next.delete("preset");
    if (method !== "ALL") next.set("method", method); else next.delete("method");
    if (status !== "ALL") next.set("status", status); else next.delete("status");
    if (source !== "ALL") next.set("source", source); else next.delete("source");
    if (entryType !== "ALL") next.set("entry", entryType); else next.delete("entry");
    if (next.toString() !== searchParams.toString()) router.replace(`?${next.toString()}`, { scroll: false });
  }, [datePreset, entryType, from, method, router, search, searchParams, source, status, to, view, workspaceMode]);

  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest(".row-action-menu")) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("click", handleDocClick);
    return () => document.removeEventListener("click", handleDocClick);
  }, []);

  function getNextQuickAction(order: AdminOrder): { target: OrderStatus; label: string; icon: string } | null {
    if (["PICKED_UP", "DELIVERED", "CANCELLED", "REJECTED", "NO_SHOW"].includes(order.status)) {
      return null;
    }
    switch (order.status) {
      case "NEW":
        return { target: "CONFIRMED", label: "✓ Confirm Order", icon: "✓" };
      case "CONFIRMED":
        return { target: "PICKING", label: "📦 Start Picking", icon: "📦" };
      case "PICKING":
        return { target: "READY", label: "🟢 Mark Ready", icon: "🟢" };
      case "READY":
        return order.fulfillmentMethod === "PICKUP"
          ? { target: "PICKED_UP", label: "🤝 Confirm Pickup", icon: "🤝" }
          : { target: "OUT_FOR_DELIVERY", label: "🚚 Out for Delivery", icon: "🚚" };
      case "OUT_FOR_DELIVERY":
        return { target: "DELIVERED", label: "🏁 Mark Delivered", icon: "🏁" };
      default:
        return null;
    }
  }

  useEffect(() => {
    // Reset pagination after a filter changes; this state sync is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [search, from, to, method, status, source, entryType, view, archiveScope]);

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

  // Sync state whenever initialView or initialStatus prop changes from URL navigation.
  // Ignore echoes of this component's own router.replace writes, which would otherwise
  // reset user-chosen filters right after applying them (e.g. a date preset change).
  useEffect(() => {
    if (!initialView && !(initialStatus && initialStatus !== "ALL")) return;
    const nextView = initialView ?? "ALL";
    const nextStatus = initialStatus ?? "ALL";
    if (view === nextView && (nextStatus === "ALL" || status === nextStatus)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    // eslint-disable-next-line react-hooks/exhaustive-deps -- status/view are read as echo-guard only; adding them would re-run mid-URL-echo and revert the user's preset
    selectQuickView(initialView ?? "ALL", initialStatus !== "ALL" ? initialStatus : undefined);
  }, [initialView, initialStatus, selectQuickView]);

  useEffect(() => {
    async function loadSources() {
      try {
        const response = await fetch("/api/admin/settings");
        const body = await response.json();
        if (response.ok && body.data?.sources) {
          setSources(
            (body.data.sources as Array<{ key: string; labelEn: string }>).filter(
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

  const quickViewCounts = useMemo(() => {
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
    return sortedRows.slice(start, start + limit);
  }, [sortedRows, page, limit]);

  const selectedOrders = useMemo(() => {
    return rows.filter((order) => selected.includes(order.id));
  }, [rows, selected]);

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

  function handleInitiateDeleteBatch() {
    const selectedList = rows.filter((o) => selected.includes(o.id));
    const paidOrders = selectedList.filter(
      (o) => (o.outstandingCents ?? 0) <= 0 || o.paymentStatus === "PAID" || (o.paidCents ?? 0) > 0
    );
    const unpaidOrders = selectedList.filter((o) => !paidOrders.includes(o));

    setPendingDelete({
      deletable: unpaidOrders,
      skippedPaid: paidOrders,
    });
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
          eyebrow="OPERATIONS WORKSPACE"
          title="Orders &amp; Fulfillment Queue"
          description={`Updated ${lastUpdated.toLocaleTimeString("fi-FI")}`}
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* 3 SUB-VIEW SWITCHER PINS */}
          <div className="flex items-center gap-1 bg-surface-muted p-1 rounded-xl border border-line text-xs font-bold">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                workspaceMode === "TABLE" ? "bg-surface text-primary shadow-xs border border-line" : "text-ink/70 hover:text-ink"
              }`}
              onClick={() => setWorkspaceMode("TABLE")}
            >
              Queue
            </button>

            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                workspaceMode === "KANBAN" ? "bg-surface text-primary shadow-xs border border-line" : "text-ink/70 hover:text-ink"
              }`}
              onClick={() => setWorkspaceMode("KANBAN")}
            >
              Packing board
            </button>

            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                workspaceMode === "TERMINAL" ? "bg-surface text-primary shadow-xs border border-line" : "text-ink/70 hover:text-ink"
              }`}
              onClick={() => setWorkspaceMode("TERMINAL")}
            >
              Pickup desk
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary text-xs py-1.5 px-3 font-semibold"
            onClick={() => setShowPackingSlip(true)}
          >
            Batch packing slip
          </button>

          {canCreate && (
            <Link className="btn text-xs py-1.5 px-3 font-bold" href="/admin/manual-orders">
              New order
            </Link>
          )}
        </div>
      </div>

      {notice && <AdminNotice tone="success" live>{notice}</AdminNotice>}
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      {/* RENDER SELECTED WORKSPACE SUB-VIEW */}
      {workspaceMode === "KANBAN" && (
        <PackingKanban orders={rows.filter((o) => !o.archived)} canTransition={canTransition} onRefresh={() => void refreshOrders()} />
      )}

      {workspaceMode === "TERMINAL" && (
        <PickupTerminal orders={rows.filter((o) => !o.archived)} canTransition={canTransition} onRefresh={() => void refreshOrders()} />
      )}

      {workspaceMode === "TABLE" && (
        <div className="flex flex-col gap-3">
          {/* QUICK VIEW CHIPS WITH PROMINENT ACTIVE HIGHLIGHT & NO BORDER OVERLAP */}
          <div className="flex items-center gap-2 overflow-x-auto p-1.5 text-xs">
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
          <div className="card p-3 flex flex-wrap items-center gap-3">
            <input
              placeholder="Search reference, customer name, or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[220px] text-xs py-1.5 px-3 rounded-lg border border-line bg-surface"
            />

            {/* DATE PRESETS DROPDOWN */}
            <label className="text-xs font-bold text-ink flex items-center gap-1.5 bg-surface-muted px-2.5 py-1.5 rounded-lg border border-line">
              <span>📅 Date:</span>
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
              ⚙️ Advanced Filters
              {activeFilterCount > 0 && (
                <span className="text-[10px] bg-surface text-primary px-1.5 py-0.2 rounded-full font-mono">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {canExport && (
              <a className="btn btn-secondary text-xs py-1.5 px-3" href="/api/admin/orders/export" download>
                📥 Export CSV
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
                    <option value="PICKUP">📍 Pickup</option>
                    <option value="DELIVERY">🚚 Delivery</option>
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
                    <option value="LIVE_ONLY">⚡ Live Real-Time Orders Only</option>
                    <option value="HISTORICAL_ONLY">📜 Historical Entries Only</option>
                  </select>
                </label>

                {/* Archive Scope Filter Dropdown */}
                <label className="field">
                  <span>Archive Scope Filter</span>
                  <select
                    value={archiveScope}
                    onChange={(e) => handleArchiveScopeChange(e.target.value as ArchiveScope)}
                  >
                    <option value="ACTIVE_ONLY">🟢 Active Orders Only (Default)</option>
                    <option value="ARCHIVED_ONLY">📦 Archived Orders Only</option>
                    <option value="ALL">🌐 All Orders (Include Archived)</option>
                  </select>
                </label>
              </div>
            </div>
          )}

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

                      <td className="p-3">
                        <strong className="text-ink block font-bold">{order.customerName}</strong>
                        <div className="inline-flex items-center gap-1">
                          <span className="muted text-[11px]">📞 {order.mobile}</span>
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
                        {formatOrderSourceBadge(order)}
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
                        <div className="flex flex-col items-start gap-1">
                          <AdminStatusBadge status={order.status} />
                          {order.archived && (
                            <span className="text-[10px] font-bold text-purple-900 bg-purple-100 px-1.5 py-0.2 rounded border border-purple-300">
                              📦 Archived
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-right">
                        <AdminRowActionMenu
                          items={[
                            {
                              id: "view-details",
                              label: "View Details",
                              icon: <IconEye />,
                              onClick: () => {
                                window.location.href = `/admin/orders/${order.id}`;
                              },
                            },
                            ...(canUpdate
                              ? [
                                  {
                                    id: "edit-order",
                                    label: "Edit Order",
                                    icon: <IconPencil />,
                                    onClick: () => {
                                      window.location.href = `/admin/orders/${order.id}/edit`;
                                    },
                                  },
                                ]
                              : []),
                            ...(canTransition && getNextQuickAction(order)
                              ? [
                                  {
                                    id: "quick-transition",
                                    label: getNextQuickAction(order)!.label,
                                    icon: <span className="text-emerald-600 font-bold">{getNextQuickAction(order)!.icon}</span>,
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
            total={sortedRows.length}
            onPageChange={setPage}
            onLimitChange={(newLimit) => setLimit(newLimit)}
            itemLabel="orders"
          />
        </div>
      )}

      {/* STICKY FLOATING BULK SELECTION TOOLBAR */}
      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-forest text-on-primary p-3.5 px-5 rounded-2xl shadow-2xl border border-emerald-700/50 flex flex-wrap items-center gap-3 text-xs animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2 font-bold pr-2 border-r border-emerald-700/60">
            <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-mono text-xs">
              {selected.length}
            </span>
            <span>order(s) selected</span>
          </div>

          {canTransition && view !== "ARCHIVED" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                className="btn btn-secondary text-xs py-1.5 px-3 font-bold bg-emerald-800 text-white border-emerald-600 hover:bg-emerald-700"
                onClick={() => setPending({ target: "CONFIRMED", orders: selectedOrders })}
              >
                ✓ Confirm ({selected.length})
              </button>

              <button
                type="button"
                className="btn btn-secondary text-xs py-1.5 px-3 font-bold bg-emerald-800 text-white border-emerald-600 hover:bg-emerald-700"
                onClick={() => setPending({ target: "PICKING", orders: selectedOrders })}
              >
                📦 Start Picking ({selected.length})
              </button>

              <button
                type="button"
                className="btn btn-secondary text-xs py-1.5 px-3 font-bold bg-emerald-800 text-white border-emerald-600 hover:bg-emerald-700"
                onClick={() => setPending({ target: "READY", orders: selectedOrders })}
              >
                🟢 Mark Ready ({selected.length})
              </button>

              <button
                type="button"
                className="btn btn-secondary text-xs py-1.5 px-3 font-bold bg-emerald-800 text-white border-emerald-600 hover:bg-emerald-700"
                onClick={() => setPending({ target: "OUT_FOR_DELIVERY", orders: selectedOrders })}
              >
                🚚 Out for Delivery ({selected.length})
              </button>

              <button
                type="button"
                className="btn btn-secondary text-xs py-1.5 px-3 font-bold bg-emerald-800 text-white border-emerald-600 hover:bg-emerald-700"
                onClick={() => setPending({ target: "PICKED_UP", orders: selectedOrders })}
              >
                🤝 Mark Picked Up ({selected.length})
              </button>

              <button
                type="button"
                className="btn btn-secondary text-xs py-1.5 px-3 font-bold bg-emerald-800 text-white border-emerald-600 hover:bg-emerald-700"
                onClick={() => setPending({ target: "DELIVERED", orders: selectedOrders })}
              >
                🏁 Delivered ({selected.length})
              </button>
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
              {archiving ? "Archiving…" : `📦 Archive (${selected.length})`}
            </button>
          ) : (
            <button
              type="button"
              disabled
              title="🔒 Requires Archive permission (orders.archive). Contact Store Owner to grant access."
              className="btn text-xs py-1.5 px-3 font-semibold bg-emerald-950/40 text-emerald-300/40 border border-emerald-800/40 cursor-not-allowed opacity-60 flex items-center gap-1"
            >
              🔒 📦 Archive ({selected.length})
            </button>
          )}

          {canExport && (
            <button
              type="button"
              className="btn btn-secondary text-xs py-1.5 px-3 font-semibold bg-emerald-900/60 text-emerald-100 border-emerald-700 hover:bg-emerald-800"
              onClick={() => {
                const ids = selected.join(",");
                window.open(`/api/admin/orders/export?ids=${encodeURIComponent(ids)}`, "_blank");
              }}
            >
              📥 Export Selected CSV
            </button>
          )}

          {/* PERMANENT DELETE SAFE-GUARD BUTTON (GRANULAR RBAC LOCK UX) */}
          {canDelete ? (
            <button
              type="button"
              className="btn text-xs py-1.5 px-3 font-bold bg-rose-950 text-rose-200 border border-rose-800 hover:bg-rose-900 shadow-sm"
              onClick={handleInitiateDeleteBatch}
            >
              🗑️ Delete ({selected.length})
            </button>
          ) : (
            <button
              type="button"
              disabled
              title="🔒 Requires Permanent Delete permission (orders.delete). Contact Store Owner to grant access."
              className="btn text-xs py-1.5 px-3 font-semibold bg-emerald-950/40 text-emerald-300/40 border border-emerald-800/40 cursor-not-allowed opacity-60 flex items-center gap-1"
            >
              🔒 🗑️ Delete ({selected.length})
            </button>
          )}

          <button
            type="button"
            className="text-emerald-300 hover:text-white font-bold ml-2 text-xs"
            onClick={() => setSelected([])}
          >
            ✕ Clear Selection
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
