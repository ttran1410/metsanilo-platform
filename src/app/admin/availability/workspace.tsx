"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { AvailabilityWorkspace } from "@/domain/availability";
import { AdminEmptyState, AdminNotice, AdminPageHeader, AdminStatusBadge } from "../presentation";
import { DateInspectorDrawer } from "./date-inspector-drawer";
import { FreezeModal } from "./freeze-modal";

type Workspace = AvailabilityWorkspace;
type AvailabilityRow = Workspace["rows"][number];
type QueueItem = Workspace["queues"]["picking"][number];
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

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function previewDates(start: string, end: string, frequency: string, weekdays: number[]) {
  if (!start || !end || start > end) return [];
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const day = new Date(`${cursor}T12:00:00Z`).getUTCDay();
    const include =
      frequency === "DAY" ||
      (frequency === "WEEK" && dates.length % 7 === 0) ||
      (frequency === "CUSTOM" && weekdays.includes(day));
    if (include) dates.push(cursor);
  }
  return dates;
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
  const [viewMode, setViewMode] = useState<ViewMode>("WEEK");
  const [productFilter, setProductFilter] = useState("ALL");
  const [viewFilter, setViewFilter] = useState("ALL");

  const [currentStartDate, setCurrentStartDate] = useState(initialWorkspace.dates[0] ?? todayStr());
  const [inspectingDate, setInspectingDate] = useState<string | null>(null);
  const [freezingRow, setFreezingRow] = useState<AvailabilityRow | null>(null);

  const [editing, setEditing] = useState<AvailabilityRow | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchStart, setBatchStart] = useState(initialWorkspace.dates[0] ?? todayStr());
  const [batchEnd, setBatchEnd] = useState(initialWorkspace.dates[6] ?? addDays(todayStr(), 7));
  const [batchFrequency, setBatchFrequency] = useState("CUSTOM");
  const [batchWeekdays, setBatchWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function fetchWorkspaceForDates(start: string, days = 7) {
    try {
      const query = new URLSearchParams({
        startDate: start,
        days: days.toString(),
        productId: productFilter,
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

  function handleNavigateWeek(daysDelta: number) {
    const nextStart = addDays(currentStartDate, daysDelta);
    setCurrentStartDate(nextStart);
    void fetchWorkspaceForDates(nextStart, viewMode === "MONTH" ? 30 : 7);
  }

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    void fetchWorkspaceForDates(currentStartDate, mode === "MONTH" ? 30 : 7);
  }

  const rows = useMemo(() => {
    return workspace.rows.filter((row) => {
      if (productFilter !== "ALL" && row.product.id !== productFilter) return false;
      if (viewFilter === "SOLD_OUT") return row.soldOut;
      if (viewFilter === "NEAR") return row.nearCapacity && !row.soldOut;
      if (viewFilter === "ATTENTION") return row.soldOut || row.nearCapacity;
      return true;
    });
  }, [workspace.rows, productFilter, viewFilter]);

  // Daily cards calculation
  const dateCards = useMemo(() => {
    return workspace.dates.map((date) => {
      const dayRows = rows.filter((row) => row.availability.businessDate === date);
      const capacity = dayRows.reduce((sum, row) => sum + row.availability.capacityMl, 0);
      const reserved = dayRows.reduce((sum, row) => sum + row.availability.reservedMl, 0);
      const utilization = capacity ? Math.round((reserved / capacity) * 100) : 0;
      const soldOut = dayRows.some((row) => row.soldOut);
      const freezeReason = dayRows.find((r) => r.availability.manualSoldOutReason)?.availability.manualSoldOutReason;
      return { date, dayRows, capacity, reserved, utilization, soldOut, freezeReason };
    });
  }, [workspace.dates, rows]);

  // Overall Week Capacity Summary
  const weekCapacityTotalMl = useMemo(() => dateCards.reduce((sum, d) => sum + d.capacity, 0), [dateCards]);
  const weekReservedTotalMl = useMemo(() => dateCards.reduce((sum, d) => sum + d.reserved, 0), [dateCards]);
  const weekUtilization = weekCapacityTotalMl > 0 ? Math.round((weekReservedTotalMl / weekCapacityTotalMl) * 100) : 0;

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
    void fetchWorkspaceForDates(currentStartDate, viewMode === "MONTH" ? 30 : 7);
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
    void fetchWorkspaceForDates(currentStartDate, viewMode === "MONTH" ? 30 : 7);
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
        soldOutReason: reason || undefined,
      }),
    });
    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Could not update availability.");
    setMessage("Availability updated.");
    setEditing(null);
    void fetchWorkspaceForDates(currentStartDate, viewMode === "MONTH" ? 30 : 7);
  }

  async function planBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const frequency = String(form.get("frequency"));
    const startDate = String(form.get("startDate"));
    const endDate = String(form.get("endDate"));
    const weekdays = form.getAll("weekday").map(Number);
    const dates = previewDates(startDate, endDate, frequency, weekdays);

    if (!dates.length) return setError("Choose a valid date range and at least one weekday.");

    const response = await fetch("/api/admin/availability/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productId: String(form.get("productId")),
        frequency: frequency === "CUSTOM" ? "CUSTOM" : frequency,
        startDate,
        endDate,
        dates: frequency === "CUSTOM" ? dates : undefined,
        capacityMl: Math.round(Number(form.get("capacityLitres")) * 1000),
      }),
    });
    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Could not plan availability.");
    setMessage(`${dates.length} date(s) planned.`);
    setBatchOpen(false);
    void fetchWorkspaceForDates(currentStartDate, viewMode === "MONTH" ? 30 : 7);
  }

  const inspectedOrdersData =
    inspectingDate && workspace.ordersByDate
      ? (workspace.ordersByDate as Record<string, any>)[inspectingDate]
      : undefined;

  const inspectedDayRow = inspectingDate ? rows.find((r) => r.availability.businessDate === inspectingDate) : undefined;
  const inspectedProductName = inspectedDayRow?.product.nameFi ?? "All Products";

  return (
    <main className="shell py-8 availability-workspace flex flex-col gap-4">
      <AdminPageHeader
        eyebrow="HARVEST PLANNING"
        title="Capacity &amp; Availability Scheduler"
        description="Manage perishable wild produce capacity, emergency weather locks, and customer reservation intake."
        actions={
          canManage ? (
            <button className="btn" type="button" onClick={() => setBatchOpen(true)}>
              ＋ Batch Plan Dates
            </button>
          ) : undefined
        }
      />

      {message && <AdminNotice tone="success" live>{message}</AdminNotice>}
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      {/* TOP CONTROLS & MULTI-VIEW SELECTOR BAR */}
      <section className="card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* View Mode Tabs */}
          <div className="flex items-center gap-1 bg-surface-muted p-1 rounded-xl border border-line">
            {[
              { key: "WEEK", label: "📅 Week Timeline" },
              { key: "MONTH", label: "📆 Month Heatmap" },
              { key: "TABLE", label: "📋 Dense Table" },
            ].map((mode) => (
              <button
                key={mode.key}
                type="button"
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  viewMode === mode.key
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-ink/70 hover:text-ink hover:bg-surface"
                }`}
                onClick={() => handleViewModeChange(mode.key as ViewMode)}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Product Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider muted">Product:</span>
            <div className="flex items-center gap-1 overflow-x-auto text-xs">
              <button
                type="button"
                className={`px-2.5 py-1 rounded-lg border font-medium ${
                  productFilter === "ALL" ? "bg-primary text-on-primary border-primary font-bold" : "bg-surface text-ink border-line"
                }`}
                onClick={() => setProductFilter("ALL")}
              >
                All Products
              </button>

              {workspace.products.map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  className={`px-2.5 py-1 rounded-lg border font-medium ${
                    productFilter === prod.id ? "bg-primary text-on-primary border-primary font-bold" : "bg-surface text-ink border-line"
                  }`}
                  onClick={() => setProductFilter(prod.id)}
                >
                  {prod.nameFi}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation & Summary Line */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line text-xs">
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-secondary text-xs py-1 px-2.5" onClick={() => handleNavigateWeek(-7)}>
              ◄ Previous Week
            </button>
            <span className="font-bold text-ink">
              {workspace.startDate} – {workspace.endDate}
            </span>
            <button type="button" className="btn btn-secondary text-xs py-1 px-2.5" onClick={() => handleNavigateWeek(7)}>
              Next Week ►
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs muted font-medium">
            <span>Total Window Capacity: <strong className="text-ink ops-tabular">{litres(weekCapacityTotalMl)}</strong></span>
            <span>Reserved Orders: <strong className="text-primary ops-tabular">{litres(weekReservedTotalMl)} ({weekUtilization}%)</strong></span>
            <span className="text-emerald-700 font-semibold">Remaining to sell: {litres(Math.max(0, weekCapacityTotalMl - weekReservedTotalMl))}</span>
          </div>
        </div>
      </section>

      {/* VIEW MODE 1: WEEK TIMELINE VIEW (DEFAULT) */}
      {viewMode === "WEEK" && (
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {dateCards.map((day) => {
            const tone = fillTone(day.utilization, day.soldOut);
            const remainingLitres = Math.max(0, day.capacity - day.reserved);
            const dayOrders = workspace.ordersByDate
              ? (workspace.ordersByDate as Record<string, any>)[day.date]
              : undefined;


            return (
              <article
                key={day.date}
                className={`card p-2.5 sm:p-3 flex flex-col justify-between gap-3 border transition-colors cursor-pointer hover:border-primary min-w-0 ${
                  day.soldOut
                    ? "bg-slate-100/70 border-slate-300"
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
                      status={day.soldOut ? "CANCELLED" : day.utilization >= 75 ? "CAPACITY_NEAR_LIMIT" : "CONFIRMED"}
                      label={day.soldOut ? "Sold Out" : day.utilization >= 75 ? `${day.utilization}% Near` : `${day.utilization}%`}
                    />
                  </div>

                  {/* Capacity Metrics */}
                  <div className="my-2.5">
                    <span className="text-xl font-bold text-ink ops-tabular block">{litres(remainingLitres)}</span>
                    <span className="text-[11px] muted font-medium block">
                      remaining of {litres(day.capacity)}
                    </span>
                    <span className="text-[10px] text-primary font-semibold block mt-0.5">
                      {litres(day.reserved)} reserved ({day.utilization}%)
                    </span>
                  </div>

                  {/* Visual Utilization Bar */}
                  <div className="w-full h-2.5 rounded-full bg-line/60 overflow-hidden p-0.5 mb-2">
                    <div
                      className={`h-full rounded-full transition-all ${
                        day.soldOut
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
                  {day.dayRows[0] && (
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
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* VIEW MODE 2: MONTH CALENDAR HEATMAP */}
      {viewMode === "MONTH" && (
        <section className="card p-4 md:p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <span className="eyebrow">MONTHLY SEASON OVERVIEW</span>
              <h3 className="text-base font-bold text-ink">30-Day Capacity Heatmap</h3>
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
                  className={`p-3 rounded-xl border text-center flex flex-col justify-between gap-1 cursor-pointer transition-transform hover:scale-105 ${
                    day.soldOut
                      ? "bg-slate-200 text-slate-800 border-slate-300"
                      : tone === "danger"
                      ? "bg-rose-600 text-on-primary border-rose-700 shadow-sm"
                      : tone === "warning"
                      ? "bg-amber-500 text-on-primary border-amber-600 shadow-sm"
                      : "bg-emerald-600 text-on-primary border-emerald-700 shadow-sm"
                  }`}
                  onClick={() => setInspectingDate(day.date)}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                    {formatDay(day.date).weekday} {formatDay(day.date).short}
                  </span>

                  <span className="text-lg font-bold ops-tabular">{litres(remainingLitres)}</span>
                  <span className="text-[10px] font-semibold opacity-90">
                    {day.soldOut ? "Locked" : `${day.utilization}% Reserved`}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* VIEW MODE 3: DENSE TABLE VIEW */}
      {viewMode === "TABLE" && (
        <section className="card p-4 overflow-x-auto">
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
              {rows.map((row) => {
                const tone = fillTone(row.utilization, row.soldOut);
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
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-secondary text-xs py-1 px-2"
                            onClick={() => setEditing(row)}
                          >
                            Edit
                          </button>
                          {canSoldOut && (
                            <button
                              type="button"
                              className="text-button text-xs text-danger"
                              onClick={() => setFreezingRow(row)}
                            >
                              {row.soldOut ? "Reopen" : "Lock"}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* FULFILLMENT QUEUES SUMMARY */}
      <section className="availability-queues mt-2">
        <div className="admin-section-heading">
          <div>
            <p className="admin-section-kicker">FULFILMENT QUEUES</p>
            <h2>Active Order Pipeline</h2>
          </div>
        </div>
        <div className="availability-queue-grid">
          {([
            ["picking", "Picking Queue", workspace.queues.picking],
            ["pickup", "Pickup Ready Queue", workspace.queues.pickup],
            ["delivery", "Delivery Dispatch Queue", workspace.queues.delivery],
          ] as Array<[string, string, QueueItem[]]>).map(([key, title, queue]) => (
            <article className="card availability-queue-card p-4" key={key}>
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
              <a className="btn btn-secondary text-xs mt-2 text-center" href={`/admin/orders?view=${key}`}>
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

            <label className="field">
              <span>Sold-out / Lock reason</span>
              <input
                name="reason"
                defaultValue={editing.availability.manualSoldOutReason ?? ""}
                placeholder="e.g. Heavy Rain / Pickers unavailable"
              />
            </label>

            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                name="manualSoldOut"
                type="checkbox"
                defaultChecked={editing.availability.manualSoldOut}
              />
              <span>🔒 Lock public customer intake for this date</span>
            </label>

            <div className="profile-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn" type="submit">
                Save availability
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RECURRING BATCH PLANNER MODAL */}
      {batchOpen && (
        <div className="admin-dialog-backdrop">
          <form className="admin-dialog card availability-dialog" onSubmit={(event) => void planBatch(event)}>
            <p className="eyebrow">BATCH PLANNER</p>
            <h2>Plan Recurring Harvest Dates</h2>

            <label className="field">
              <span>Product</span>
              <select name="productId" required>
                {workspace.products
                  .filter((product) => product.active)
                  .map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.nameFi}
                    </option>
                  ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field">
                <span>Start Date</span>
                <input
                  name="startDate"
                  type="date"
                  value={batchStart}
                  onChange={(event) => setBatchStart(event.target.value)}
                  onClick={(event) => event.currentTarget.showPicker?.()}
                  required
                />
              </label>

              <label className="field">
                <span>End Date</span>
                <input
                  name="endDate"
                  type="date"
                  value={batchEnd}
                  onChange={(event) => setBatchEnd(event.target.value)}
                  onClick={(event) => event.currentTarget.showPicker?.()}
                  required
                />
              </label>
            </div>

            <label className="field">
              <span>Pattern</span>
              <select
                name="frequency"
                value={batchFrequency}
                onChange={(event) => setBatchFrequency(event.target.value)}
              >
                <option value="CUSTOM">Selected Weekdays</option>
                <option value="DAY">Every Day</option>
                <option value="WEEK">Every 7 Days</option>
              </select>
            </label>

            <fieldset className="weekday-picker">
              <legend>Weekdays for Selected Pattern</legend>
              {[
                [1, "Mon"],
                [2, "Tue"],
                [3, "Wed"],
                [4, "Thu"],
                [5, "Fri"],
                [6, "Sat"],
                [0, "Sun"],
              ].map(([value, label]) => (
                <label key={value as number}>
                  <input
                    name="weekday"
                    type="checkbox"
                    value={value as number}
                    checked={batchWeekdays.includes(value as number)}
                    onChange={(event) =>
                      setBatchWeekdays((current) =>
                        event.target.checked ? [...current, value as number] : current.filter((day) => day !== value)
                      )
                    }
                  />{" "}
                  {label}
                </label>
              ))}
            </fieldset>

            <div className="batch-preview">
              <strong>Preview · {previewDates(batchStart, batchEnd, batchFrequency, batchWeekdays).length} date(s)</strong>
              <span>
                {previewDates(batchStart, batchEnd, batchFrequency, batchWeekdays).join(" · ") || "Choose dates to preview"}
              </span>
            </div>

            <label className="field">
              <span>Daily Harvest Capacity (Litres)</span>
              <input name="capacityLitres" type="number" min="0" step="0.1" required placeholder="e.g. 50" />
            </label>

            <div className="profile-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setBatchOpen(false)}>
                Cancel
              </button>
              <button className="btn" type="submit">
                🚀 Generate Harvest Dates
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
