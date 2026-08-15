"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { AvailabilityWorkspace } from "@/domain/availability";
import { AdminConfirmDialog, AdminEmptyState, AdminNotice, AdminPageHeader, AdminStatusBadge } from "../presentation";

type Workspace = AvailabilityWorkspace;
type AvailabilityRow = Workspace["rows"][number];
type QueueItem = Workspace["queues"]["picking"][number];

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

function previewDates(start: string, end: string, frequency: string, weekdays: number[]) {
  if (!start || !end || start > end) return [];
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const day = new Date(`${cursor}T12:00:00Z`).getUTCDay();
    const include = frequency === "DAY" || (frequency === "WEEK" && dates.length % 7 === 0) || frequency === "CUSTOM" && weekdays.includes(day);
    if (include) dates.push(cursor);
  }
  return dates;
}

export function AvailabilityWorkspace({ initialWorkspace, canManage, canSoldOut }: { initialWorkspace: Workspace; canManage: boolean; canSoldOut: boolean }) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [productFilter, setProductFilter] = useState("ALL");
  const [view, setView] = useState("ALL");
  const [editing, setEditing] = useState<AvailabilityRow | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchStart, setBatchStart] = useState(initialWorkspace.dates[0] ?? "");
  const [batchEnd, setBatchEnd] = useState(initialWorkspace.dates[6] ?? "");
  const [batchFrequency, setBatchFrequency] = useState("CUSTOM");
  const [batchWeekdays, setBatchWeekdays] = useState<number[]>([1, 3, 5]);
  const [confirm, setConfirm] = useState<AvailabilityRow | null>(null);
  const [lockOnOpen, setLockOnOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const rows = useMemo(() => workspace.rows.filter((row) => {
    if (productFilter !== "ALL" && row.product.id !== productFilter) return false;
    if (view === "SOLD_OUT") return row.soldOut;
    if (view === "NEAR") return row.nearCapacity && !row.soldOut;
    if (view === "ATTENTION") return row.soldOut || row.nearCapacity;
    return true;
  }), [workspace.rows, productFilter, view]);

  async function saveAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const manualSoldOut = lockOnOpen || form.get("manualSoldOut") === "on";
    const reason = String(form.get("reason") ?? "").trim();
    if (manualSoldOut && reason.length < 2) return setError("A sold-out reason is required.");
    const response = await fetch(`/api/admin/availability/${editing.availability.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: editing.availability.version, capacityMl: Math.round(Number(form.get("capacityLitres")) * 1000), manualSoldOut, soldOutReason: reason || undefined }) });
    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Could not update availability.");
    setMessage("Availability updated."); setEditing(null); setLockOnOpen(false); window.location.reload();
  }

  async function planBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const frequency = String(form.get("frequency"));
    const startDate = String(form.get("startDate")); const endDate = String(form.get("endDate"));
    const weekdays = form.getAll("weekday").map(Number);
    const dates = previewDates(startDate, endDate, frequency, weekdays);
    if (!dates.length) return setError("Choose a valid date range and at least one weekday.");
    const response = await fetch("/api/admin/availability/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: String(form.get("productId")), frequency: frequency === "CUSTOM" ? "CUSTOM" : frequency, startDate, endDate, dates: frequency === "CUSTOM" ? dates : undefined, capacityMl: Math.round(Number(form.get("capacityLitres")) * 1000) }) });
    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Could not plan availability.");
    setMessage(`${dates.length} date(s) planned.`); setBatchOpen(false); window.location.reload();
  }

  const dateCards = workspace.dates.map((date) => {
    const dayRows = rows.filter((row) => row.availability.businessDate === date);
    const capacity = dayRows.reduce((sum, row) => sum + row.availability.capacityMl, 0);
    const reserved = dayRows.reduce((sum, row) => sum + row.availability.reservedMl, 0);
    const utilization = capacity ? Math.round((reserved / capacity) * 100) : 0;
    const soldOut = dayRows.some((row) => row.soldOut);
    return { date, dayRows, capacity, reserved, utilization, soldOut };
  });

  return <main className="shell py-8 availability-workspace">
    <AdminPageHeader eyebrow="HARVEST PLANNING" title="Capacity & availability" description="Plan the next seven harvest days and keep customer intake aligned with what the team can pick." actions={canManage ? <button className="btn" type="button" onClick={() => setBatchOpen(true)}>＋ Batch plan dates</button> : undefined} />
    {message && <AdminNotice tone="success" live>{message}</AdminNotice>}{error && <AdminNotice tone="error" live>{error}</AdminNotice>}
    <section className="availability-controls card" aria-label="Availability filters"><div className="availability-view-tabs">{[["ALL", "Next 7 days"], ["NEAR", "Near capacity"], ["SOLD_OUT", "Sold out"], ["ATTENTION", "Needs attention"]].map(([key, label]) => <button key={key} type="button" className={`btn ${view === key ? "" : "btn-secondary"}`} onClick={() => setView(key)}>{label}</button>)}</div><label className="field"><span>Product</span><select value={productFilter} onChange={(event) => setProductFilter(event.target.value)}><option value="ALL">All products</option>{workspace.products.map((product) => <option key={product.id} value={product.id}>{product.nameFi}</option>)}</select></label></section>
    <section className="availability-board" aria-label="Seven day availability board">{dateCards.map((day) => { const tone = fillTone(day.utilization, day.soldOut); return <article className={`availability-day-card availability-day-${tone}`} key={day.date}><header><div><p className="admin-section-kicker">{formatDay(day.date).weekday}</p><h2>{formatDay(day.date).short}</h2></div><AdminStatusBadge status={day.soldOut ? "CANCELLED" : day.utilization >= 75 ? "CAPACITY_NEAR_LIMIT" : "CONFIRMED"} label={day.soldOut ? "Sold out" : day.utilization >= 75 ? "Near limit" : "Open"} /></header><div className="availability-day-metrics"><strong>{litres(Math.max(0, day.capacity - day.reserved))}</strong><span>remaining</span><small>{litres(day.reserved)} / {litres(day.capacity)} reserved</small></div><div className="availability-fill-track"><span style={{ width: `${Math.min(100, day.utilization)}%` }} /></div>{day.dayRows.length === 0 ? <AdminEmptyState title="No plan" description="No availability is planned for this date." /> : <div className="availability-product-list">{day.dayRows.map((row) => <div className="availability-product-row" key={row.availability.id}><div><strong>{row.product.nameFi}</strong><small>{litres(row.remainingMl)} left · {row.utilization}% reserved</small>{row.packages.length > 0 && <div className="availability-package-list">{row.packages.map((pkg) => <span key={pkg.id}>{litres(pkg.volumeMl)} · {pkg.availableUnits}×{pkg.isDefault ? " · default" : ""}</span>)}</div>}{row.availability.manualSoldOutReason && <small className="availability-reason">{row.availability.manualSoldOutReason}</small>}</div><div className="availability-row-actions">{canManage && <button className="btn btn-secondary" type="button" onClick={() => setEditing(row)}>Edit</button>}{canSoldOut && <button className="btn btn-secondary" type="button" onClick={() => row.soldOut ? setEditing(row) : setConfirm(row)}>{row.soldOut ? "Reopen" : "Lock"}</button>}</div></div>)}</div>}</article>; })}</section>
    <section className="availability-queues"><div className="admin-section-heading"><div><p className="admin-section-kicker">FULFILMENT QUEUES</p><h2>What needs attention next</h2></div></div><div className="availability-queue-grid">{([['picking', 'Picking', workspace.queues.picking], ['pickup', 'Pickup ready', workspace.queues.pickup], ['delivery', 'Delivery queue', workspace.queues.delivery]] as Array<[string, string, QueueItem[]]>).map(([key, title, queue]) => <article className="card availability-queue-card" key={key}><div className="flex items-center justify-between gap-2"><h3>{title}</h3><strong>{queue.length}</strong></div>{queue.length ? <ul>{queue.slice(0, 4).map((item) => <li key={item.id}><a href={`/admin/orders/${item.id}`}>{item.publicReference}</a><span>{item.customerName} · {item.quantity}×</span></li>)}</ul> : <p className="text-sm">No orders in this queue.</p>}<a className="btn btn-secondary" href={`/admin/orders?view=${key}`}>Open orders</a></article>)}</div></section>
    {editing && <div className="admin-dialog-backdrop"><form className="admin-dialog card availability-dialog" onSubmit={(event) => void saveAvailability(event)}><p className="eyebrow">DATE CONTROL</p><h2>{editing.product.nameFi} · {editing.availability.businessDate}</h2><label className="field"><span>Capacity (litres) *</span><input name="capacityLitres" type="number" min={editing.availability.reservedMl / 1000} step="0.001" defaultValue={editing.availability.capacityMl / 1000} required /></label><label className="field"><span>Sold-out reason</span><input name="reason" defaultValue={editing.availability.manualSoldOutReason ?? ""} placeholder="e.g. Rain / no pick" /></label><label className="flex items-center gap-2"><input name="manualSoldOut" type="checkbox" defaultChecked={editing.availability.manualSoldOut || lockOnOpen} disabled={lockOnOpen} /> Lock customer intake for this product/date</label><div className="profile-actions"><button className="btn btn-secondary" type="button" onClick={() => { setEditing(null); setLockOnOpen(false); }}>Cancel</button><button className="btn" type="submit">Save availability</button></div></form></div>}
    {confirm && <AdminConfirmDialog open title={`Lock ${confirm.product.nameFi}?`} description="Customers will no longer be able to reserve this product on the selected date. A reason is required." confirmLabel="Continue to lock" destructive onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); setLockOnOpen(true); setEditing(confirm); }} />}
    {batchOpen && <div className="admin-dialog-backdrop"><form className="admin-dialog card availability-dialog" onSubmit={(event) => void planBatch(event)}><p className="eyebrow">BATCH PLANNER</p><h2>Plan recurring harvest dates</h2><label className="field"><span>Product *</span><select name="productId" required>{workspace.products.filter((product) => product.active).map((product) => <option key={product.id} value={product.id}>{product.nameFi}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2"><label className="field"><span>Start *</span><input name="startDate" type="date" value={batchStart} onChange={(event) => setBatchStart(event.target.value)} required /></label><label className="field"><span>End *</span><input name="endDate" type="date" value={batchEnd} onChange={(event) => setBatchEnd(event.target.value)} required /></label></div><label className="field"><span>Pattern *</span><select name="frequency" value={batchFrequency} onChange={(event) => setBatchFrequency(event.target.value)}><option value="CUSTOM">Selected weekdays</option><option value="DAY">Every day</option><option value="WEEK">Every 7 days</option></select></label><fieldset className="weekday-picker"><legend>Weekdays for selected pattern</legend>{[[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]].map(([value, label]) => <label key={value as number}><input name="weekday" type="checkbox" value={value as number} checked={batchWeekdays.includes(value as number)} onChange={(event) => setBatchWeekdays((current) => event.target.checked ? [...current, value as number] : current.filter((day) => day !== value))} /> {label}</label>)}</fieldset><div className="batch-preview"><strong>Preview · {previewDates(batchStart, batchEnd, batchFrequency, batchWeekdays).length} date(s)</strong><span>{previewDates(batchStart, batchEnd, batchFrequency, batchWeekdays).join(" · ") || "Choose dates to preview"}</span></div><label className="field"><span>Capacity (litres) *</span><input name="capacityLitres" type="number" min="0" step="0.001" required /></label><p className="text-sm">The server will validate product windows, existing reservations and optimistic versions before saving.</p><div className="profile-actions"><button className="btn btn-secondary" type="button" onClick={() => setBatchOpen(false)}>Cancel</button><button className="btn" type="submit">Plan dates</button></div></form></div>}
  </main>;
}
