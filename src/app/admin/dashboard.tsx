"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminLoadingState, AdminStatusBadge } from "./presentation";

type Dashboard = {
  businessDate: string;
  asOf: string;
  unreadNotifications: number;
  attentionCount: number;
  overdueNew: Array<{ id: string; publicReference: string; customerName: string; createdAt: string; ageMinutes: number }>;
  counts: Record<string, number>;
  fulfillment: { completed: number; due: number; rate: number };
  attention: Array<{ id: string; orderId: string; publicReference: string; customerName: string; fulfillmentDate: string; status: string; label: string; severity: "urgent" | "attention" }>;
  activity: Array<{ id: string; actor: string; action: string; entityType: string; entityId: string; reference: string | null; createdAt: string }>;
  capacitySummary: Array<{ date: string; capacityLitres: number; reservedLitres: number; remainingLitres: number }>;
  capacity: Array<{ date: string; productNameFi: string; capacityLitres: number; reservedLitres: number; remainingLitres: number; soldOut: boolean }>;
};

const pipeline = [
  ["new", "New orders", "Incoming reservations", "NEEDS_CONFIRMATION"],
  ["confirmed", "Confirmed", "Customer contacted", "CONFIRMED"],
  ["picking", "Picking", "Harvest in progress", "PICKING"],
  ["ready", "Ready", "Pickup or delivery", "READY"],
  ["completed", "Completed", "Handed over", "ALL"],
] as const;

export function DashboardModule() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Dashboard unavailable");
      setData(body.data); setError("");
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Dashboard unavailable"); }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => { if (!document.hidden) void load(true); }, 30_000);
    const visible = () => { if (!document.hidden) void load(true); };
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); document.removeEventListener("visibilitychange", visible); };
  }, [load]);

  if (error && !data) return <section className="shell py-6"><p className="card" role="alert">{error}</p></section>;
  if (!data) return <section className="shell py-6"><AdminLoadingState label="Loading operations overview…" /></section>;
  return <section id="dashboard" className="shell py-6">
    <div className="admin-page-header"><div><p className="eyebrow">METSÄNILO OPERATIONS</p><h1>Today at a glance</h1><p className="admin-page-lede">Urgent work first, then fulfillment progress and harvest capacity.</p></div><div className="admin-page-meta"><span>Today · {data.businessDate}</span><small>Updated {new Date(data.asOf).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })} · {data.unreadNotifications} unread</small><button className="text-button" type="button" disabled={refreshing} onClick={() => void load()}>{refreshing ? "Refreshing…" : "Refresh"}</button></div></div>
    {error && <p className="admin-feedback admin-feedback-warning" role="status">Could not refresh. Showing the last successful snapshot.</p>}
    {data.attentionCount > 0 && <div className="dashboard-alert dashboard-alert-danger mt-5" role="alert"><div><strong>{data.attentionCount} order{data.attentionCount === 1 ? "" : "s"} require attention</strong><p>{data.overdueNew.length > 0 ? `${data.overdueNew.length} have been NEW for more than 15 minutes.` : "Review incomplete fulfillment, payment, and delivery work."}</p></div><Link className="btn dashboard-alert-btn" href="/admin/orders?view=triage">Open triage queue</Link></div>}
    <div className="dashboard-hero-metrics mt-5">
      <Link className="card dashboard-fulfillment" href="/admin/orders?view=today"><div className="dashboard-progress-ring" style={{ "--progress": `${data.fulfillment.rate * 3.6}deg` } as React.CSSProperties}><strong>{data.fulfillment.rate}%</strong></div><div><span>Today&apos;s fulfillment</span><strong className="ops-tabular">{data.fulfillment.completed} / {data.fulfillment.due} complete</strong><small>Open today&apos;s queue</small></div></Link>
      {data.capacitySummary.map((summary, index) => <Link className="card dashboard-capacity-summary" href="/admin/availability" key={summary.date}><span>{index === 0 ? "Today" : "Tomorrow"} · {summary.date}</span><strong className="ops-tabular">{summary.remainingLitres} L remaining</strong><small className="ops-tabular">{summary.reservedLitres} L reserved of {summary.capacityLitres} L</small></Link>)}
    </div>
    <div className="dashboard-pipeline mt-5">{pipeline.map(([key, label, description, filter]) => <Link className="dashboard-metric card" href={filter === "NEEDS_CONFIRMATION" ? "/admin/orders?view=needs_confirmation" : filter === "ALL" ? "/admin/orders?view=today" : `/admin/orders?view=all&status=${filter}`} key={key}><div className="dashboard-metric-icon" aria-hidden="true">{key === "new" ? "!" : key === "completed" ? "✓" : "→"}</div><div><p className="text-sm text-slate-600">{label}</p><p className="dashboard-number ops-tabular">{data.counts[key] ?? 0}</p><p className="text-xs text-slate-500">{description}</p></div></Link>)}</div>
    <div className="dashboard-operations-grid mt-5">
      <section className="card"><div className="section-inline-heading"><div><p className="admin-section-kicker">Action required now</p><h2>Exception queue</h2><p className="admin-section-description">Ordered by operational risk and waiting time.</p></div><Link className="btn btn-secondary" href="/admin/orders?view=triage">View all</Link></div><div className="dashboard-attention-list">{data.attention.map((item) => <Link href={`/admin/orders/${item.orderId}`} key={item.id}><span className={`attention-marker ${item.severity}`} aria-hidden="true" /><span><strong className="ops-tabular">{item.publicReference}</strong><small>{item.customerName} · {item.label}</small></span><span><AdminStatusBadge status={item.status} /><small className="ops-tabular">{item.fulfillmentDate}</small></span></Link>)}{data.attention.length === 0 && <p className="dashboard-clear-state">✓ No urgent or incomplete orders.</p>}</div></section>
      <section className="card"><div className="section-inline-heading"><div><p className="admin-section-kicker">Live audit</p><h2>Recent activity</h2><p className="admin-section-description">Latest recorded changes across operations.</p></div></div><ol className="dashboard-activity">{data.activity.map((event) => <li key={event.id}><span className="admin-timeline-dot" aria-hidden="true" /><div><strong>{event.action.replaceAll(".", " · ").replaceAll("_", " ")}</strong><small>{event.actor} · <time dateTime={event.createdAt}>{relativeTime(event.createdAt)}</time>{event.reference && <> · <Link href={`/admin/orders/${event.entityId}`}>{event.reference}</Link></>}</small></div></li>)}{data.activity.length === 0 && <li>No activity recorded.</li>}</ol></section>
    </div>
    <section className="card mt-5"><div className="section-inline-heading"><div><p className="admin-section-kicker">Harvest planning</p><h2>Capacity · next 14 days</h2><p className="admin-section-description">Reserved versus available litres by product.</p></div><Link className="btn btn-secondary" href="/admin/availability">Manage</Link></div><div className="dashboard-capacity-grid mt-4">{data.capacity.map((row) => <div className="capacity-row" key={`${row.productNameFi}-${row.date}`}><div className="flex justify-between gap-3 text-sm"><strong>{row.productNameFi}</strong><span className={row.soldOut ? "status-pill ops-status-danger" : "pill ops-tabular"}>{row.soldOut ? "Sold out" : row.date}</span></div><div className="capacity-track" role="progressbar" aria-label={`${row.productNameFi} ${row.date}`} aria-valuenow={row.reservedLitres} aria-valuemin={0} aria-valuemax={row.capacityLitres}><span style={{ width: `${Math.min(100, row.reservedLitres / Math.max(row.capacityLitres, 1) * 100)}%` }} /></div><p className="text-xs text-slate-600 ops-tabular">{row.reservedLitres} L reserved · {row.remainingLitres} L remaining</p></div>)}</div></section>
  </section>;
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(value).toLocaleDateString("fi-FI");
}
