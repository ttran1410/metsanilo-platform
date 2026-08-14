"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { availability, orderNotes, orderPayments, orders, products } from "@/db/schema";

type Order = typeof orders.$inferSelect;
type AvailabilityRow = { availability: typeof availability.$inferSelect; product: typeof products.$inferSelect };
type OrderDetail = { order: Order; notes: Array<typeof orderNotes.$inferSelect>; payments: Array<typeof orderPayments.$inferSelect> };

export function ManagerView({
  initialOrders,
  initialAvailability,
}: {
  initialOrders: Order[];
  initialAvailability: AvailabilityRow[];
}) {
  const [orderRows, setOrderRows] = useState(initialOrders);
  const [availabilityRows, setAvailabilityRows] = useState(initialAvailability);
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState<OrderDetail | null>(null);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/admin/login");
  }

  async function status(order: Order, next: "CONFIRMED" | "PICKING" | "READY" | "OUT_FOR_DELIVERY" | "PICKED_UP" | "DELIVERED" | "CUSTOMER_DECLINED" | "CANCELLED" | "CANCELLED_BY_CUSTOMER" | "REJECTED" | "NO_SHOW" | "REFUNDED") {
    setMessage("");
    const needsReason = ["CUSTOMER_DECLINED", "CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW", "REFUNDED"].includes(next);
    const reason = needsReason ? window.prompt("Reason for this transition")?.trim() : undefined;
    if (needsReason && !reason) return;
    const response = await fetch(`/api/admin/orders/${order.id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next, expectedVersion: order.version, reason, contactChannel: next === "CONFIRMED" ? "PHONE" : undefined }),
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.code ?? "Request failed");
    setOrderRows((rows) => rows.map((row) => (row.id === order.id ? body.data : row)));
    setMessage(`Order ${order.publicReference}: ${next}`);
  }

  async function openDetail(order: Order) {
    const response = await fetch(`/api/admin/orders/${order.id}`); const body = await response.json();
    if (!response.ok) return setMessage(body.code ?? "Request failed");
    setDetail(body.data);
  }

  async function detailAction(event: FormEvent<HTMLFormElement>, action: "note" | "fee" | "payment") {
    event.preventDefault();
    if (!detail) return;
    const values = new FormData(event.currentTarget);
    const endpoint = action === "note" ? "notes" : action === "fee" ? "delivery-fee" : "payment";
    const payload = action === "note"
      ? { body: values.get("body") }
      : action === "fee"
        ? { expectedVersion: detail.order.version, deliveryFeeCents: Math.round(Number(values.get("feeEuros")) * 100) }
        : { amountCents: Math.round(Number(values.get("paymentEuros")) * 100), method: values.get("method"), reference: values.get("reference") };
    const response = await fetch(`/api/admin/orders/${detail.order.id}/${endpoint}`, { method: action === "fee" ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) return setMessage(body.code ?? body.message ?? "Request failed");
    if (action === "fee") setDetail((current) => current ? { ...current, order: body.data } : current);
    else await openDetail(detail.order);
    event.currentTarget.reset(); setMessage("Order updated.");
  }

  async function save(row: AvailabilityRow, form: HTMLFormElement) {
    setMessage("");
    const values = new FormData(form);
    const capacityLitres = Number(values.get("capacityLitres"));
    const response = await fetch(`/api/admin/availability/${encodeURIComponent(row.availability.id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: row.availability.version,
        capacityMl: Math.round(capacityLitres * 1000),
        manualSoldOut: values.get("manualSoldOut") === "on",
        soldOutReason: values.get("soldOutReason"),
      }),
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.code ?? "Request failed");
    setAvailabilityRows((rows) =>
      rows.map((item) => item.availability.id === row.availability.id ? { ...item, availability: body.data } : item),
    );
    setMessage(`Availability ${row.availability.businessDate} saved.`);
  }

  async function plan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const frequency = String(values.get("frequency"));
    const response = await fetch("/api/admin/availability/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productId: values.get("productId"), frequency, startDate: values.get("startDate"), endDate: values.get("endDate"),
        dates: String(values.get("dates") ?? "").split(",").map((date) => date.trim()).filter(Boolean),
        capacityMl: Math.round(Number(values.get("capacityLitres")) * 1000),
        manualSoldOut: values.get("manualSoldOut") === "on", soldOutReason: values.get("soldOutReason"),
      }),
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.code ?? body.message ?? "Request failed");
    const planned = body.data as Array<typeof availability.$inferSelect>;
    setAvailabilityRows((rows) => {
      const byId = new Map(rows.map((row) => [row.availability.id, row]));
      const product = rows.find((row) => row.product.id === String(values.get("productId")))?.product;
      for (const item of planned) {
        const existing = byId.get(item.id);
        if (existing) byId.set(item.id, { ...existing, availability: item });
        else if (product) byId.set(item.id, { availability: item, product });
      }
      return [...byId.values()].sort((a, b) => a.availability.businessDate.localeCompare(b.availability.businessDate));
    });
    setMessage(`${planned.length} availability date(s) planned.`);
  }

  return (
    <main className="shell py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="text-xs font-bold tracking-[.2em]">METSÄNILO</div><h1 className="text-3xl font-bold">Manager</h1></div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-secondary" href="/fi">Public shop</Link>
          <button className="btn btn-secondary" type="button" onClick={() => void logout()}>Sign out</button>
        </div>
      </div>
      {message && <p className="card mt-5" role="status">{message}</p>}

      <section className="mt-8">
        <h2 className="text-2xl font-bold">Orders</h2>
        <div className="mt-3 grid gap-3">
          {orderRows.length === 0 && <div className="card">No orders.</div>}
          {orderRows.map((order) => (
            <article className="card" key={order.id}>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-bold">{order.publicReference} <span className="pill">{order.status}</span></h3>
                  <p>{order.customerName} · {order.mobile} · {order.productNameFi} / {order.packageLabelFi}</p>
                  <p>{order.fulfillmentDate} · {order.fulfillmentMethod} · {(order.volumeMl / 1000).toLocaleString("fi-FI")} l</p>
                  {order.fulfillmentMethod === "DELIVERY" && <p>Delivery to be agreed · {order.streetAddress}, {order.postalCode} {order.city}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-secondary" onClick={() => void openDetail(order)}>Details</button>
                  {order.status === "NEW" && <><button className="btn" onClick={() => void status(order, "CONFIRMED")}>Confirm</button><button className="btn btn-secondary" onClick={() => void status(order, "CUSTOMER_DECLINED")}>Customer declined</button><button className="btn bg-[var(--berry)]" onClick={() => void status(order, "CANCELLED")}>Cancel</button></>}
                  {order.status === "CONFIRMED" && <><button className="btn" onClick={() => void status(order, "PICKING")}>Start picking</button><button className="btn bg-[var(--berry)]" onClick={() => void status(order, "CANCELLED")}>Cancel</button></>}
                  {order.status === "PICKING" && <button className="btn" onClick={() => void status(order, "READY")}>Mark ready</button>}
                  {order.status === "READY" && (order.fulfillmentMethod === "PICKUP" ? <button className="btn" onClick={() => void status(order, "PICKED_UP")}>Confirm pickup</button> : <button className="btn" onClick={() => void status(order, "OUT_FOR_DELIVERY")}>Dispatch delivery</button>)}
                  {order.status === "OUT_FOR_DELIVERY" && <button className="btn" onClick={() => void status(order, "DELIVERED")}>Mark delivered</button>}
                </div>
              </div>
              {detail?.order.id === order.id && <div className="mt-4 grid gap-3 border-t pt-4">
                <h4 className="font-bold">Order detail</h4>
                <p>Item: {(detail.order.itemSubtotalCents / 100).toFixed(2)} € · Delivery: {detail.order.deliveryFeeCents === null ? "to be agreed" : `${(detail.order.deliveryFeeCents / 100).toFixed(2)} €`} · Total: {detail.order.finalTotalCents === null ? "to be agreed" : `${(detail.order.finalTotalCents / 100).toFixed(2)} €`}</p>
                {detail.order.fulfillmentMethod === "DELIVERY" && detail.order.status !== "CANCELLED" && <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => void detailAction(event, "fee")}><label className="field"><span>Delivery fee (€)</span><input name="feeEuros" type="number" min="0" step="0.01" defaultValue={detail.order.deliveryFeeCents === null ? "" : (detail.order.deliveryFeeCents / 100).toFixed(2)} required /></label><button className="btn" type="submit">Save fee</button></form>}
                <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => void detailAction(event, "payment")}><label className="field"><span>Payment (€)</span><input name="paymentEuros" type="number" min="0.01" step="0.01" required /></label><label className="field"><span>Method</span><select name="method" defaultValue="CASH"><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option><option value="MOBILEPAY">MobilePay</option><option value="CARD">Card</option><option value="OTHER">Other</option></select></label><label className="field"><span>Reference</span><input name="reference" maxLength={200} /></label><button className="btn" type="submit">Record payment</button></form>
                <form className="flex items-end gap-2" onSubmit={(event) => void detailAction(event, "note")}><label className="field grow"><span>Internal note</span><textarea name="body" maxLength={2000} required /></label><button className="btn" type="submit">Add note</button></form>
                <div className="text-sm"><strong>Payments:</strong> {detail.payments.length ? detail.payments.map((payment) => `${(payment.amountCents / 100).toFixed(2)} € ${payment.method}`).join(" · ") : "None"}<br /><strong>Notes:</strong> {detail.notes.length ? detail.notes.map((note) => note.body).join(" · ") : "None"}</div>
              </div>}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">Plan availability</h2>
        <form className="card mt-3 grid gap-3" onSubmit={plan}>
          <p className="text-sm">DAY applies every date, WEEK every 7 days, MONTH on the same day each month, and CUSTOM to comma-separated dates.</p>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="field"><span>Product</span><select name="productId" required>{[...new Map(availabilityRows.map((row) => [row.product.id, row.product])).values()].map((product) => <option key={product.id} value={product.id}>{product.nameFi}</option>)}</select></label>
            <label className="field"><span>Pattern</span><select name="frequency" defaultValue="DAY"><option value="DAY">Daily</option><option value="WEEK">Weekly</option><option value="MONTH">Monthly</option><option value="CUSTOM">Custom dates</option></select></label>
            <label className="field"><span>Capacity (litres)</span><input name="capacityLitres" type="number" min="0" step="0.001" required /></label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="field"><span>Start date</span><input name="startDate" type="date" required /></label>
            <label className="field"><span>End date</span><input name="endDate" type="date" required /></label>
            <label className="field"><span>Custom dates (YYYY-MM-DD, comma-separated)</span><input name="dates" placeholder="2026-08-20, 2026-08-23" /></label>
          </div>
          <div className="grid gap-2 md:grid-cols-[auto_1fr_auto] md:items-end">
            <label className="flex items-center gap-2"><input name="manualSoldOut" type="checkbox" /> Sold out</label>
            <label className="field"><span>Internal reason (required when sold out)</span><input name="soldOutReason" maxLength={500} /></label>
            <button className="btn" type="submit">Apply plan</button>
          </div>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">Today and future capacity</h2>
        <div className="mt-3 grid gap-3">
          {availabilityRows.map((row) => (
            <form className="card grid gap-3 md:grid-cols-[1fr_10rem_1fr_auto] md:items-end" key={`${row.availability.id}:${row.availability.version}`} onSubmit={(event) => { event.preventDefault(); void save(row, event.currentTarget); }}>
              <div><strong>{row.product.nameFi}</strong><br />{row.availability.businessDate}<br /><small>Reserved: {row.availability.reservedMl / 1000} l · v{row.availability.version}</small></div>
              <label className="field"><span>Capacity (litres)</span><input name="capacityLitres" type="number" min={row.availability.reservedMl / 1000} step="0.001" defaultValue={row.availability.capacityMl / 1000} required /></label>
              <div className="grid gap-2">
                <label className="flex items-center gap-2"><input name="manualSoldOut" type="checkbox" defaultChecked={row.availability.manualSoldOut} /> Sold out</label>
                <label className="field"><span>Internal reason (required when sold out)</span><input name="soldOutReason" maxLength={500} defaultValue={row.availability.manualSoldOutReason ?? ""} /></label>
              </div>
              <button className="btn" type="submit">Save</button>
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}
