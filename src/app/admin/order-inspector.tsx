"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown, ChevronUp, ExternalLink, MessageSquare, Pencil, Phone, Share2, X } from "lucide-react";
import type { orders } from "@/db/schema";
import { AdminLoadingState, AdminNotice, AdminStatusBadge, formatAdminMoney } from "./presentation";
import { OrderActionBar } from "./orders/detail/order-action-bar";
import { IconCopy } from "./ui/admin-row-action-menu";
import { useOrderNoteActionController } from "./orders/use-order-note-action-controller";
import { useOrderStatusActionController } from "./use-order-status-action-controller";

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
  const saveNote = useOrderNoteActionController({ onError: setError });
  const submitStatus = useOrderStatusActionController({ onError: setError, onSuccess: (data) => { if (data) onOrderUpdated(data as Order); void load(); } });

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
    const succeeded = await submitStatus(current, next, reason);
    setBusy(false);
    if (!succeeded) return;
    setNotice(`${current.publicReference} moved to ${next.replaceAll("_", " ")}.`);
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const bodyText = String(new FormData(form).get("body") ?? "").trim();
    if (!bodyText) return;
    setBusy(true);
    const saved = await saveNote(order.id, bodyText);
    setBusy(false);
    if (!saved) return;
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
            <button
              type="button"
              className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer"
              onClick={() => copyText(order.publicReference, "Ref")}
              title="Copy Order Reference"
            >
              <IconCopy className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="order-inspector-nav">
          {canUpdate && !isClosed && (
            <a
              className="btn btn-secondary text-xs py-1 px-2.5"
              href={`/admin/orders/${order.id}/edit?from=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : `/admin/orders`)}`}
            >
              <Pencil aria-hidden="true" />Edit order
            </a>
          )}
          <button type="button" onClick={onPrevious} disabled={!onPrevious} aria-label="Previous order"><ChevronUp aria-hidden="true" /></button>
          <button type="button" onClick={onNext} disabled={!onNext} aria-label="Next order"><ChevronDown aria-hidden="true" /></button>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close inspector"><X aria-hidden="true" /></button>
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
              <div className="flex items-center gap-1.5 mt-0.5">
                <span>{current.mobile ?? "No phone"}</span>
                {current.mobile && (
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer"
                    onClick={() => copyText(current.mobile!, "Phone")}
                    title="Copy Phone Number"
                  >
                    <IconCopy className="w-3.5 h-3.5" />
                  </button>
                )}
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
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer"
                    onClick={() => copyText(`${current.streetAddress}, ${current.postalCode ?? ""} ${current.city ?? ""}`.trim(), "Address")}
                    title="Copy Full Address"
                  >
                    <IconCopy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <span>{[current.postalCode, current.city].filter(Boolean).join(" ") || "Postal code or city missing"} · Fee {formatAdminMoney(current.deliveryFeeCents)}</span>
            </dd>
          </div>}
        </dl>
        <div className="order-inspector-contact">
          {current.mobile && (
            <>
              <a className="btn btn-secondary flex items-center justify-center gap-1.5" href={`tel:${current.mobile}`}>
                <Phone className="w-3.5 h-3.5" />
                <span>Call</span>
              </a>
              <a className="btn btn-secondary flex items-center justify-center gap-1.5" href={`sms:${current.mobile}`}>
                <MessageSquare className="w-3.5 h-3.5" />
                <span>SMS</span>
              </a>
              <a className="btn btn-secondary flex items-center justify-center gap-1.5" href={`https://wa.me/${current.mobile.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            </>
          )}
          {current.facebookProfile && (
            <a className="btn btn-secondary font-semibold text-blue-700 flex items-center justify-center gap-1.5" href={current.facebookProfile.startsWith("http") ? current.facebookProfile : `https://facebook.com/${current.facebookProfile.replace(/^@/, "")}`} target="_blank" rel="noreferrer">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Facebook</span>
            </a>
          )}
        </div>
        {canTransition && <section className="order-inspector-primary"><span>Allowed next actions</span><OrderActionBar order={current} compact confirmAll onTransition={(next, reason) => transition(next, reason)} /></section>}
        {canUpdate && <form className="order-inspector-note" onSubmit={(event) => void addNote(event)}><label className="field"><span>Add internal note</span><textarea name="body" rows={2} required /></label><button className="btn btn-secondary" disabled={busy}>Add note</button></form>}
        <section><div className="section-inline-heading"><div><p className="admin-section-kicker">Recent activity</p><h3>Audit trail</h3></div></div><div className="order-inspector-activity">{detail.audit.slice(0, 5).map((event) => <div key={event.id}><strong>{event.action.replace("order.", "").replaceAll("_", " ")}</strong><small>{event.actor} · {new Date(event.createdAt).toLocaleString("fi-FI")}</small></div>)}{detail.audit.length === 0 && <p>No activity recorded.</p>}</div></section>
      </div>}
      <footer className="order-inspector-footer">
        <div className="flex items-center gap-2">
          {canUpdate && !isClosed && (
            <a
              className="btn"
              href={`/admin/orders/${order.id}/edit?from=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : `/admin/orders`)}`}
            >
              <Pencil aria-hidden="true" />Edit order
            </a>
          )}
          <a className="btn btn-secondary" href={`/admin/orders/${order.id}`}>
            Open full detail<ExternalLink aria-hidden="true" />
          </a>
        </div>
        <span>Esc closes · ↑/↓ moves</span>
      </footer>

    </aside>
  </div>;
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}
