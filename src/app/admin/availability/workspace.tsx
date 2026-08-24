"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { CalendarRange, ChevronLeft, ChevronRight, Eye, LockKeyhole, Pencil, UnlockKeyhole } from "lucide-react";
import type { AvailabilityWorkspace } from "@/domain/availability";
import { AdminNotice, AdminPageHeader, AdminStatusBadge, useAdminDialogFocus } from "../presentation";
import { AdminPagination } from "../ui/admin-pagination";
import { AdminRowActionMenu, IconEye, IconLock, IconPencil } from "../ui/admin-row-action-menu";
import { BatchPlannerPanel } from "./batch-planner-panel";
import { DateInspectorDrawer, type DateOrdersEntry } from "./date-inspector-drawer";
import { FreezeModal } from "./freeze-modal";

type Workspace = AvailabilityWorkspace;
type AvailabilityRow = Workspace["rows"][number];
type QueueItem = Workspace["queues"]["picking"][number];
type OrdersByDate = Record<string, DateOrdersEntry>;
type ViewMode = "WEEK" | "MONTH" | "TABLE";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function litres(value: number) {
  return `${(value / 1000).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} L`;
}

function formatDay(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  return { weekday: dayNames[parsed.getUTCDay()], short: `${parsed.getUTCDate()}.${parsed.getUTCMonth() + 1}.` };
}

function fillTone(utilization: number, soldOut: boolean) {
  if (soldOut || utilization >= 100) return "danger";
  if (utilization >= 75) return "warning";
  return "success";
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}

function getStartOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

function getStartOfMonth(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}

function getDaysInMonth(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AvailabilityWorkspace({
  initialWorkspace,
  canManage,
  canSoldOut,
}: {
  initialWorkspace: Workspace;
  canManage: boolean;
  canSoldOut: boolean;
}) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const value = searchParams.get("view")?.toUpperCase();
    return value === "MONTH" || value === "TABLE" ? value : "WEEK";
  });
  const [productFilter, setProductFilter] = useState(() => searchParams.get("productId") ?? "ALL");
  const [seasonFilter, setSeasonFilter] = useState(() => searchParams.get("seasonId") ?? "ALL");

  useEffect(() => {
    const viewParam = searchParams.get("view")?.toUpperCase();
    if (viewParam === "WEEK" || viewParam === "MONTH" || viewParam === "TABLE") {
      // URL navigation owns the initial view; apply it after the client mounts.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewMode(viewParam as ViewMode);
    }
  }, [searchParams]);

  // The server anchors and snaps every view's start date (see page.tsx).
  // Adopt its answer instead of recomputing from the browser clock.
  const [currentStartDate, setCurrentStartDate] = useState(() => initialWorkspace.startDate ?? getStartOfWeek(todayStr()));
  const [inspectingDate, setInspectingDate] = useState<string | null>(null);
  const [freezingRow, setFreezingRow] = useState<AvailabilityRow | null>(null);

  const [editing, setEditing] = useState<AvailabilityRow | null>(null);
  const availabilityDialogRef = useAdminDialogFocus<HTMLFormElement>(editing !== null, () => setEditing(null));
  const [batchPanelOpen, setBatchPanelOpen] = useState(false);

  const [capacityDraftLitres, setCapacityDraftLitres] = useState(0);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", viewMode);
    if (productFilter !== "ALL") next.set("productId", productFilter); else next.delete("productId");
    if (seasonFilter !== "ALL") next.set("seasonId", seasonFilter); else next.delete("seasonId");
    next.set("startDate", currentStartDate);
    if (next.toString() !== searchParams.toString()) router.replace(`?${next.toString()}`, { scroll: false });
  }, [currentStartDate, productFilter, router, searchParams, seasonFilter, viewMode]);

  const today = workspace.today;
  const selectedProduct = workspace.products.find((product) => product.id === productFilter);
  const selectedSeasons = selectedProduct?.seasons ?? [];

  async function fetchWorkspaceForDates(start: string, days = 7) {
    try {
      const query = new URLSearchParams({
        startDate: start,
        days: days.toString(),
        productId: productFilter,
        ...(seasonFilter !== "ALL" ? { seasonId: seasonFilter } : {}),
      });
      const response = await fetch(`/api/admin/availability?${query}`);
      const body = await response.json();
      if (response.ok && body.data) {
        setWorkspace(body.data);
      }
    } catch {
      /* ignore */
    }
  }

  function handleNavigate(direction: -1 | 1) {
    if (viewMode === "WEEK") {
      const nextStart = addDays(currentStartDate, direction * 7);
      setCurrentStartDate(nextStart);
      void fetchWorkspaceForDates(nextStart, 7);
    } else if (viewMode === "MONTH") {
      const nextStart = addMonths(currentStartDate, direction);
      setCurrentStartDate(nextStart);
      const daysCount = getDaysInMonth(nextStart);
      void fetchWorkspaceForDates(nextStart, daysCount);
    } else {
      const nextStart = addDays(currentStartDate, direction * 30);
      setCurrentStartDate(nextStart);
      void fetchWorkspaceForDates(nextStart, 30);
    }
  }

  function handleProductFilterChange(productId: string) {
    setProductFilter(productId);
    setSeasonFilter("ALL");
  }

  function handleSeasonFilterChange(seasonId: string) {
    setSeasonFilter(seasonId);
    void fetchWorkspaceForDates(currentStartDate, viewMode === "WEEK" ? 7 : viewMode === "MONTH" ? getDaysInMonth(currentStartDate) : 30);
  }

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    if (mode === "WEEK") {
      const monday = getStartOfWeek(currentStartDate);
      setCurrentStartDate(monday);
      void fetchWorkspaceForDates(monday, 7);
    } else if (mode === "MONTH") {
      const monthStart = getStartOfMonth(currentStartDate);
      setCurrentStartDate(monthStart);
      const daysCount = getDaysInMonth(monthStart);
      void fetchWorkspaceForDates(monthStart, daysCount);
    } else {
      void fetchWorkspaceForDates(currentStartDate, 30);
    }
  }

  // Pagination state for Dense Table view
  const [tablePage, setTablePage] = useState(1);
  const [tableLimit, setTableLimit] = useState(20);

  const rows = useMemo(() => {
    return workspace.rows.filter((row) => {
      if (productFilter !== "ALL" && row.product.id !== productFilter) return false;
      if (seasonFilter !== "ALL" && row.availability.seasonId !== seasonFilter) return false;
      return true;
    });
  }, [workspace.rows, productFilter, seasonFilter]);

  const paginatedRows = useMemo(() => {
    return rows.slice((tablePage - 1) * tableLimit, tablePage * tableLimit);
  }, [rows, tablePage, tableLimit]);

  // Daily cards calculation
  const dateCards = useMemo(() => {
    return workspace.dates.map((date) => {
      const dayRows = rows.filter((row) => row.availability.businessDate === date);
      const capacity = dayRows.reduce((sum, row) => sum + row.availability.capacityMl, 0);
      const reserved = dayRows.reduce((sum, row) => sum + row.availability.reservedMl, 0);
      const utilization = capacity ? Math.round((reserved / capacity) * 100) : 0;
      const soldOut = dayRows.some((row) => row.soldOut);
      const freezeReason = dayRows.find((r) => r.availability.manualSoldOutReason)?.availability.manualSoldOutReason;
      const isPast = date < today;
      const isUnplanned = dayRows.length === 0;

      // Check product harvest window if filtered
      const selectedProduct = workspace.products.find((p) => p.id === productFilter);
      const isOffSeason = selectedProduct
        ? (selectedProduct.availableFrom && date < selectedProduct.availableFrom) ||
          (selectedProduct.availableThrough && date > selectedProduct.availableThrough)
        : false;

      return { date, dayRows, capacity, reserved, utilization, soldOut, freezeReason, isPast, isUnplanned, isOffSeason };
    });
  }, [workspace.dates, rows, today, productFilter, workspace.products]);

  // Overall Capacity Summary
  const windowCapacityTotalMl = useMemo(() => dateCards.reduce((sum, d) => sum + d.capacity, 0), [dateCards]);
  const windowReservedTotalMl = useMemo(() => dateCards.reduce((sum, d) => sum + d.reserved, 0), [dateCards]);
  const windowUtilization = windowCapacityTotalMl > 0 ? Math.round((windowReservedTotalMl / windowCapacityTotalMl) * 100) : 0;

  function openCapacityEditor(row: AvailabilityRow) {
    setError("");
    setMessage("");
    setEditing(row);
    setCapacityDraftLitres(row.availability.capacityMl / 1000);
  }

  // Emergency Freeze Lock
  async function handleConfirmFreeze(reason: string) {
    if (!freezingRow) return;
    setError("");
    setMessage("");
    const isLocking = !freezingRow.soldOut;

    const response = await fetch(`/api/admin/availability/${freezingRow.availability.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: freezingRow.availability.version,
        capacityMl: freezingRow.availability.capacityMl,
        manualSoldOut: isLocking,
        soldOutReason: isLocking ? reason : undefined,
      }),
    });
    const body = await response.json();
    setFreezingRow(null);
    if (!response.ok) return setError(body.message ?? "Could not update sold-out lock.");
    setMessage(isLocking ? `Date ${freezingRow.availability.businessDate} frozen (${reason}).` : "Date reopened.");
    void fetchWorkspaceForDates(currentStartDate, viewMode === "MONTH" ? getDaysInMonth(currentStartDate) : 7);
  }

  async function saveAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setError("");
    setMessage("");
    const capacityMl = Math.round(capacityDraftLitres * 1000);
    if (!Number.isFinite(capacityMl) || capacityMl < editing.availability.reservedMl) {
      return setError(`Capacity cannot be lower than the ${litres(editing.availability.reservedMl)} already reserved.`);
    }

    const response = await fetch(`/api/admin/availability/${editing.availability.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: editing.availability.version,
        capacityMl,
        manualSoldOut: editing.availability.manualSoldOut,
        soldOutReason: editing.availability.manualSoldOutReason ?? undefined,
      }),
    });

    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Could not save availability.");
    setEditing(null);
    setMessage(`Availability for ${editing.availability.businessDate} saved.`);
    void fetchWorkspaceForDates(currentStartDate, viewMode === "MONTH" ? getDaysInMonth(currentStartDate) : 7);
  }

  const inspectedDayRow = inspectingDate ? rows.find((r) => r.availability.businessDate === inspectingDate) : null;
  const inspectedOrdersData = inspectingDate && workspace.ordersByDate
    ? (workspace.ordersByDate as OrdersByDate)[inspectingDate]
    : undefined;
  const inspectedProductName = inspectedDayRow?.product.nameFi ?? "All Products";

  return (
    <main className="shell py-8 availability-workspace availability-planner flex flex-col gap-4">
      <AdminPageHeader
        eyebrow="Operations"
        title="Harvest availability"
        description="See what can still be promised, then safely adjust one product and business date at a time."
        actions={
          canManage ? (
            <button className="btn" type="button" onClick={() => setBatchPanelOpen((prev) => !prev)}>
              <CalendarRange aria-hidden="true" />{batchPanelOpen ? "Close batch plan" : "Plan capacity"}
            </button>
          ) : undefined
        }
      />

      {message && <AdminNotice tone="success" live>{message}</AdminNotice>}
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      {/* EXPANDABLE IN-PAGE BATCH PLANNER PANEL */}
      {batchPanelOpen && canManage && (
        <BatchPlannerPanel
          initialStartDate={workspace.startDate < workspace.today ? workspace.today : workspace.startDate}
          initialEndDate={workspace.endDate < workspace.today ? workspace.today : workspace.endDate}
          products={workspace.products}
          initialProductId={productFilter !== "ALL" ? productFilter : undefined}
          seasonId={productFilter !== "ALL" && seasonFilter !== "ALL" ? seasonFilter : undefined}
          onClose={() => setBatchPanelOpen(false)}
          onApplied={() => {
            setBatchPanelOpen(false);
            setMessage("Batch capacity planning applied successfully.");
            void fetchWorkspaceForDates(currentStartDate, viewMode === "MONTH" ? getDaysInMonth(currentStartDate) : 7);
          }}
        />
      )}

      {/* TOP CONTROLS & MULTI-VIEW SELECTOR BAR */}
      <section className="card availability-toolbar">
        <div className="availability-toolbar-primary">
          {/* View Mode Tabs */}
          <div className="availability-view-tabs" role="tablist" aria-label="Availability view">
            {[
              { key: "WEEK", label: "Week" },
              { key: "MONTH", label: "Month" },
              { key: "TABLE", label: "Table" },
            ].map((mode) => (
              <button
                key={mode.key}
                type="button"
                role="tab"
                aria-selected={viewMode === mode.key}
                className={viewMode === mode.key ? "is-active" : ""}
                onClick={() => handleViewModeChange(mode.key as ViewMode)}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <label className="availability-filter-field"><span>Product</span><select value={productFilter} onChange={(event) => handleProductFilterChange(event.target.value)}><option value="ALL">All products</option>{workspace.products.map((product) => <option value={product.id} key={product.id}>{product.nameFi}</option>)}</select></label>

          {productFilter !== "ALL" && selectedSeasons.length > 0 && (
            <label className="availability-filter-field">
              <span>Season</span>
              <select
                value={seasonFilter}
                onChange={(event) => handleSeasonFilterChange(event.target.value)}
              >
                <option value="ALL">All seasons</option>
                {selectedSeasons.map((season) => (
                  <option key={season.id} value={season.id}>{season.nameFi}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* Dynamic Navigation & Summary Line */}
        <div className="availability-window-bar">
          <div className="availability-window-navigation">
            <button type="button" className="btn btn-secondary" onClick={() => handleNavigate(-1)} aria-label={viewMode === "WEEK" ? "Previous week" : viewMode === "MONTH" ? "Previous month" : "Previous range"}>
              <ChevronLeft aria-hidden="true" /> <span>Previous</span>
            </button>
            <strong>
              {workspace.startDate} – {workspace.endDate}
            </strong>
            <button type="button" className="btn btn-secondary" onClick={() => handleNavigate(1)} aria-label={viewMode === "WEEK" ? "Next week" : viewMode === "MONTH" ? "Next month" : "Next range"}>
              <span>Next</span> <ChevronRight aria-hidden="true" />
            </button>
          </div>

          <div className="availability-window-summary" aria-label="Planning window totals">
            <span><small>Capacity</small><strong>{litres(windowCapacityTotalMl)}</strong></span>
            <span><small>Reserved</small><strong>{litres(windowReservedTotalMl)} · {windowUtilization}%</strong></span>
            <span><small>Remaining</small><strong>{litres(Math.max(0, windowCapacityTotalMl - windowReservedTotalMl))}</strong></span>
          </div>
        </div>
      </section>

      {/* VIEW MODE 1: CALENDAR WEEK TIMELINE VIEW (MON-SUN) */}
      {viewMode === "WEEK" && (
        <section className="availability-day-grid">
          {dateCards.map((day) => {
            const tone = fillTone(day.utilization, day.soldOut);
            const remainingLitres = Math.max(0, day.capacity - day.reserved);
            const dayOrders = workspace.ordersByDate
              ? (workspace.ordersByDate as OrdersByDate)[day.date]
              : undefined;

            return (
              <article
                key={day.date}
                className={`card availability-day-card ${
                  day.isPast
                    ? "bg-slate-100/60 border-slate-200 opacity-75"
                    : day.isOffSeason
                    ? "bg-slate-50 border-dashed border-slate-300 text-slate-400"
                    : day.isUnplanned
                    ? "bg-surface border-dashed border-slate-300"
                    : day.soldOut
                    ? "bg-slate-100/80 border-slate-300"
                    : tone === "danger"
                    ? "bg-rose-50/50 border-rose-300"
                    : tone === "warning"
                    ? "bg-amber-50/50 border-amber-300"
                    : "bg-surface border-line"
                }`}
              >
                <div>
                  {/* Card Date Header */}
                  <div className="flex items-start justify-between gap-1 border-b border-line/60 pb-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider muted block">
                        {formatDay(day.date).weekday}
                      </span>
                      <h3 className="text-base font-bold text-ink">{formatDay(day.date).short}</h3>
                    </div>

                    <AdminStatusBadge
                      status={
                        day.isPast
                          ? "EXPIRED"
                          : day.isOffSeason
                          ? "EXPIRED"
                          : day.isUnplanned
                          ? "NEW"
                          : day.soldOut
                          ? "CANCELLED"
                          : day.utilization >= 75
                          ? "CAPACITY_NEAR_LIMIT"
                          : "CONFIRMED"
                      }
                      label={
                        day.isPast
                          ? "Past"
                          : day.isOffSeason
                          ? "Off-Season"
                          : day.isUnplanned
                          ? "Unplanned"
                          : day.soldOut
                          ? "Sold Out"
                          : day.utilization >= 75
                          ? `${day.utilization}% Near`
                          : `${day.utilization}%`
                      }
                    />
                  </div>

                  <div className="availability-day-facts">
                    <div><span>Remaining</span><strong>{litres(remainingLitres)}</strong></div>
                    <div><span>Capacity</span><strong>{litres(day.capacity)}</strong></div>
                    <div><span>Reserved</span><strong>{litres(day.reserved)} · {day.utilization}%</strong></div>
                  </div>

                  {/* Visual Utilization Bar */}
                  <div className="w-full h-2.5 rounded-full bg-line/60 overflow-hidden p-0.5 mb-2">
                    <div
                      className={`h-full rounded-full transition-all ${
                        day.isPast || day.isOffSeason || day.soldOut
                          ? "bg-slate-400"
                          : day.utilization >= 90
                          ? "bg-rose-600"
                          : day.utilization >= 75
                          ? "bg-amber-500"
                          : "bg-emerald-600"
                      }`}
                      style={{ width: `${Math.min(100, day.utilization)}%` }}
                    />
                  </div>

                  {/* Order Breakdown Chips */}
                  {dayOrders && dayOrders.orders.length > 0 ? (
                    <div className="flex flex-col gap-1 text-[11px] bg-surface-muted/50 p-2 rounded-lg border border-line">
                      <span className="font-bold text-ink">{dayOrders.orders.length} order(s)</span>
                      <span className="muted">{dayOrders.pickupCount} pickup · {dayOrders.deliveryCount} delivery</span>
                    </div>
                  ) : day.isUnplanned ? (
                    <span className="text-[11px] text-slate-500 italic block">No capacity set for this date</span>
                  ) : (
                    <span className="text-[11px] muted italic block">No orders yet</span>
                  )}

                  {day.freezeReason && (
                    <span className="text-[10px] text-amber-900 bg-amber-100 p-1.5 rounded font-medium block mt-1">
                      Lock reason: {day.freezeReason}
                    </span>
                  )}
                </div>

                {/* Card Action Controls */}
                <div className="availability-day-actions">
                  {day.dayRows[0] && !day.isPast ? (
                    <>
                      <button type="button" className="btn btn-secondary" onClick={() => setInspectingDate(day.date)}><Eye aria-hidden="true" />Inspect</button>
                      {productFilter !== "ALL" && canManage && (
                        <button type="button" className="btn btn-secondary" onClick={() => openCapacityEditor(day.dayRows[0])}><Pencil aria-hidden="true" />Edit capacity</button>
                      )}
                      {productFilter !== "ALL" && canSoldOut && (
                        <button
                          type="button"
                          className={`btn ${day.soldOut ? "btn-secondary" : "btn-danger"}`}
                          onClick={() => setFreezingRow(day.dayRows[0])}
                        >
                          {day.soldOut ? <UnlockKeyhole aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}{day.soldOut ? "Reopen" : "Freeze"}
                        </button>
                      )}
                    </>
                  ) : day.isUnplanned && canManage && !day.isPast ? (
                    <button
                      type="button"
                      className="btn text-[11px] font-bold py-1 px-2.5 w-full shadow-2xs"
                      onClick={() => setBatchPanelOpen(true)}
                    >
                      Set capacity
                    </button>
                  ) : (
                    <span className="text-[10px] muted italic">Read-only history</span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* VIEW MODE 2: MONTH CALENDAR HEATMAP */}
      {viewMode === "MONTH" && (
        <section className="card p-4 md:p-5 flex flex-col gap-4 border border-line">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <span className="eyebrow">MONTHLY SEASON OVERVIEW</span>
              <h3 className="text-base font-bold text-ink">Calendar Month Capacity Heatmap</h3>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500" /> 0–75% Healthy</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500" /> 76–95% Near</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-600" /> 96–100% Full</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-400" /> Locked</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2.5">
            {dateCards.map((day) => {
              const remainingLitres = Math.max(0, day.capacity - day.reserved);
              const tone = fillTone(day.utilization, day.soldOut);

              return (
                <button
                  type="button"
                  key={day.date}
                  className={`availability-month-day ${
                    day.isPast
                      ? "bg-slate-200 text-slate-700 border-slate-300 opacity-75"
                      : day.isUnplanned
                      ? "bg-white text-slate-600 border-dashed border-slate-300"
                      : day.soldOut
                      ? "bg-slate-200 text-slate-800 border-slate-300"
                      : tone === "danger"
                      ? "bg-rose-600 text-on-primary border-rose-700 shadow-xs"
                      : tone === "warning"
                      ? "bg-amber-500 text-on-primary border-amber-600 shadow-xs"
                      : "bg-emerald-600 text-on-primary border-emerald-700 shadow-xs"
                  }`}
                  onClick={() => setInspectingDate(day.date)}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-90 block">
                    {formatDay(day.date).weekday} {formatDay(day.date).short}
                  </span>

                  <span className="text-lg font-bold ops-tabular block">{litres(remainingLitres)}</span>
                  <span className="text-[10px] font-semibold opacity-90 block">
                    {day.isPast ? "Past Date" : day.isUnplanned ? "Unplanned" : day.soldOut ? "Locked" : `${day.utilization}% Reserved`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* VIEW MODE 3: DENSE TABLE VIEW (STANDARDIZED WITH ADMINROWACTIONMENU) */}
      {viewMode === "TABLE" && (
        <section className="card p-4 overflow-x-auto border border-line">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted border-b border-line text-muted uppercase font-bold text-[11px]">
              <tr>
                <th className="p-3">Business Date</th>
                <th className="p-3">Product</th>
                <th className="p-3 text-right">Capacity (L)</th>
                <th className="p-3 text-right">Reserved (L)</th>
                <th className="p-3 text-right">Remaining (L)</th>
                <th className="p-3 text-center">Fill Rate</th>
                <th className="p-3 text-center">Status</th>
                {canManage && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {paginatedRows.map((row) => {
                const remainingLitres = Math.max(0, row.availability.capacityMl - row.availability.reservedMl);

                return (
                  <tr key={row.availability.id} className="hover:bg-surface-muted/50 transition-colors">
                    <td data-label="Business date" className="p-3 font-bold text-ink ops-tabular">
                      {row.availability.businessDate} ({formatDay(row.availability.businessDate).weekday})
                    </td>
                    <td data-label="Product" className="p-3 font-semibold text-ink">{row.product.nameFi}</td>
                    <td data-label="Capacity" className="p-3 text-right font-bold text-ink ops-tabular">
                      {litres(row.availability.capacityMl)}
                    </td>
                    <td data-label="Reserved" className="p-3 text-right font-semibold text-primary ops-tabular">
                      {litres(row.availability.reservedMl)}
                    </td>
                    <td data-label="Remaining" className="p-3 text-right font-bold text-emerald-700 ops-tabular">
                      {litres(remainingLitres)}
                    </td>
                    <td data-label="Fill rate" className="p-3 text-center font-bold ops-tabular">{row.utilization}%</td>
                    <td data-label="Status" className="p-3 text-center">
                      <AdminStatusBadge
                        status={row.soldOut ? "CANCELLED" : row.utilization >= 75 ? "CAPACITY_NEAR_LIMIT" : "CONFIRMED"}
                        label={row.soldOut ? "Sold out" : row.utilization >= 75 ? "Near limit" : "Open"}
                      />
                    </td>
                    {canManage && (
                      <td data-label="Actions" className="p-3 text-right">
                        <AdminRowActionMenu
                          items={[
                            {
                              id: "edit-capacity",
                              label: "Edit Capacity",
                              icon: <IconPencil />,
                              onClick: () => openCapacityEditor(row),
                            },
                            {
                              id: "inspect-date",
                              label: "Inspect Date & Orders",
                              icon: <IconEye />,
                              onClick: () => setInspectingDate(row.availability.businessDate),
                            },
                            ...(canSoldOut
                              ? [
                                  {
                                    id: "toggle-lock",
                                    label: row.soldOut ? "Reopen Date" : "Emergency Freeze",
                                    icon: <IconLock />,
                                    danger: !row.soldOut,
                                    onClick: () => setFreezingRow(row),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <AdminPagination
            page={tablePage}
            limit={tableLimit}
            total={rows.length}
            onPageChange={setTablePage}
            onLimitChange={setTableLimit}
            itemLabel="availability dates"
          />
        </section>
      )}

      {/* FULFILLMENT QUEUES SUMMARY */}
      <section className="availability-queues mt-2">
        <div className="admin-section-heading">
          <div>
            <p className="admin-section-kicker">FULFILMENT QUEUES</p>
            <h2>Active Order Pipeline ({workspace.startDate} – {workspace.endDate})</h2>
          </div>
        </div>
        <div className="availability-queue-grid">
          {([
            ["picking", "Picking Queue", workspace.queues.picking],
            ["pickup", "Pickup Ready Queue", workspace.queues.pickup],
            ["delivery", "Delivery Dispatch Queue", workspace.queues.delivery],
          ] as Array<[string, string, QueueItem[]]>).map(([key, title, queue]) => (
            <article className="card availability-queue-card p-4 border border-line" key={key}>
              <div className="flex items-center justify-between gap-2 border-b border-line pb-2 mb-2">
                <h3 className="font-bold text-ink text-sm">{title}</h3>
                <span className="font-bold text-primary text-base ops-tabular">{queue.length}</span>
              </div>
              {queue.length ? (
                <ul className="divide-y divide-line text-xs">
                  {queue.slice(0, 4).map((item) => (
                    <li key={item.id} className="py-2 flex items-center justify-between">
                      <a className="font-bold text-primary hover:underline" href={`/admin/orders/${item.id}`}>
                        {item.publicReference}
                      </a>
                      <span className="muted">
                        {item.customerName} · {item.quantity}×
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs muted py-2">No orders in this queue.</p>
              )}
              <a className="btn btn-secondary text-xs mt-2 text-center font-bold" href={`/admin/orders?view=${key}`}>
                Open queue ↗
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* DATE INSPECTOR DRAWER */}
      {inspectingDate && (
        <DateInspectorDrawer
          date={inspectingDate}
          capacityMl={dateCards.find((d) => d.date === inspectingDate)?.capacity ?? 0}
          reservedMl={dateCards.find((d) => d.date === inspectingDate)?.reserved ?? 0}
          soldOut={dateCards.find((d) => d.date === inspectingDate)?.soldOut ?? false}
          soldOutReason={dateCards.find((d) => d.date === inspectingDate)?.freezeReason}
          productName={inspectedProductName}
          ordersData={inspectedOrdersData}
          canManage={canManage}
          canSoldOut={canSoldOut && productFilter !== "ALL"}
          onClose={() => setInspectingDate(null)}
          onEditCapacity={productFilter !== "ALL" && inspectedDayRow ? () => openCapacityEditor(inspectedDayRow) : undefined}
          onFreeze={() => {
            if (inspectedDayRow) setFreezingRow(inspectedDayRow);
          }}
        />
      )}

      {/* EMERGENCY FREEZE MODAL */}
      {freezingRow && (
        <FreezeModal
          date={freezingRow.availability.businessDate}
          productName={freezingRow.product.nameFi}
          initialReason={freezingRow.availability.manualSoldOutReason ?? undefined}
          onClose={() => setFreezingRow(null)}
          onConfirm={(reason) => void handleConfirmFreeze(reason)}
        />
      )}

      {/* EDIT AVAILABILITY MODAL */}
      {editing && (
        <div className="admin-dialog-backdrop">
          <form ref={availabilityDialogRef} className="admin-dialog card availability-dialog" role="dialog" aria-modal="true" aria-labelledby="availability-edit-title" onSubmit={(event) => void saveAvailability(event)}>
            <p className="eyebrow">Capacity change</p>
            <h2 id="availability-edit-title">{editing.product.nameFi} · {editing.availability.businessDate}</h2>
            <p className="muted text-xs">Review the effect before saving. This record is currently version {editing.availability.version}.</p>
            {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

            <label className="field">
              <span>Capacity (litres)</span>
              <input
                type="number"
                min={editing.availability.reservedMl / 1000}
                step="0.1"
                value={capacityDraftLitres}
                onChange={(event) => setCapacityDraftLitres(Number(event.target.value))}
                required
              />
            </label>

            <div className="availability-change-preview" aria-label="Capacity change preview">
              <div><span>Current capacity</span><strong>{litres(editing.availability.capacityMl)}</strong></div>
              <div><span>Reserved</span><strong>{litres(editing.availability.reservedMl)}</strong></div>
              <div><span>New capacity</span><strong>{litres(Math.round(capacityDraftLitres * 1000))}</strong></div>
              <div><span>New remaining</span><strong>{litres(Math.max(0, Math.round(capacityDraftLitres * 1000) - editing.availability.reservedMl))}</strong></div>
            </div>

            <div className="admin-dialog-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn" type="submit">
                Save capacity
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
