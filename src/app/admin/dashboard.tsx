"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminLoadingState, AdminStatusBadge, formatAdminMoney } from "./presentation";

type DashboardData = {
  businessDate: string;
  asOf: string;
  unreadNotifications: number;
  attentionCount: number;
  overdueNew: Array<{
    id: string;
    publicReference: string;
    customerName: string;
    createdAt: string;
    ageMinutes: number;
    mobile: string | null;
    email?: string | null;
    facebookProfile?: string | null;
    orderSource?: string | null;
    version?: number;
  }>;
  unconfirmedDeliveryCount: number;
  funnel: {
    intake: { count: number; volumeLitres: number };
    confirm: { count: number; volumeLitres: number };
    packing: { count: number; volumeLitres: number };
    ready: { count: number; volumeLitres: number };
    done: { count: number; volumeLitres: number };
  };
  volume: {
    capacityLitres: number;
    reservedLitres: number;
    remainingLitres: number;
    percentage: number;
    pickupVolumeLitres: number;
    pickupCrates: number;
    deliveryVolumeLitres: number;
    deliveryCrates: number;
  };
  financials: {
    grossBookedCents: number;
    collectedCents: number;
    outstandingCents: number;
    collectedPercentage: number;
  };
  lookahead: Array<{
    label: string;
    date: string;
    capacityLitres: number;
    reservedLitres: number;
    remainingLitres: number;
    percentage: number;
  }>;
  attention: Array<{
    id: string;
    orderId: string;
    publicReference: string;
    customerName: string;
    fulfillmentDate: string;
    status: string;
    label: string;
    severity: "urgent" | "attention";
  }>;
  activity: Array<{
    id: string;
    actor: string;
    action: string;
    entityType: string;
    entityId: string;
    reference: string | null;
    createdAt: string;
  }>;
};

export function DashboardModule() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [actionNotice, setActionNotice] = useState("");

  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [alertsList, setAlertsList] = useState<Array<{ id: string; category: string; title: string; body: string; createdAt: string; orderId: string | null }>>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

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

  const openAlertsModal = useCallback(async () => {
    setAlertsModalOpen(true);
    setLoadingAlerts(true);
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      const body = await response.json();
      if (response.ok && body.data) setAlertsList(body.data);
    } catch {
      /* ignore */
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  async function markAlertsRead(id?: string) {
    try {
      await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });
      if (id) {
        setAlertsList((prev) => prev.filter((a) => a.id !== id));
      } else {
        setAlertsList([]);
        setAlertsModalOpen(false);
      }
      void load();
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => {
      if (!document.hidden) void load(true);
    }, 30_000);
    const visible = () => {
      if (!document.hidden) void load(true);
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);

  // 1-Click Quick Confirm from Triage Ribbon
  async function handleQuickConfirm(orderId: string, ref: string, expectedVersion = 1) {
    setActionNotice("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "CONFIRMED", expectedVersion }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Could not confirm order");
      setActionNotice(`✓ Quick confirmed order ${ref}.`);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quick confirm failed.");
    }
  }

  if (error && !data)
    return (
      <section className="shell py-6">
        <p className="card text-danger font-bold" role="alert">
          {error}
        </p>
      </section>
    );

  if (!data)
    return (
      <section className="shell py-6">
        <AdminLoadingState label="Loading Operations Control Tower…" />
      </section>
    );

  const totalExceptions = data.overdueNew.length + data.unconfirmedDeliveryCount + (data.unreadNotifications > 0 ? 1 : 0);

  return (
    <section id="dashboard" className="shell pb-10 flex flex-col gap-4">
      {/* 1. CONTROL TOWER HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <span className="eyebrow text-primary">OPERATIONS CONTROL TOWER — SATAKUNTA HUB</span>
          <h1 className="text-2xl font-bold text-ink">3-Second Operations Standup</h1>
          <p className="text-xs muted font-semibold">
            Real-time fulfillment funnel, physical volume gauges, and cash flow velocity.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="font-bold text-ink bg-surface-muted px-3 py-1.5 rounded-xl border border-line">
            📅 Date: <strong>{data.businessDate}</strong>
          </span>

          <span className="font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live: Active
          </span>

          <button
            type="button"
            className="btn btn-secondary text-xs py-1.5 px-3 font-semibold"
            disabled={refreshing}
            onClick={() => void load()}
          >
            {refreshing ? "Refreshing…" : "🔄 Refresh"}
          </button>
        </div>
      </div>

      {actionNotice && (
        <p className="text-xs font-bold text-emerald-800 bg-emerald-100 p-3 rounded-xl border border-emerald-300">
          {actionNotice}
        </p>
      )}

      {/* 2. 🚨 URGENT ACTION & TRIAGE RIBBON */}
      {totalExceptions > 0 && (
        <div className="card p-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
            <strong className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
              <span>🚨</span> URGENT ACTION &amp; TRIAGE RIBBON ({totalExceptions} Exceptions)
            </strong>

            <Link
              className="text-xs font-bold text-amber-900 hover:underline flex items-center gap-1"
              href="/admin/orders?view=triage"
            >
              View All Urgent Exceptions ({data.attentionCount}) ►
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-amber-950">
            {data.overdueNew.length > 0 && (
              <span>⚠️ {data.overdueNew.length} New Order(s) &gt; 15m Old</span>
            )}
            {data.unconfirmedDeliveryCount > 0 && (
              <span>⚠️ {data.unconfirmedDeliveryCount} Delivery Address Unconfirmed</span>
            )}
            {data.unreadNotifications > 0 && (
              <button
                type="button"
                className="hover:underline flex items-center gap-1 cursor-pointer font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-lg border border-amber-300 transition-colors"
                onClick={openAlertsModal}
              >
                🔔 {data.unreadNotifications} Unread Team Alert(s)
              </button>
            )}
          </div>

          {/* Quick Action Items */}
          {data.overdueNew.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {data.overdueNew.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="bg-surface p-2.5 rounded-xl border border-amber-300/80 flex items-center justify-between gap-3 shadow-xs text-xs"
                >
                  <div>
                    <strong className="text-ink font-bold">{item.publicReference}</strong>
                    <span className="muted block text-[11px]">
                      {item.customerName} ({item.ageMinutes}m ago)
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="btn text-[11px] py-1 px-2.5 font-bold bg-emerald-700 text-white hover:bg-emerald-800"
                      onClick={() => void handleQuickConfirm(item.id, item.publicReference, item.version)}
                    >
                      ✓ Quick Confirm
                    </button>
                    {renderSinglePrimaryContact(item)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. TODAY'S FULFILLMENT FUNNEL (Continuous Factory Pipeline) */}
      <div className="card p-4 md:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <div>
            <span className="eyebrow">FACTORY PIPELINE</span>
            <h2 className="text-base font-bold text-ink">Today&apos;s Fulfillment Funnel</h2>
          </div>
          <span className="text-xs muted font-semibold">Click stage to filter queue</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            {
              key: "intake",
              stage: "🟡 1. INTAKE",
              desc: "New Orders",
              data: data.funnel.intake,
              link: "/admin/orders?view=all&status=NEW",
            },
            {
              key: "confirm",
              stage: "🟢 2. CONFIRM",
              desc: "Confirmed",
              data: data.funnel.confirm,
              link: "/admin/orders?view=all&status=CONFIRMED",
            },
            {
              key: "packing",
              stage: "⚙️ 3. PACKING",
              desc: "Packing Shed",
              data: data.funnel.packing,
              link: "/admin/orders?view=all&status=PICKING",
            },
            {
              key: "ready",
              stage: "📦 4. READY",
              desc: "Staged / Van",
              data: data.funnel.ready,
              link: "/admin/orders?view=all&status=READY",
            },
            {
              key: "done",
              stage: "🚚 5. DONE",
              desc: "Picked / Delivered",
              data: data.funnel.done,
              link: "/admin/orders?view=today",
            },
          ].map((step) => (
            <Link
              key={step.key}
              href={step.link}
              className="p-3.5 rounded-xl border border-line bg-surface hover:border-primary transition-all flex flex-col justify-between gap-2 shadow-xs group"
            >
              <span className="text-xs font-bold text-ink group-hover:text-primary transition-colors">
                {step.stage}
              </span>
              <div>
                <strong className="text-2xl font-bold text-ink block ops-tabular">
                  {step.data.count} <span className="text-xs font-normal muted">orders</span>
                </strong>
                <span className="text-xs font-bold text-primary block ops-tabular mt-0.5">
                  {step.data.volumeLitres.toFixed(1)} Litres
                </span>
              </div>
              <span className="text-[11px] muted">{step.desc}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 4 & 5. PHYSICAL VOLUME GAUGE & FINANCIAL HEALTH GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* PHYSICAL VOLUME GAUGE (7 Cols) */}
        <div className="lg:col-span-7 card p-4 md:p-5 flex flex-col justify-between gap-4">
          <div className="border-b border-line pb-2 flex items-center justify-between">
            <div>
              <span className="eyebrow">PHYSICAL HARVEST VOLUMETRICS</span>
              <h3 className="text-base font-bold text-ink">Today&apos;s Capacity &amp; Channel Split</h3>
            </div>
            <Link className="text-xs font-bold text-primary hover:underline" href="/admin/availability">
              Manage Capacity ►
            </Link>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Reserved: {data.volume.reservedLitres} L / {data.volume.capacityLitres} L Target</span>
              <span className="text-primary ops-tabular">{data.volume.percentage}% Booked</span>
            </div>

            {/* Visual Capacity Bar */}
            <div className="w-full h-3 rounded-full bg-surface-muted border border-line overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(100, data.volume.percentage)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs muted font-semibold mt-0.5">
              <span>Remaining to Sell: <strong className="text-emerald-700">{data.volume.remainingLitres} Litres</strong></span>
            </div>
          </div>

          {/* Logistical Split Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1 text-xs">
            <div className="p-3 rounded-xl bg-surface-muted border border-line flex flex-col gap-1">
              <span className="font-bold text-ink">📍 Pori Toriparkki Stall (18:00)</span>
              <strong className="text-base font-bold text-primary ops-tabular">{data.volume.pickupVolumeLitres.toFixed(1)} Litres</strong>
              <span className="muted text-[11px] font-semibold">({data.volume.pickupCrates} Crates to load in van)</span>
            </div>

            <div className="p-3 rounded-xl bg-surface-muted border border-line flex flex-col gap-1">
              <span className="font-bold text-ink">🚚 Home Delivery Routes</span>
              <strong className="text-base font-bold text-primary ops-tabular">{data.volume.deliveryVolumeLitres.toFixed(1)} Litres</strong>
              <span className="muted text-[11px] font-semibold">({data.volume.deliveryCrates} Crates for drivers)</span>
            </div>
          </div>
        </div>

        {/* FINANCIAL HEALTH & CASH FLOW (5 Cols) */}
        <div className="lg:col-span-5 card p-4 md:p-5 flex flex-col justify-between gap-3">
          <div className="border-b border-line pb-2">
            <span className="eyebrow">CASH FLOW VELOCITY</span>
            <h3 className="text-base font-bold text-ink">Today&apos;s Revenue Breakdown</h3>
          </div>

          <div className="flex flex-col gap-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-muted border border-line">
              <span>Gross Booked Revenue</span>
              <strong className="text-sm font-bold text-ink ops-tabular">
                {formatAdminMoney(data.financials.grossBookedCents)}
              </strong>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="font-bold text-emerald-900">🟢 Collected (MobilePay/Card)</span>
              <strong className="text-sm font-bold text-emerald-900 ops-tabular">
                {formatAdminMoney(data.financials.collectedCents)} ({data.financials.collectedPercentage}%)
              </strong>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 border border-amber-200">
              <span className="font-bold text-amber-900">🟡 Due at Stall / Pickup</span>
              <strong className="text-sm font-bold text-amber-900 ops-tabular">
                {formatAdminMoney(data.financials.outstandingCents)}
              </strong>
            </div>
          </div>

          {/* Automation Event Widget */}
          <div className="p-3 bg-surface-muted/60 rounded-xl border border-line flex items-center justify-between text-xs mt-1">
            <div>
              <span className="font-bold text-ink block">⏰ Automation Status</span>
              <span className="muted text-[11px]">Ready-check active</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary text-[11px] py-1 px-2.5 font-bold"
              onClick={() => void load()}
            >
              ⚡ Run Now
            </button>
          </div>
        </div>
      </div>

      {/* 6. 48-HOUR LOOKAHEAD & UPCOMING HARVEST DEMAND */}
      <div className="card p-4 md:p-5 flex flex-col gap-3">
        <div className="border-b border-line pb-2 flex items-center justify-between">
          <div>
            <span className="eyebrow">HARVEST FORECAST</span>
            <h3 className="text-base font-bold text-ink">48-Hour Lookahead &amp; Demand Cards</h3>
          </div>
          <Link className="text-xs font-bold text-primary hover:underline" href="/admin/availability">
            Full 14-Day Calendar ►
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.lookahead.map((card, idx) => (
            <div
              key={card.date}
              className="p-4 rounded-2xl border border-line bg-surface flex flex-col justify-between gap-3 shadow-xs"
            >
              <div className="flex flex-col gap-1 border-b border-line/60 pb-2">
                <span className="text-xs font-bold text-primary">{card.label}</span>
                <strong className="text-lg font-bold text-ink ops-tabular">
                  {card.reservedLitres} L Booked <span className="text-xs font-normal muted">of {card.capacityLitres} L Cap</span>
                </strong>
              </div>

              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span className={card.percentage >= 90 ? "text-amber-800" : "text-emerald-700"}>
                    {card.percentage}% Booked
                  </span>
                  <span className="muted">{card.remainingLitres} L Left</span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-surface-muted border border-line overflow-hidden">
                  <div
                    className={`h-full ${card.percentage >= 90 ? "bg-amber-500" : "bg-emerald-600"}`}
                    style={{ width: `${Math.min(100, card.percentage)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-line/60 text-xs">
                {idx === 0 ? (
                  <Link className="btn btn-secondary text-xs py-1 w-full justify-center" href="/admin/orders?view=today">
                    View Today&apos;s Queue
                  </Link>
                ) : (
                  <>
                    <Link className="btn btn-secondary text-xs py-1 flex-1 justify-center" href="/admin/availability">
                      🔒 Freeze / Sold Out
                    </Link>
                    <Link className="btn btn-secondary text-xs py-1 flex-1 justify-center" href="/admin/availability">
                      ➕ Open Capacity
                    </Link>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. LIVE SECURITY AUDIT FEED */}
      <div className="card p-4 md:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <div>
            <span className="eyebrow text-primary">IMMUTABLE LOG</span>
            <h3 className="text-base font-bold text-ink">Recent Security Activity</h3>
          </div>
          <Link className="btn btn-secondary text-xs py-1 px-3 font-bold flex items-center gap-1" href="/admin/audit">
            🛡️ Open Security Audit Hub →
          </Link>
        </div>

        <div className="divide-y divide-line">
          {data.activity.slice(0, 5).map((event) => (
            <div key={event.id} className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <strong className="text-ink font-bold">{event.action.replaceAll(".", " · ").replaceAll("_", " ")}</strong>
                <span className="muted">by {event.actor}</span>
              </div>
              <span className="muted font-mono text-[11px]">{event.createdAt.slice(0, 16).replace("T", " ")}</span>
            </div>
          ))}

          {data.activity.length === 0 && (
            <p className="py-4 text-xs muted italic text-center">No security audit entries recorded.</p>
          )}
        </div>
      </div>

      {/* 8. TEAM ALERTS MODAL */}
      {alertsModalOpen && (
        <div
          className="admin-command-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAlertsModalOpen(false);
          }}
        >
          <div className="card p-5 max-w-lg w-full bg-surface shadow-2xl rounded-2xl flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <span className="eyebrow text-amber-800">UNREAD TEAM ALERTS</span>
                <h3 className="text-base font-bold text-ink flex items-center gap-2">
                  <span>🔔</span> Active Team Notifications ({alertsList.length})
                </h3>
              </div>
              <button
                type="button"
                className="text-muted hover:text-ink text-xl font-bold p-1"
                onClick={() => setAlertsModalOpen(false)}
              >
                ×
              </button>
            </div>

            {loadingAlerts ? (
              <AdminLoadingState label="Fetching team alerts…" />
            ) : alertsList.length === 0 ? (
              <p className="text-xs muted py-6 text-center italic">No unread alerts remaining.</p>
            ) : (
              <div className="divide-y divide-line/60 flex flex-col">
                {alertsList.map((alert) => (
                  <div key={alert.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div className="flex flex-col gap-1">
                      <strong className="text-ink font-bold text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        {alert.title}
                      </strong>
                      <p className="text-slate-700">{alert.body}</p>
                      <span className="muted text-[11px] font-mono">
                        {alert.createdAt.slice(0, 16).replace("T", " ")}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {alert.orderId && (
                        <Link
                          href={`/admin/orders/${alert.orderId}`}
                          className="btn btn-secondary text-[11px] py-1 px-2 font-bold"
                          onClick={() => setAlertsModalOpen(false)}
                        >
                          View Order ►
                        </Link>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary text-[11px] py-1 px-2 font-bold text-muted hover:text-ink"
                        onClick={() => void markAlertsRead(alert.id)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-line pt-3 text-xs">
              {alertsList.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary text-xs font-bold text-amber-900 bg-amber-50 border-amber-200"
                  onClick={() => void markAlertsRead()}
                >
                  ✓ Mark all as read
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary text-xs font-bold ml-auto"
                onClick={() => setAlertsModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function renderSinglePrimaryContact(item: {
  mobile: string | null;
  email?: string | null;
  facebookProfile?: string | null;
  orderSource?: string | null;
}) {
  const cleanMobile = item.mobile ? item.mobile.trim() : "";
  const cleanEmail = item.email ? item.email.trim() : "";
  const cleanFb = item.facebookProfile ? item.facebookProfile.trim() : "";
  const source = (item.orderSource || "").toUpperCase();

  // 1. Priority: WhatsApp (If order source is WHATSAPP or WA)
  if (cleanMobile && (source === "WHATSAPP" || source === "WA")) {
    const waNumber = cleanMobile.replace(/\D/g, "");
    return (
      <a
        href={`https://wa.me/${waNumber}`}
        target="_blank"
        rel="noreferrer"
        className="btn btn-secondary text-[11px] py-1 px-2.5 font-bold text-emerald-800 bg-emerald-50 border-emerald-300 hover:bg-emerald-100"
        title={`WhatsApp ${cleanMobile}`}
      >
        💬 WhatsApp
      </a>
    );
  }

  // 2. Priority: SMS (If order source is SMS)
  if (cleanMobile && source === "SMS") {
    return (
      <a
        href={`sms:${cleanMobile}`}
        className="btn btn-secondary text-[11px] py-1 px-2.5 font-bold text-sky-800 bg-sky-50 border-sky-300 hover:bg-sky-100"
        title={`Send SMS to ${cleanMobile}`}
      >
        💬 SMS
      </a>
    );
  }

  // 3. Priority: Phone Call (If mobile exists and source is PHONE/MANUAL/WEBSITE/etc.)
  if (cleanMobile) {
    return (
      <a
        href={`tel:${cleanMobile}`}
        className="btn btn-secondary text-[11px] py-1 px-2.5 font-bold"
        title={`Call ${cleanMobile}`}
      >
        📞 Call
      </a>
    );
  }

  // 4. Priority: Facebook Profile (If no mobile, but has FB profile)
  if (cleanFb) {
    const url = cleanFb.startsWith("http") ? cleanFb : `https://facebook.com/${cleanFb}`;
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="btn btn-secondary text-[11px] py-1 px-2.5 font-bold text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100"
        title={`Open Facebook Profile (${cleanFb})`}
      >
        💬 FB Profile
      </a>
    );
  }

  // 5. Priority: Email (If no mobile/FB, but has email)
  if (cleanEmail) {
    return (
      <a
        href={`mailto:${cleanEmail}`}
        className="btn btn-secondary text-[11px] py-1 px-2.5 font-bold text-slate-700 bg-slate-100 border-slate-300 hover:bg-slate-200"
        title={`Send Email to ${cleanEmail}`}
      >
        ✉️ Email
      </a>
    );
  }

  // Fallback if no contact info
  return <span className="text-[11px] px-2 py-1 muted font-semibold">No contact</span>;
}
