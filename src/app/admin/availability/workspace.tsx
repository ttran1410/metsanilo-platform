"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import type { AvailabilityWorkspace } from "@/domain/availability";
import { AdminNotice, AdminPageHeader, AdminStatusBadge } from "../presentation";
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
  const [viewMode, setViewMode] = useState<ViewMode>("WEEK");
  const [productFilter, setProductFilter] = useState("ALL");
  const [seasonFilter, setSeasonFilter] = useState("ALL");
  const [viewFilter, setViewFilter] = useState("ALL");

  useEffect(() => {
    const viewParam = searchParams.get("view")?.toUpperCase();
    if (viewParam === "WEEK" || viewParam === "MONTH" || viewParam === "TABLE") {
      // URL navigation owns the initial view; apply it after the client mounts.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewMode(viewParam as ViewMode);
    }
  }, [searchParams]);

  // Always align initial week start to Monday
  const [currentStartDate, setCurrentStartDate] = useState(getStartOfWeek(todayStr()));
  const [inspectingDate, setInspectingDate] = useState<string | null>(null);
  const [freezingRow, setFreezingRow] = useState<AvailabilityRow | null>(null);

  const [editing, setEditing] = useState<AvailabilityRow | null>(null);
  const [batchPanelOpen, setBatchPanelOpen] = useState(false);

  // Inline Editing State
  const [inlineEditingRowId, setInlineEditingRowId] = useState<string | null>(null);
  const [inlineCapacityVal, setInlineCapacityVal] = useState<string>("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const today = todayStr();
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
      if (viewFilter === "SOLD_OUT") return row.soldOut;
      if (viewFilter === "NEAR") return row.nearCapacity && !row.soldOut;
      if (viewFilter === "ATTENTION") return row.soldOut || row.nearCapacity;
      return true;
    });
  }, [workspace.rows, productFilter, seasonFilter, viewFilter]);

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

  // Inline Stepper Quick Bump Capacity
  async function bumpCapacity(row: AvailabilityRow, deltaLitres: number) {
    setError("");
    setMessage("");
    const nextCapacityMl = Math.max(row.availability.reservedMl, row.availability.capacityMl + deltaLitres * 1000);

    const response = await fetch(`/api/admin/availability/${row.availability.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: row.availability.version,
        capacityMl: nextCapacityMl,
        manualSoldOut: row.availability.manualSoldOut,
        soldOutReason: row.availability.manualSoldOutReason ?? undefined,
      }),
    });
    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Could not update capacity.");
    setMessage(`Capacity for ${row.availability.businessDate} updated to ${litres(nextCapacityMl)}.`);
    void fetchWorkspaceForDates(currentStartDate, viewMode === "MONTH" ? getDaysInMonth(currentStartDate) : 7);
  }

  // Save Inline Direct Capacity Entry
  async function saveInlineCapacity(row: AvailabilityRow, newLitresVal: number) {
    setError("");
    setMessage("");
    setInlineEditingRowId(null);

    const newCapacityMl = Math.max(row.availability.reservedMl, Math.round(newLitresVal * 1000));
    const response = await fetch(`/api/admin/availability/${row.availability.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: row.availability.version,
        capacityMl: newCapacityMl,
        manualSoldOut: row.availability.manualSoldOut,
        soldOutReason: row.availability.manualSoldOutReason ?? undefined,
      }),
    });
    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Could not update capacity.");
    setMessage(`Capacity for ${row.availability.businessDate} updated to ${litres(newCapacityMl)}.`);
    void fetchWorkspaceForDates(currentStartDate, viewMode === "MONTH" ? getDaysInMonth(currentStartDate) : 7);
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
    const form = new FormData(event.currentTarget);
    const manualSoldOut = form.get("manualSoldOut") === "on";
    const reason = String(form.get("reason") ?? "").trim();
    if (manualSoldOut && reason.length < 2) return setError("A sold-out reason is required.");

    const response = await fetch(`/api/admin/availability/${editing.availability.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: editing.availability.version,
        capacityMl: Math.round(Number(form.get("capacityLitres")) * 1000),
        manualSoldOut,
        soldOutReason: manualSoldOut ? reason : undefined,
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
    <main className="shell py-8 availability-workspace flex flex-col gap-4">
      <AdminPageHeader
        eyebrow="HARVEST PLANNING"
        title="Capacity &amp; Availability Scheduler"
        description="Manage perishable wild produce capacity, emergency weather locks, and customer reservation intake."
        actions={
          canManage ? (
            <button className="btn font-bold text-xs shadow-2xs" type="button" onClick={() => setBatchPanelOpen((prev) => !prev)}>
              {batchPanelOpen ? "Close batch planner" : "Open batch planner"}
            </button>
          ) : undefined
        }
      />

      {message && <AdminNotice tone="success" live>{message}</AdminNotice>}
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      {/* EXPANDABLE IN-PAGE BATCH PLANNER PANEL */}
      {batchPanelOpen && canManage && (
        <BatchPlannerPanel
          initialStartDate={workspace.startDate ?? todayStr()}
          initialEndDate={workspace.endDate ?? todayStr()}
          products={workspace.products}
          onClose={() => setBatchPanelOpen(false)}
          onApplied={() => {
            setBatchPanelOpen(false);
            setMessage("Batch capacity planning applied successfully.");
            void fetchWorkspaceForDates(currentStartDate, viewMode === "MONTH" ? getDaysInMonth(currentStartDate) : 7);
          }}
        />
      )}

      {/* TOP CONTROLS & MULTI-VIEW SELECTOR BAR */}
      <section className="card p-4 flex flex-col gap-3 border border-line">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* View Mode Tabs */}
          <div className="flex items-center gap-1 bg-surface-muted p-1 rounded-xl border border-line">
            {[
              { key: "WEEK", label: "Week" },
              { key: "MONTH", label: "Month" },
              { key: "TABLE", label: "Table" },
            ].map((mode) => (
              <button
                key={mode.key}
                type="button"
                className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  viewMode === mode.key
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-muted hover:text-ink hover:bg-surface"
                }`}
                onClick={() => handleViewModeChange(mode.key as ViewMode)}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Product Filter Tabs with High-Contrast Ring */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider muted">Product:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-xl border font-bold transition-all shadow-2xs ${
                  productFilter === "ALL"
                    ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-400/40"
                    : "bg-surface text-ink border-line hover:border-slate-400"
                }`}
                onClick={() => handleProductFilterChange("ALL")}
              >
                {productFilter === "ALL" && "✓ "}All Products
              </button>

              {workspace.products.map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  className={`px-3 py-1.5 rounded-xl border font-bold transition-all shadow-2xs ${
                    productFilter === prod.id
                      ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-400/40"
                      : "bg-surface text-ink border-line hover:border-slate-400"
                  }`}
                   onClick={() => handleProductFilterChange(prod.id)}
                >
                  {productFilter === prod.id && "✓ "}{prod.nameFi}
                </button>
              ))}
            </div>
          </div>

          {productFilter !== "ALL" && selectedSeasons.length > 0 && (
            <label className="flex items-center gap-2 text-xs font-bold">
              <span className="uppercase tracking-wider muted">Season:</span>
              <select
                className="rounded-lg border border-line bg-surface px-2 py-1.5 font-semibold"
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
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line text-xs">
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-secondary text-xs py-1 px-3 font-bold" onClick={() => handleNavigate(-1)}>
              {viewMode === "WEEK" ? "◄ Previous Week" : viewMode === "MONTH" ? "◄ Previous Month" : "◄ Previous Range"}
            </button>
            <span className="font-bold text-ink">
              {workspace.startDate} – {workspace.endDate}
            </span>
            <button type="button" className="btn btn-secondary text-xs py-1 px-3 font-bold" onClick={() => handleNavigate(1)}>
              {viewMode === "WEEK" ? "Next Week ►" : viewMode === "MONTH" ? "Next Month ►" : "Next Range ►"}
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs muted font-medium">
            <span>Window Capacity: <strong className="text-ink ops-tabular">{litres(windowCapacityTotalMl)}</strong></span>
            <span>Reserved Orders: <strong className="text-primary ops-tabular">{litres(windowReservedTotalMl)} ({windowUtilization}%)</strong></span>
            <span className="text-emerald-700 font-semibold">Remaining to sell: {litres(Math.max(0, windowCapacityTotalMl - windowReservedTotalMl))}</span>
          </div>
        </div>
      </section>

      {/* VIEW MODE 1: CALENDAR WEEK TIMELINE VIEW (MON-SUN) */}
      {viewMode === "WEEK" && (
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {dateCards.map((day) => {
            const tone = fillTone(day.utilization, day.soldOut);
            const remainingLitres = Math.max(0, day.capacity - day.reserved);
            const dayOrders = workspace.ordersByDate
              ? (workspace.ordersByDate as OrdersByDate)[day.date]
              : undefined;

            return (
              <article
                key={day.date}
                className={`card p-3 flex flex-col justify-between gap-3 border transition-all cursor-pointer hover:border-primary min-w-0 ${
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
                onClick={() => setInspectingDate(day.date)}
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

                  {/* Capacity Metrics & Inline Direct Numeric Editing */}
                  <div className="my-2.5">
                    {day.dayRows[0] && inlineEditingRowId === day.dayRows[0].availability.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (day.dayRows[0]) void saveInlineCapacity(day.dayRows[0], Number(inlineCapacityVal));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 my-1"
                      >
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={inlineCapacityVal}
                          onChange={(e) => setInlineCapacityVal(e.target.value)}
                          autoFocus
                          className="w-20 px-2 py-1 text-xs font-bold rounded border border-primary bg-surface text-ink"
                        />
                        <button type="submit" className="btn text-[10px] font-bold py-1 px-2">
                          Save
                        </button>
                      </form>
                    ) : (
                      <div
                        onClick={(e) => {
                          if (canManage && day.dayRows[0] && !day.isPast) {
                            e.stopPropagation();
                            setInlineEditingRowId(day.dayRows[0].availability.id);
                            setInlineCapacityVal(String(day.dayRows[0].availability.capacityMl / 1000));
                          }
                        }}
                        title={canManage && !day.isPast ? "Click to type exact capacity" : undefined}
                        className={`group ${canManage && !day.isPast ? "cursor-edit hover:text-primary" : ""}`}
                      >
                        <span className="text-xl font-bold text-ink ops-tabular block">
                          {litres(remainingLitres)}
                          {canManage && !day.isPast && day.dayRows[0] && (
                            <span className="text-[10px] muted ml-1 opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
                          )}
                        </span>
                        <span className="text-[11px] muted font-medium block">
                          remaining of {litres(day.capacity)}
                        </span>
                        <span className="text-[10px] text-primary font-semibold block mt-0.5">
                          {litres(day.reserved)} reserved ({day.utilization}%)
                        </span>
                      </div>
                    )}
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
                      <span className="font-bold text-ink">📦 {dayOrders.orders.length} order(s)</span>
                      <span className="muted">📍 {dayOrders.pickupCount} pickup · 🚚 {dayOrders.deliveryCount} delivery</span>
                    </div>
                  ) : day.isUnplanned ? (
                    <span className="text-[11px] text-slate-500 italic block">No capacity set for this date</span>
                  ) : (
                    <span className="text-[11px] muted italic block">No orders yet</span>
                  )}

                  {day.freezeReason && (
                    <span className="text-[10px] text-amber-900 bg-amber-100 p-1.5 rounded font-medium block mt-1">
                      ⚠️ {day.freezeReason}
                    </span>
                  )}
                </div>

                {/* Card Action Controls */}
                <div
                  className="flex flex-wrap items-center justify-between gap-1.5 border-t border-line/60 pt-2 text-xs min-w-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {day.dayRows[0] && !day.isPast ? (
                    <>
                      {/* Emergency Freeze Toggle */}
                      {canSoldOut && (
                        <button
                          type="button"
                          className={`text-[11px] font-bold py-0.5 px-1 rounded hover:bg-surface-muted transition-colors shrink-0 ${
                            day.soldOut ? "text-forest" : "text-berry"
                          }`}
                          onClick={() => setFreezingRow(day.dayRows[0])}
                        >
                          {day.soldOut ? "🔓 Reopen" : "🔒 Freeze"}
                        </button>
                      )}

                      {/* Quick Stepper Pills (+5L / -5L) */}
                      {canManage && (
                        <div className="flex items-center gap-1 shrink-0 ml-auto">
                          <button
                            type="button"
                            className="h-6 px-1.5 text-[10px] font-bold rounded-md bg-surface-muted hover:bg-paper border border-line text-ink transition-colors flex items-center justify-center min-w-[2rem]"
                            onClick={() => void bumpCapacity(day.dayRows[0], -5)}
                            title="Decrease capacity by 5L"
                          >
                            -5L
                          </button>
                          <button
                            type="button"
                            className="h-6 px-1.5 text-[10px] font-bold rounded-md bg-surface-muted hover:bg-paper border border-line text-ink transition-colors flex items-center justify-center min-w-[2rem]"
                            onClick={() => void bumpCapacity(day.dayRows[0], 5)}
                            title="Increase capacity by 5L"
                          >
                            +5L
                          </button>
                        </div>
                      )}
                    </>
                  ) : day.isUnplanned && canManage && !day.isPast ? (
                    <button
                      type="button"
                      className="btn text-[11px] font-bold py-1 px-2.5 w-full shadow-2xs"
                      onClick={() => setBatchPanelOpen(true)}
                    >
                      ＋ Set Capacity
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
                <div
                  key={day.date}
                  className={`p-3 rounded-xl border text-center flex flex-col justify-between gap-1 cursor-pointer transition-all hover:scale-105 ${
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
                </div>
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
                    <td className="p-3 font-bold text-ink ops-tabular">
                      {row.availability.businessDate} ({formatDay(row.availability.businessDate).weekday})
                    </td>
                    <td className="p-3 font-semibold text-ink">{row.product.nameFi}</td>
                    <td className="p-3 text-right font-bold text-ink ops-tabular">
                      {litres(row.availability.capacityMl)}
                    </td>
                    <td className="p-3 text-right font-semibold text-primary ops-tabular">
                      {litres(row.availability.reservedMl)}
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-700 ops-tabular">
                      {litres(remainingLitres)}
                    </td>
                    <td className="p-3 text-center font-bold ops-tabular">{row.utilization}%</td>
                    <td className="p-3 text-center">
                      <AdminStatusBadge
                        status={row.soldOut ? "CANCELLED" : row.utilization >= 75 ? "CAPACITY_NEAR_LIMIT" : "CONFIRMED"}
                        label={row.soldOut ? "Sold out" : row.utilization >= 75 ? "Near limit" : "Open"}
                      />
                    </td>
                    {canManage && (
                      <td className="p-3 text-right">
                        <AdminRowActionMenu
                          items={[
                            {
                              id: "edit-capacity",
                              label: "Edit Capacity",
                              icon: <IconPencil />,
                              onClick: () => setEditing(row),
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
          canSoldOut={canSoldOut}
          onClose={() => setInspectingDate(null)}
          onIncreaseCapacity={(addLitres) => {
            if (inspectedDayRow) void bumpCapacity(inspectedDayRow, addLitres);
          }}
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
          <form className="admin-dialog card availability-dialog" onSubmit={(event) => void saveAvailability(event)}>
            <p className="eyebrow">DATE CAPACITY CONTROL</p>
            <h2>{editing.product.nameFi} · {editing.availability.businessDate}</h2>

            <label className="field">
              <span>Capacity (Litres) *</span>
              <input
                name="capacityLitres"
                type="number"
                min={editing.availability.reservedMl / 1000}
                step="0.1"
                defaultValue={editing.availability.capacityMl / 1000}
                required
              />
            </label>

            <label className="field-checkbox">
              <input name="manualSoldOut" type="checkbox" defaultChecked={editing.availability.manualSoldOut} />
              <span>Manually freeze date (Emergency Lock)</span>
            </label>

            <label className="field">
              <span>Reason for freeze</span>
              <input name="reason" defaultValue={editing.availability.manualSoldOutReason ?? ""} placeholder="Rain / Storm / Crop Shortage..." />
            </label>

            <div className="admin-dialog-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn" type="submit">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
