"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { orders } from "@/db/schema";
import { AdminLoadingState, AdminNotice, AdminStatusBadge, formatAdminMoney } from "./presentation";
import { OrderActionBar } from "./order-action-bar";

type Order = typeof orders.$inferSelect & { paidCents?: number; outstandingCents?: number | null; paymentStatus?: string };
type Detail = {
  order: Order;
  notes: Array<{ id: string; body: string; actor: string; createdAt: string }>;
  audit: Array<{ id: string; action: string; actor: string; createdAt: string }>;
  paymentSummary: { paidCents: number; refundedCents: number; outstandingCents: number; status: string };
};

export function OrderInspector({ order, canTransition, canUpdate, onClose, onPrevious, onNext, onOrderUpdated }: {
  order: Order;
  canTransition: boolean;
  canUpdate: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onOrderUpdated: (order: Order) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  async function load() {
    setError("");
    const response = await fetch(`/api/admin/orders/${order.id}`);
    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Order details unavailable.");
    setDetail(body.data);
  }

  useEffect(() => {
    const initial = window.setTimeout(() => {
      setDetail(null);
      setNotice("");
      void load();
      closeRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(initial);
  // The order id intentionally owns the inspector lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key.toLowerCase() === "e" && canTransition && !isTyping(event.target)) {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>(".order-inspector .order-action-bar button")?.click();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [canTransition, detail, onClose, order]);

  async function transition(next: string, reason?: string) {
    const current = detail?.order ?? order;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/orders/${current.id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next, expectedVersion: current.version, reason, contactChannel: next === "CONFIRMED" ? "PHONE" : undefined }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) return setError(body.message ?? "Status update failed.");
    onOrderUpdated(body.data);
    setNotice(`${current.publicReference} moved to ${next.replaceAll("_", " ")}.`);
    await load();
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const bodyText = String(new FormData(form).get("body") ?? "").trim();
    if (!bodyText) return;
    setBusy(true);
    const response = await fetch(`/api/admin/orders/${order.id}/notes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: bodyText }) });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) return setError(body.message ?? "Could not add note.");
    form.reset();
    setNotice("Internal note added.");
    await load();
  }

  const [copied, setCopied] = useState<string | null>(null);

  function copyText(value: string, label: string) {
    if (!value) return;
    void navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 2000);
  }

  const current = detail?.order ?? order;
  const isClosed = ["CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW", "DELIVERED", "PICKED_UP", "REFUNDED"].includes(current.status);

  return <div className="order-inspector-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="order-inspector" role="dialog" aria-modal="true" aria-labelledby="order-inspector-title">
      <header className="order-inspector-header">
        <div>
          <p className="eyebrow">QUICK INSPECT</p>
          <div className="flex items-center gap-2">
            <h2 id="order-inspector-title" className="ops-tabular">{order.publicReference}</h2>
            <button type="button" className="btn btn-secondary text-xs py-1 px-2" onClick={() => copyText(order.publicReference, "Ref")} title="Copy reference">
              {copied === "Ref" ? "✓ Copied" : "Copy ref"}
            </button>
          </div>
        </div>
        <div className="order-inspector-nav">
          {canUpdate && !isClosed && <a className="btn btn-secondary text-xs py-1 px-2.5" href={`/admin/orders/${order.id}/edit`}>Edit order ✏️</a>}
          <button type="button" onClick={onPrevious} disabled={!onPrevious} aria-label="Previous order">↑</button>
          <button type="button" onClick={onNext} disabled={!onNext} aria-label="Next order">↓</button>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close inspector">×</button>
        </div>
      </header>
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}
      {notice && <AdminNotice tone="success" live>{notice}</AdminNotice>}
      {copied && <AdminNotice tone="success" live>Copied {copied} to clipboard.</AdminNotice>}
      {!detail ? <AdminLoadingState label="Loading order…" /> : <div className="order-inspector-body">
        <div className="order-inspector-status"><AdminStatusBadge status={current.status} /><span>{current.fulfillmentDate} · {current.fulfillmentMethod}</span></div>
        <dl className="order-inspector-facts">
          <div>
            <dt>Customer</dt>
            <dd>
              <strong>{current.customerName}</strong>
              <div className="flex items-center gap-2">
                <span>{current.mobile}</span>
                <button type="button" className="btn btn-secondary text-xs py-0.5 px-1.5" onClick={() => copyText(current.mobile, "Phone")}>
                  {copied === "Phone" ? "✓" : "Copy"}
                </button>
              </div>
            </dd>
          </div>
          <div><dt>Order</dt><dd><strong>{current.productNameFi} · {current.packageLabelFi}</strong><span>{current.quantity} × {current.volumeMl / 1000} L</span></dd></div>
          <div><dt>Payment</dt><dd><strong>{formatAdminMoney(current.finalTotalCents)}</strong><span>{detail.paymentSummary.status} · {formatAdminMoney(detail.paymentSummary.outstandingCents)} outstanding</span></dd></div>
          {current.fulfillmentMethod === "DELIVERY" && <div>
            <dt>Delivery</dt>
            <dd>
              <div className="flex items-center justify-between">
                <strong>{current.streetAddress || "Address missing"}</strong>
                {current.streetAddress && (
                  <button type="button" className="btn btn-secondary text-xs py-0.5 px-1.5" onClick={() => copyText(`${current.streetAddress}, ${current.postalCode ?? ""} ${current.city ?? ""}`.trim(), "Address")}>
                    {copied === "Address" ? "✓" : "Copy address"}
                  </button>
                )}
              </div>
              <span>{[current.postalCode, current.city].filter(Boolean).join(" ") || "Postal code or city missing"} · Fee {formatAdminMoney(current.deliveryFeeCents)}</span>
            </dd>
          </div>}
        </dl>
        <div className="order-inspector-contact"><a className="btn btn-secondary" href={`tel:${current.mobile}`}>Call</a><a className="btn btn-secondary" href={`sms:${current.mobile}`}>SMS</a><a className="btn btn-secondary" href={`https://wa.me/${current.mobile.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a></div>
        {canTransition && <section className="order-inspector-primary"><span>Allowed next actions</span><OrderActionBar order={current} compact confirmAll onTransition={(next, reason) => transition(next, reason)} /></section>}
        {canUpdate && <form className="order-inspector-note" onSubmit={(event) => void addNote(event)}><label className="field"><span>Add internal note</span><textarea name="body" rows={2} required /></label><button className="btn btn-secondary" disabled={busy}>Add note</button></form>}
        <section><div className="section-inline-heading"><div><p className="admin-section-kicker">Recent activity</p><h3>Audit trail</h3></div></div><div className="order-inspector-activity">{detail.audit.slice(0, 5).map((event) => <div key={event.id}><strong>{event.action.replace("order.", "").replaceAll("_", " ")}</strong><small>{event.actor} · {new Date(event.createdAt).toLocaleString("fi-FI")}</small></div>)}{detail.audit.length === 0 && <p>No activity recorded.</p>}</div></section>
      </div>}
      <footer className="order-inspector-footer">
        <div className="flex items-center gap-2">
          {canUpdate && !isClosed && <a className="btn" href={`/admin/orders/${order.id}/edit`}>Edit order ✏️</a>}
          <a className="btn btn-secondary" href={`/admin/orders/${order.id}`}>Open full detail ↗</a>
        </div>
        <span>Esc closes · ↑/↓ moves</span>
      </footer>
    </aside>
  </div>;
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}
