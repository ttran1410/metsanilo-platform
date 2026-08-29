"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { AdminLoadingState, AdminStatusBadge, formatAdminMoney } from "../presentation";
import type { DashboardData } from "./types";
import { useDashboardOverviewActionController } from "./use-dashboard-overview-action-controller";

const stages = [
  ["intake", "New", "awaiting review", "NEW"],
  ["confirm", "Confirmed", "reserved", "CONFIRMED"],
  ["packing", "Picking", "being packed", "PICKING"],
  ["ready", "Ready", "ready for handover", "READY"],
  ["done", "Done", "fulfilled", "DELIVERED"],
] as const;

export function AdminDashboard({ initialData }: { initialData?: DashboardData }) {
  const [data, setData] = useState<DashboardData | null>(initialData ?? null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [runningAutomation, setRunningAutomation] = useState(false);
  const overviewActions = useDashboardOverviewActionController({ setError, setNotice, reload: () => void load(true) });

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Dashboard unavailable");
      setData(body.data);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Dashboard unavailable");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (initialData) return;
    const initial = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => { if (!document.hidden) void load(true); }, 30_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [initialData, load]);

  function quickConfirm(orderId: string, reference: string, expectedVersion = 1) { void overviewActions.quickConfirm(orderId, reference, expectedVersion); }
  function runAutomation() { setRunningAutomation(true); void overviewActions.runAutomation().finally(() => setRunningAutomation(false)); }

  if (error && !data) return <main className="admin-overview"><div className="admin-overview-error" role="alert"><strong>Dashboard unavailable</strong><span>{error}</span><button className="btn btn-secondary" type="button" onClick={() => void load()}>Try again</button></div></main>;
  if (!data) return <main className="admin-overview"><AdminLoadingState label="Loading today’s operations…" /></main>;

  const hasOrderAttention = data.attentionCount > 0;
  const hasUnreadAlerts = data.unreadNotifications > 0;
  return (
    <main className="admin-overview">
      <section className="admin-overview-intro"><div><p className="eyebrow">{data.businessDate} · Live overview</p><h1>Today&apos;s operations</h1><p>Review orders that need attention, today&apos;s capacity, handovers, and payments.</p></div><div className="admin-overview-clock"><span>Last synced</span><strong>{new Date(data.asOf).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}</strong><small>{refreshing ? "Refreshing…" : "Live from operations"}</small><button className="btn btn-secondary" type="button" disabled={refreshing} onClick={() => void load()}>{refreshing ? "Refreshing…" : "Refresh"}</button></div></section>
      {(hasOrderAttention || hasUnreadAlerts || notice || error) && <section className={`admin-overview-alert${error ? " is-error" : ""}`} aria-live="polite"><div><strong>{error || notice || (hasOrderAttention ? `${data.attentionCount} order${data.attentionCount === 1 ? "" : "s"} need attention` : `${data.unreadNotifications} unread team alert${data.unreadNotifications === 1 ? "" : "s"}`)}</strong><span>{error ? "Resolve the issue, then refresh the overview." : data.overdueNew.length > 0 ? `${data.overdueNew.length} new order(s) have been waiting over 15 minutes.` : data.unconfirmedDeliveryCount > 0 ? `${data.unconfirmedDeliveryCount} delivery address(es) need confirmation.` : hasUnreadAlerts ? "Review the operational history and open the related work from Notifications." : "Operations are moving normally."}</span></div>{hasOrderAttention ? <Link href="/admin/orders?view=triage">Review orders</Link> : hasUnreadAlerts ? <Link href="/admin/notifications">Open inbox</Link> : null}</section>}
      <section className="admin-overview-section"><div className="admin-overview-heading"><div><p className="eyebrow">Order workflow</p><h2>Today&apos;s orders</h2></div><Link href="/admin/orders">See all orders <ArrowRight aria-hidden="true" /></Link></div><div className="admin-overview-spine">{stages.map(([key, label, detail, status], index) => { const stage = data.funnel[key as keyof DashboardData["funnel"]]; const stageStatus = key === "ready" ? "READY_STAGE" : key === "done" ? "FULFILLED" : status; return <Link className={`admin-overview-stage${key === "packing" ? " is-current" : ""}`} href={`/admin/orders?view=TODAY&status=${stageStatus}`} key={key}><div><span>{label}</span><small>{String(index + 1).padStart(2, "0")}</small></div><strong>{stage.count}</strong><em>{stage.volumeLitres.toFixed(1)} L</em><small>{detail}</small>{index < stages.length - 1 && <i aria-hidden="true" />}</Link>; })}</div></section>
      <div className="admin-overview-grid"><section className="admin-overview-panel"><div className="admin-overview-heading"><div><p className="eyebrow">Capacity</p><h2>Today&apos;s capacity</h2></div><Link href="/admin/availability">Manage <ArrowRight aria-hidden="true" /></Link></div><div className="admin-overview-capacity"><strong>{data.volume.percentage}<span>%</span></strong><div><span>{data.volume.reservedLitres} L reserved</span><small>of {data.volume.capacityLitres} L available</small></div></div><div className="admin-overview-bar"><span style={{ width: `${Math.min(100, Math.max(0, data.volume.percentage))}%` }} /></div><div className="admin-overview-splits"><span><i className="pickup" />Pori stall <b>{data.volume.pickupVolumeLitres.toFixed(1)} L</b></span><span><i className="delivery" />Home delivery <b>{data.volume.deliveryVolumeLitres.toFixed(1)} L</b></span></div></section><section className="admin-overview-panel"><div className="admin-overview-heading"><div><p className="eyebrow">Fulfilled today</p><h2>Fulfillment summary</h2></div><Link href="/admin/reports">Report <ArrowRight aria-hidden="true" /></Link></div><dl className="admin-overview-financials"><div className="success"><dt>Recognized sales</dt><dd>{formatAdminMoney(data.financials.fulfilledSalesCents)}</dd></div><div><dt>Fulfilled litres</dt><dd>{data.financials.fulfilledLitres.toFixed(1)} L</dd></div><div><dt>Fulfilled orders</dt><dd>{data.funnel.done.count}</dd></div></dl></section><section className="admin-overview-panel"><div className="admin-overview-heading"><div><p className="eyebrow">Cash position</p><h2>Today&apos;s payments</h2></div><span className="admin-overview-live-dot"><i />Live</span></div><dl className="admin-overview-financials"><div><dt>Booked</dt><dd>{formatAdminMoney(data.financials.grossBookedCents)}</dd></div><div className="success"><dt>Collected</dt><dd>{formatAdminMoney(data.financials.collectedCents)} <small>{data.financials.collectedPercentage}%</small></dd></div><div className="warning"><dt>Due at handover</dt><dd>{formatAdminMoney(data.financials.outstandingCents)}</dd></div></dl><button className="btn btn-secondary admin-overview-automation" type="button" disabled={runningAutomation} onClick={() => void runAutomation()}>{runningAutomation ? "Running automation…" : "Run automation now"}</button></section></div>
      <section className="admin-overview-section"><div className="admin-overview-heading"><div><p className="eyebrow">Harvest forecast</p><h2>Next three days</h2></div><Link href="/admin/availability?view=WEEK">Open calendar <ArrowRight aria-hidden="true" /></Link></div><div className="admin-overview-lookahead">{data.lookahead.map((day) => <Link href="/admin/availability" className="admin-overview-day" key={day.date}><span>{day.label}</span><strong>{day.reservedLitres} L <small>of {day.capacityLitres} L</small></strong><div className="admin-overview-mini-bar"><i style={{ width: `${Math.min(100, day.percentage)}%` }} /></div><small>{day.remainingLitres} L remaining · {day.percentage}% booked</small></Link>)}</div></section>
      {data.overdueNew.length > 0 && <section className="admin-overview-section"><div className="admin-overview-heading"><div><p className="eyebrow">Needs review</p><h2>New orders</h2><p className="muted">Incoming orders waiting for confirmation.</p></div><Link href="/admin/orders?view=NEEDS_CONFIRMATION">Open new orders <ArrowRight aria-hidden="true" /></Link></div><div className="admin-overview-queue">{data.overdueNew.slice(0, 3).map((order) => <article key={order.id}><div><strong>{order.publicReference}</strong><span>{order.customerName} · waiting {order.ageMinutes} min</span></div><div><AdminStatusBadge status="NEW" /><button className="btn" type="button" onClick={() => void quickConfirm(order.id, order.publicReference, order.version)}>Quick confirm</button></div></article>)}</div></section>}
    </main>
  );
}
