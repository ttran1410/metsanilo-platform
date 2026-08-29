"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, MapPin, PackageCheck, Play, Truck } from "lucide-react";
import type { AdminOrder } from "../types/admin-order";
import { AdminNotice } from "../../presentation";

function cleanLitres(ml: number) {
  return `${(ml / 1000).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} L`;
}

export function PackingKanban({ orders, canTransition, onRefresh }: {
  orders: AdminOrder[];
  canTransition: boolean;
  onRefresh: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const columns = useMemo(() => [
    { key: "CONFIRMED", title: "To pack", description: "Confirmed and waiting", orders: orders.filter((order) => order.status === "CONFIRMED"), nextStatus: "PICKING", nextLabel: "Start packing", icon: Play },
    { key: "PICKING", title: "Packing", description: "Work in progress", orders: orders.filter((order) => order.status === "PICKING"), nextStatus: "READY", nextLabel: "Mark ready", icon: PackageCheck },
    { key: "READY", title: "Ready", description: "Move to pickup or delivery", orders: orders.filter((order) => order.status === "READY" || order.status === "OUT_FOR_DELIVERY"), nextStatus: null, nextLabel: null, icon: CircleCheck },
  ], [orders]);

  async function handleTransition(order: AdminOrder, nextStatus: string) {
    setBusyId(order.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "transition", status: nextStatus, expectedVersion: order.version }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Could not update packing state.");
      setNotice(`${order.publicReference} moved to ${nextStatus === "PICKING" ? "Packing" : "Ready"}.`);
      onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update packing state.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="packing-board">
      <header><div><p className="eyebrow">Fulfillment workflow</p><h2>Packing board</h2><p>Move confirmed orders through packing. Ready orders continue at Pickup desk or Delivery.</p></div><div className="packing-total"><strong>{columns.reduce((sum, column) => sum + column.orders.length, 0)}</strong><span>active</span></div></header>
      {notice && <AdminNotice tone="success" live>{notice}</AdminNotice>}
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}
      <div className="packing-columns">
        {columns.map((column) => {
          const ColumnIcon = column.icon;
          return <section className="packing-column" key={column.key}><header><div><ColumnIcon aria-hidden="true" /><span><strong>{column.title}</strong><small>{column.description}</small></span></div><b>{column.orders.length}</b></header><div className="packing-order-list">
            {column.orders.map((order) => <article className="packing-order-card" key={order.id}><header><Link href={`/admin/orders/${order.id}`}>{order.publicReference}</Link><span>{order.fulfillmentMethod === "PICKUP" ? <MapPin aria-hidden="true" /> : <Truck aria-hidden="true" />}{order.fulfillmentMethod === "PICKUP" ? "Pickup" : "Delivery"}</span></header><div><strong>{order.customerName}</strong><span>{order.packageLabelFi} · {cleanLitres(order.volumeMl)}</span><small>{order.fulfillmentDate}</small></div>{canTransition && column.nextStatus && <button type="button" className="btn btn-secondary" disabled={busyId === order.id} onClick={() => void handleTransition(order, column.nextStatus!)}>{busyId === order.id ? "Updating…" : <>{column.nextLabel}<ArrowRight aria-hidden="true" /></>}</button>}{column.key === "READY" && <p>Continue in {order.fulfillmentMethod === "PICKUP" ? "Pickup desk" : "order delivery"}.</p>}</article>)}
            {!column.orders.length && <div className="packing-empty"><ColumnIcon aria-hidden="true" /><span>No orders in this stage</span></div>}
          </div></section>;
        })}
      </div>
    </section>
  );
}
