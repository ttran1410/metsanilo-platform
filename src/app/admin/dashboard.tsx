"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminLoadingState } from "./presentation";

type Dashboard = {
  businessDate: string;
  asOf: string;
  unreadNotifications: number;
  overdueNew: Array<{ id: string; publicReference: string; customerName: string; createdAt: string; ageMinutes: number }>;
  actionableOrders: Array<{ id: string; publicReference: string; customerName: string; productNameFi: string; status: string; fulfillmentMethod: string; fulfillmentDate: string }>;
  counts: Record<string, number>;
  capacity: Array<{ date: string; productNameFi: string; capacityLitres: number; reservedLitres: number; remainingLitres: number; soldOut: boolean }>;
};

const pipeline = [
  ["new", "New orders", "Incoming reservations"],
  ["confirmed", "Confirmed", "Customer contacted"],
  ["picking", "Picking", "Harvest in progress"],
  ["ready", "Ready", "Pickup or delivery"],
  ["completed", "Completed", "Handed over"],
] as const;

export function DashboardModule() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => { void fetch("/api/admin/dashboard").then(async (response) => { const body = await response.json(); if (response.ok) setData(body.data); else setError(body.message ?? "Dashboard unavailable"); }); }, 0); return () => window.clearTimeout(timer); }, []);
  if (error) return <section className="shell py-6"><p className="card" role="alert">{error}</p></section>;
  if (!data) return <section className="shell py-6"><AdminLoadingState label="Loading operations overview…" /></section>;
  return <section id="dashboard" className="shell py-6">
    <div className="admin-page-header"><div><p className="eyebrow">METSÄNILO OPERATIONS</p><h1>Overview</h1><p className="admin-page-lede">Keep today&apos;s reservations, harvest capacity, and handovers moving.</p></div><div className="admin-page-meta"><span>Today · {data.businessDate}</span><small>Updated {new Date(data.asOf).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })} · {data.unreadNotifications} unread</small></div></div>
    {data.overdueNew.length > 0 && <div className="dashboard-alert mt-5" role="alert"><div><strong>Attention: {data.overdueNew.length} new order{data.overdueNew.length === 1 ? "" : "s"} over 15 minutes</strong><p>Contact the customer and confirm the reservation before the next fulfillment step.</p></div><Link className="btn dashboard-alert-btn" href="/admin/orders">Review orders</Link></div>}
    <div className="dashboard-pipeline mt-5">{pipeline.map(([key, label, description]) => <article className="dashboard-metric card" key={key}><div className="dashboard-metric-icon" aria-hidden="true">{key === "new" ? "!" : key === "completed" ? "✓" : "→"}</div><div><p className="text-sm text-slate-600">{label}</p><p className="dashboard-number">{data.counts[key] ?? 0}</p><p className="text-xs text-slate-500">{description}</p></div></article>)}<article className="dashboard-metric card dashboard-exception"><div className="dashboard-metric-icon" aria-hidden="true">!</div><div><p className="text-sm text-slate-600">Exceptions</p><p className="dashboard-number">{data.counts.exceptions ?? 0}</p><p className="text-xs text-slate-500">Needs review · Refunded: {data.counts.refunded ?? 0}</p></div></article></div>
    <div className="dashboard-grid mt-5"><section className="card"><div className="section-inline-heading"><div><p className="admin-section-kicker">Harvest planning</p><h3>Capacity · next 14 days</h3><p className="admin-section-description">Reserved versus available litres by product.</p></div><Link className="btn btn-secondary" href="/admin/availability">Manage</Link></div><div className="mt-4 grid gap-3">{data.capacity.map((row) => <div className="capacity-row" key={`${row.productNameFi}-${row.date}`}><div className="flex justify-between gap-3 text-sm"><strong>{row.productNameFi}</strong><span className={row.soldOut ? "pill pill-warning" : "pill"}>{row.soldOut ? "Sold out" : row.date}</span></div><div className="capacity-track" role="progressbar" aria-label={`${row.productNameFi} ${row.date}`} aria-valuenow={row.reservedLitres} aria-valuemin={0} aria-valuemax={row.capacityLitres}><span style={{ width: `${Math.min(100, row.reservedLitres / Math.max(row.capacityLitres, 1) * 100)}%` }} /></div><p className="text-xs text-slate-600">{row.reservedLitres} L reserved · {row.remainingLitres} L remaining</p></div>)}</div></section>
      <section className="card"><div className="section-inline-heading"><div><p className="admin-section-kicker">Next actions</p><h3>Actionable today</h3><p className="admin-section-description">Orders requiring an operational next step.</p></div><Link className="btn btn-secondary" href="/admin/orders">View all</Link></div><div className="mt-4 grid gap-2">{data.actionableOrders.length === 0 && <p className="text-sm text-slate-600">No actionable orders today.</p>}{data.actionableOrders.map((order) => <Link href="/admin/orders" className="actionable-order" key={order.id}><span><strong>{order.publicReference}</strong><br /><span className="text-sm">{order.customerName} · {order.productNameFi}</span></span><span className="pill">{order.status}</span></Link>)}</div></section></div>
    <p className="mt-4 text-xs text-slate-500">Exceptions include cancelled, rejected, no-show, customer-declined, and customer-cancelled orders. Refunds are tracked separately.</p>
  </section>;
}
