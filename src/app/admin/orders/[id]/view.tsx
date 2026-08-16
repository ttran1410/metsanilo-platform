"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminStatusBadge } from "../../presentation";
import { getLifecycleSteps } from "@/domain/order-transitions";

type Snapshot = { address?: string; nameEn?: string; instructionsEn?: string };

type Detail = {
  order: {
    id: string;
    publicReference: string;
    status: string;
    version: number;
    customerName: string;
    mobile: string | null;
    email: string | null;
    facebookProfile?: string | null;
    orderSource?: string;
    productNameFi: string;
    packageLabelFi: string;
    quantity?: number;
    fulfillmentDate: string;
    fulfillmentMethod: string;
    volumeMl: number;
    itemSubtotalCents: number;
    deliveryFeeCents: number | null;
    finalTotalCents: number | null;
    streetAddress: string | null;
    postalCode: string | null;
    city: string | null;
    pickupLocationSnapshotJson: string | null;
    deliveryOriginSnapshotJson: string | null;
  };
  notes: Array<{ id: string; body: string; actor: string; createdAt: string }>;
  payments: Array<{ id: string; amountCents: number; method: string; kind: string; recordedAt: string }>;
  audit: Array<{ id: string; action: string; actor: string; createdAt: string; detailsJson: string }>;
  paymentSummary: { paidCents: number; refundedCents: number; outstandingCents: number; status: string };
};

const money = (cents: number | null) =>
  cents === null ? "To be agreed" : new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(cents / 100);

function snapshot(value: string | null): Snapshot | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Snapshot;
  } catch {
    return null;
  }
}

function formatFacebookLink(profile: string | null | undefined) {
  if (!profile || !profile.trim()) return null;
  const trimmed = profile.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const label = trimmed.replace(/^https?:\/\/(www\.)?facebook\.com\/?/, "@").replace(/\/$/, "");
    return { url: trimmed, label: label || "Facebook Profile" };
  }
  if (trimmed.includes("facebook.com/") || trimmed.includes("fb.com/")) {
    const url = `https://${trimmed.replace(/^https?:\/\//, "")}`;
    return { url, label: trimmed };
  }
  const cleanHandle = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (/^[a-zA-Z0-9.]+$/.test(cleanHandle)) {
    return { url: `https://facebook.com/${cleanHandle}`, label: `@${cleanHandle}` };
  }
  return { url: null, label: trimmed };
}

function formatSourceLabel(source?: string) {
  switch (source) {
    case "WEBSITE":
      return "🌐 Website";
    case "MANUAL":
      return "📝 Manual Intake";
    case "SMS":
      return "💬 SMS";
    case "WHATSAPP":
      return "🟢 WhatsApp";
    case "FACEBOOK_MESSAGE":
      return "📘 Facebook Message";
    case "PHONE":
      return "📞 Phone Call";
    default:
      return source ? `📌 ${source}` : "🌐 Website";
  }
}

export function OrderDetailView({ initial, initialNotice = "", canDelete = false }: { initial: Detail; initialNotice?: string; canDelete?: boolean }) {
  const router = useRouter();
  const [detail, setDetail] = useState(initial);
  const [message, setMessage] = useState(initialNotice);
  const [copied, setCopied] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moneyTab, setMoneyTab] = useState<"pricing" | "payment" | "exception">("pricing");
  const [recordTab, setRecordTab] = useState<"notes" | "audit">("notes");

  const lifecycle: string[] = getLifecycleSteps(detail.order.fulfillmentMethod);
  const isClosed = ["CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW", "DELIVERED", "PICKED_UP", "REFUNDED"].includes(detail.order.status);
  const fbInfo = formatFacebookLink(detail.order.facebookProfile);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 10_000);
    return () => window.clearTimeout(timer);
  }, [message]);

  function copyText(value: string, label: string) {
    if (!value) return;
    void navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 2000);
  }

  async function refresh() {
    const response = await fetch(`/api/admin/orders/${detail.order.id}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { pragma: "no-cache" },
    });
    const body = await response.json();
    if (response.ok && body.data) setDetail(body.data);
  }

  async function transition(next: string, reason?: string) {
    const response = await fetch(`/api/admin/orders/${detail.order.id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next, expectedVersion: detail.order.version, reason, contactChannel: next === "CONFIRMED" ? "PHONE" : undefined }),
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? body.code ?? "Status update failed");
    setPendingCancel(false);
    await refresh();
    setMessage(`Order updated: ${next.replaceAll("_", " ")}`);
  }

  async function handleConfirmDeleteOrder() {
    setDeleting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${detail.order.id}`, { method: "DELETE" });
      const body = await response.json();
      setDeleting(false);
      if (!response.ok) throw new Error(body.message ?? "Delete failed");
      router.push("/admin/orders");
    } catch (err) {
      setDeleting(false);
      setMessage(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function submitAction(event: FormEvent<HTMLFormElement>, kind: "note" | "payment" | "pricing" | "exception") {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const endpoint = kind === "note" ? "notes" : kind === "payment" ? "payment" : kind === "pricing" ? "pricing" : "delivery-exception";
    const payload =
      kind === "note"
        ? { body: values.get("body") }
        : kind === "payment"
        ? { amountCents: Math.round(Number(values.get("paymentEuros")) * 100), method: values.get("method"), reference: String(values.get("reference") ?? "").trim() || undefined }
        : kind === "pricing"
        ? {
            expectedVersion: detail.order.version,
            itemSubtotalCents: Math.round(Number(values.get("itemEuros")) * 100),
            deliveryFeeCents: detail.order.fulfillmentMethod === "DELIVERY" ? (values.get("feeEuros") === "" ? null : Math.round(Number(values.get("feeEuros")) * 100)) : 0,
            reason: values.get("reason"),
          }
        : { type: values.get("type"), nextAction: values.get("nextAction"), note: values.get("note"), rescheduledDate: values.get("rescheduledDate") || undefined };

    const response = await fetch(`/api/admin/orders/${detail.order.id}/${endpoint}`, {
      method: kind === "note" || kind === "payment" || kind === "exception" ? "POST" : "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? body.code ?? "Order update failed");
    event.currentTarget.reset();
    if (body.data && "order" in body.data) {
      setDetail(body.data);
    }
    await refresh();
    setMessage(`Order ${kind} recorded.`);
  }

  const configuredLocation = snapshot(detail.order.fulfillmentMethod === "PICKUP" ? detail.order.pickupLocationSnapshotJson : detail.order.deliveryOriginSnapshotJson);
  const location = configuredLocation ?? (detail.order.fulfillmentMethod === "DELIVERY" ? { nameEn: "Delivery origin not configured", address: "Agree origin before calculating route or fee." } : null);
  const locationName = location?.nameEn ?? "Fulfillment location";

  return (
    <div className="order-detail-workspace flex flex-col gap-4">
      {/* UNIFIED HERO HEADER CARD (Mobile-First High Density Layout) */}
      <header className="card admin-order-hero flex flex-col gap-3 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
          <div className="flex flex-col gap-1">
            <Link className="back-link text-xs font-semibold text-muted hover:text-primary mb-0.5 inline-flex items-center gap-1" href="/admin/orders">
              ← Order queue
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="ops-tabular text-2xl font-bold tracking-tight">{detail.order.publicReference}</h1>
              <AdminStatusBadge status={detail.order.status} />
              <span className="text-xs px-2 py-0.5 rounded bg-surface-muted border border-line font-medium muted">
                {formatSourceLabel(detail.order.orderSource)}
              </span>
              <button type="button" className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => copyText(detail.order.publicReference, "Ref")}>
                {copied === "Ref" ? "✓ Copied" : "Copy Ref"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted mt-1">
              <span>📅 Date: <strong className="text-ink font-medium">{detail.order.fulfillmentDate}</strong></span>
              <span>🚚 Method: <strong className="text-ink font-medium">{detail.order.fulfillmentMethod}</strong></span>
              <span>📦 Subtotal: <strong className="text-ink font-medium">{money(detail.order.itemSubtotalCents)}</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isClosed && (
              <Link className="btn btn-secondary text-xs py-1.5 px-3" href={`/admin/orders/${detail.order.id}/edit?from=${encodeURIComponent(`/admin/orders/${detail.order.id}`)}`}>
                Edit order ✏️
              </Link>
            )}

            {canDelete ? (
              <button
                type="button"
                className="btn btn-secondary text-xs py-1.5 px-3 text-rose-700 hover:bg-rose-50 hover:border-rose-300 font-bold"
                onClick={() => setPendingDelete(true)}
                title="Permanently delete order"
              >
                🗑️ Delete order
              </button>
            ) : (
              <button
                type="button"
                disabled
                title="🔒 Requires Permanent Delete permission (orders.delete). Contact Store Owner to grant access."
                className="btn btn-secondary text-xs py-1.5 px-3 text-ink/30 cursor-not-allowed opacity-50 font-bold"
              >
                🔒 🗑️ Delete
              </button>
            )}

            {/* Quick Action Bar inside Header */}
            {detail.order.status === "NEW" && (
              <button className="btn text-xs py-1.5 px-3" type="button" onClick={() => void transition("CONFIRMED")}>
                Confirm order ✓
              </button>
            )}
            {detail.order.status === "CONFIRMED" && (
              <button className="btn text-xs py-1.5 px-3" type="button" onClick={() => void transition("PICKING")}>
                Start picking 🧺
              </button>
            )}
            {detail.order.status === "PICKING" && (
              <button className="btn text-xs py-1.5 px-3" type="button" onClick={() => void transition("READY")}>
                Mark ready 📦
              </button>
            )}
            {detail.order.status === "READY" && (
              <button className="btn text-xs py-1.5 px-3" type="button" onClick={() => void transition(detail.order.fulfillmentMethod === "PICKUP" ? "PICKED_UP" : "OUT_FOR_DELIVERY")}>
                {detail.order.fulfillmentMethod === "PICKUP" ? "Confirm pickup 🤝" : "Dispatch delivery 🚚"}
              </button>
            )}
            {detail.order.status === "OUT_FOR_DELIVERY" && (
              <button className="btn text-xs py-1.5 px-3" type="button" onClick={() => void transition("DELIVERED")}>
                Mark delivered ✅
              </button>
            )}
            {!isClosed && (
              <button className="btn btn-danger text-xs py-1.5 px-2.5" type="button" onClick={() => setPendingCancel(true)}>
                Cancel ✕
              </button>
            )}
          </div>
        </div>

        {/* Customer & Communication Quick Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div>
              <span className="muted">Customer: </span>
              <strong className="text-sm font-semibold">{detail.order.customerName}</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono">{detail.order.mobile ?? "No phone"}</span>
              {detail.order.mobile && (
                <button type="button" className="btn btn-secondary text-xs py-0 px-1.5" onClick={() => copyText(detail.order.mobile!, "Phone")}>
                  {copied === "Phone" ? "✓" : "Copy"}
                </button>
              )}
            </div>
            {detail.order.email && <span className="muted">✉️ {detail.order.email}</span>}
            {fbInfo && (
              <span className="muted flex items-center gap-1">
                📘 {fbInfo.url ? (
                  <a className="text-primary underline font-medium" href={fbInfo.url} target="_blank" rel="noreferrer">
                    {fbInfo.label} ↗
                  </a>
                ) : (
                  <span>{fbInfo.label}</span>
                )}
              </span>
            )}
          </div>

          {detail.order.mobile && (
            <div className="flex items-center gap-1.5">
              <a className="btn btn-secondary text-xs py-1 px-2.5" href={`tel:${detail.order.mobile}`}>📞 Call</a>
              <a className="btn btn-secondary text-xs py-1 px-2.5" href={`sms:${detail.order.mobile}`}>💬 SMS</a>
              <a className="btn btn-secondary text-xs py-1 px-2.5" href={`https://wa.me/${detail.order.mobile.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">🟢 WhatsApp</a>
            </div>
          )}
        </div>

        {/* Compact Horizontal Progression Stepper */}
        <div className="compact-stepper flex items-center gap-1.5 pt-3 border-t border-line overflow-x-auto text-xs">
          {lifecycle.map((step, idx) => {
            const currentIdx = lifecycle.indexOf(detail.order.status);
            const isDone = currentIdx > idx;
            const isCurrent = currentIdx === idx;
            return (
              <div className="flex items-center gap-1.5 whitespace-nowrap" key={step}>
                <span
                  className={`px-2.5 py-1 rounded-full font-medium ${
                    isCurrent ? "bg-primary text-on-primary font-bold shadow-sm" : isDone ? "bg-primary-soft text-primary font-medium" : "bg-surface-muted text-ink-muted"
                  }`}
                >
                  {isDone ? "✓ " : `${idx + 1}. `}
                  {step.replaceAll("_", " ")}
                </span>
                {idx < lifecycle.length - 1 && <span className="text-muted">→</span>}
              </div>
            );
          })}
        </div>
      </header>

      {/* Dismissible Notification Toast */}
      {message && (
        <div className="card admin-toast flex items-center justify-between gap-2 py-2.5 px-4 bg-primary-soft text-primary rounded-md text-sm" role="status">
          <span>{message}</span>
          <button type="button" className="text-sm font-bold text-primary hover:opacity-75" onClick={() => setMessage("")} aria-label="Dismiss notice">
            ×
          </button>
        </div>
      )}

      {/* MAIN 2-COLUMN BALANCED DASHBOARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN: Summary, Items & Logistics (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <section className="card flex flex-col gap-4 p-4 md:p-5">
            <div className="section-inline-heading border-b border-line pb-2">
              <div>
                <p className="eyebrow">FULFILLMENT &amp; LOGISTICS</p>
                <h2 className="text-base font-semibold">Order Items &amp; Delivery Address</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-surface-muted rounded-md flex flex-col justify-between">
                <div>
                  <span className="muted block text-xs font-bold uppercase mb-1">Product &amp; Package</span>
                  <strong className="block text-base text-ink">{detail.order.productNameFi}</strong>
                  <span className="block muted text-xs mt-0.5">{detail.order.packageLabelFi}</span>
                </div>
                <div className="mt-3 pt-2 border-t border-line flex items-center justify-between">
                  <span className="text-xs muted">Quantity &amp; Volume:</span>
                  <span className="ops-tabular font-bold text-primary">
                    {detail.order.quantity ?? 1} × {(detail.order.volumeMl / 1000).toFixed(0)} L ({(detail.order.volumeMl / 1000).toFixed(0)} L total)
                  </span>
                </div>
              </div>

              <div className="p-3 bg-surface-muted rounded-md flex flex-col justify-between">
                <div>
                  <span className="muted block text-xs font-bold uppercase mb-1">Customer Info</span>
                  <strong className="block text-base">{detail.order.customerName}</strong>
                  <span className="block font-mono text-xs text-ink mt-0.5">{detail.order.mobile}</span>
                  {detail.order.email && <small className="block muted text-xs mt-0.5">{detail.order.email}</small>}
                </div>
                {fbInfo && (
                  <div className="mt-3 pt-2 border-t border-line text-xs">
                    <span className="muted">Facebook: </span>
                    {fbInfo.url ? (
                      <a className="text-primary underline font-medium" href={fbInfo.url} target="_blank" rel="noreferrer">
                        {fbInfo.label} ↗
                      </a>
                    ) : (
                      <span>{fbInfo.label}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Location & Address Info */}
            {location && (
              <div className="p-3.5 bg-surface-muted rounded-md text-sm border border-line">
                <span className="text-xs font-bold uppercase muted block mb-1">
                  {detail.order.fulfillmentMethod === "PICKUP" ? "Pickup Location" : "Delivery Origin"}
                </span>
                <strong>{locationName}</strong> · <span className="muted">{location.address}</span>
                {location.instructionsEn && <p className="text-xs muted mt-1 italic">{location.instructionsEn}</p>}

                {detail.order.fulfillmentMethod === "DELIVERY" && detail.order.streetAddress && (
                  <div className="mt-3 pt-2.5 border-t border-line">
                    <span className="text-xs font-bold uppercase muted block mb-1">Customer Delivery Address</span>
                    <strong className="text-base text-ink block">
                      {detail.order.streetAddress}, {detail.order.postalCode} {detail.order.city}
                    </strong>
                    <div className="mt-1.5">
                      <a
                        className="btn btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1 font-medium text-primary"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${detail.order.streetAddress}, ${detail.order.postalCode ?? ""} ${detail.order.city ?? ""}`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        📍 Open route in Google Maps ↗
                      </a>
                    </div>
                  </div>
                )}
                {detail.order.fulfillmentMethod === "PICKUP" && (
                  <div className="mt-2 pt-2 border-t border-line">
                    <a
                      className="text-xs text-primary underline font-medium"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address ?? "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      📍 Open pickup location map ↗
                    </a>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: Money & Internal Records (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Card 1: Money & Billing */}
          <section className="card flex flex-col gap-3 p-4 md:p-5">
            <div className="section-inline-heading border-b border-line pb-2">
              <div>
                <p className="eyebrow">MONEY &amp; BILLING</p>
                <h2 className="text-base font-semibold">Pricing &amp; Payments</h2>
              </div>
            </div>

            {/* Financial Overview Grid */}
            <div className="p-3 bg-surface-muted rounded-md text-sm grid grid-cols-2 gap-2 border border-line">
              <div>
                <span className="text-xs muted block">Items Subtotal</span>
                <strong className="ops-tabular text-ink">{money(detail.order.itemSubtotalCents)}</strong>
              </div>
              <div>
                <span className="text-xs muted block">Delivery Fee</span>
                <strong className="ops-tabular text-ink">{money(detail.order.deliveryFeeCents)}</strong>
              </div>
              <div className="pt-2 border-t border-line">
                <span className="text-xs muted block">Order Total</span>
                <strong className="ops-tabular text-base text-ink">{money(detail.order.finalTotalCents)}</strong>
              </div>
              <div className="pt-2 border-t border-line">
                <span className="text-xs muted block">Outstanding Balance</span>
                <strong className={`ops-tabular text-base ${detail.paymentSummary.outstandingCents > 0 ? "text-amber-700 font-bold" : "text-emerald-700 font-bold"}`}>
                  {money(detail.paymentSummary.outstandingCents)}
                </strong>
                <small className="block text-xs muted font-medium">Status: {detail.paymentSummary.status}</small>
              </div>
            </div>

            {/* Money Form Sub-Tabs */}
            <div className="flex border-b border-line gap-2 text-xs font-semibold mt-1">
              <button
                type="button"
                className={`pb-2 px-1 border-b-2 ${moneyTab === "pricing" ? "border-primary text-primary" : "border-transparent text-ink-muted"}`}
                onClick={() => setMoneyTab("pricing")}
              >
                ✍️ Adjust Price/Fee
              </button>
              <button
                type="button"
                className={`pb-2 px-1 border-b-2 ${moneyTab === "payment" ? "border-primary text-primary" : "border-transparent text-ink-muted"}`}
                onClick={() => setMoneyTab("payment")}
              >
                💵 Record Payment
              </button>
              {detail.order.fulfillmentMethod === "DELIVERY" && (
                <button
                  type="button"
                  className={`pb-2 px-1 border-b-2 ${moneyTab === "exception" ? "border-primary text-primary" : "border-transparent text-ink-muted"}`}
                  onClick={() => setMoneyTab("exception")}
                >
                  ⚠️ Delivery Exception
                </button>
              )}
            </div>

            {/* Tab 1: Adjust Pricing / Delivery Fee */}
            {moneyTab === "pricing" && (
              <form key={`pricing-${detail.order.version}`} className="detail-form text-sm flex flex-col gap-2.5" onSubmit={(event) => void submitAction(event, "pricing")}>
                <label className="field">
                  <span>Agreed items price (€)</span>
                  <input name="itemEuros" type="number" min="0" step="0.01" defaultValue={(detail.order.itemSubtotalCents / 100).toFixed(2)} required />
                </label>
                {detail.order.fulfillmentMethod === "DELIVERY" && (
                  <label className="field">
                    <span>Delivery fee (€)</span>
                    <input name="feeEuros" type="number" min="0" step="0.01" defaultValue={detail.order.deliveryFeeCents === null ? "" : (detail.order.deliveryFeeCents / 100).toFixed(2)} placeholder="To be agreed" />
                  </label>
                )}
                <label className="field">
                  <span>Adjustment reason</span>
                  <input name="reason" minLength={2} placeholder="Discount or customer container" required />
                </label>
                <button className="btn btn-secondary text-xs py-1.5" type="submit">
                  Save pricing updates
                </button>
              </form>
            )}

            {/* Tab 2: Record Payment */}
            {moneyTab === "payment" && (
              <form className="detail-form text-sm flex flex-col gap-2.5" onSubmit={(event) => void submitAction(event, "payment")}>
                <label className="field">
                  <span>Payment (€)</span>
                  <input name="paymentEuros" type="number" min="0.01" step="0.01" placeholder="0.00" required />
                </label>
                <label className="field">
                  <span>Method</span>
                  <select name="method" defaultValue="CASH" required>
                    <option value="CASH">CASH</option>
                    <option value="MOBILEPAY">MOBILEPAY</option>
                    <option value="CARD">CARD</option>
                    <option value="BANK_TRANSFER">BANK TRANSFER</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </label>
                <label className="field">
                  <span>Reference (Optional)</span>
                  <input name="reference" placeholder="Transaction ref" />
                </label>
                <button className="btn text-xs py-1.5" type="submit">
                  Record payment
                </button>
              </form>
            )}

            {/* Tab 3: Delivery Exception */}
            {moneyTab === "exception" && detail.order.fulfillmentMethod === "DELIVERY" && (
              <form className="detail-form text-sm flex flex-col gap-2.5" onSubmit={(event) => void submitAction(event, "exception")}>
                <label className="field">
                  <span>Exception Type</span>
                  <select name="type">
                    <option value="CUSTOMER_UNAVAILABLE">Customer unavailable</option>
                    <option value="ADDRESS_ISSUE">Address issue</option>
                    <option value="DELIVERY_DELAYED">Delivery delayed</option>
                    <option value="DELIVERY_FAILED">Delivery failed</option>
                    <option value="RESCHEDULED">Rescheduled</option>
                  </select>
                </label>
                <label className="field">
                  <span>Next Action</span>
                  <input name="nextAction" placeholder="e.g. Call customer at 5 PM" required />
                </label>
                <label className="field">
                  <span>Note</span>
                  <textarea name="note" rows={2} placeholder="Additional details" />
                </label>
                <button className="btn btn-secondary text-xs py-1.5" type="submit">
                  Record exception
                </button>
              </form>
            )}
          </section>

          {/* Card 2: Internal Records */}
          <section className="card flex flex-col gap-3 p-4 md:p-5">
            <div className="section-inline-heading border-b border-line pb-2">
              <div>
                <p className="eyebrow">INTERNAL RECORDS</p>
                <h2 className="text-base font-semibold">Staff Notes &amp; Audit Trail</h2>
              </div>
            </div>

            <div className="flex border-b border-line gap-2 text-xs font-semibold">
              <button
                type="button"
                className={`pb-2 px-1 border-b-2 ${recordTab === "notes" ? "border-primary text-primary" : "border-transparent text-ink-muted"}`}
                onClick={() => setRecordTab("notes")}
              >
                📝 Staff Notes ({detail.notes.length})
              </button>
              <button
                type="button"
                className={`pb-2 px-1 border-b-2 ${recordTab === "audit" ? "border-primary text-primary" : "border-transparent text-ink-muted"}`}
                onClick={() => setRecordTab("audit")}
              >
                📜 Audit Log ({detail.audit.length})
              </button>
            </div>

            {recordTab === "notes" && (
              <div className="flex flex-col gap-3">
                <form className="detail-form text-sm flex flex-col gap-2" onSubmit={(event) => void submitAction(event, "note")}>
                  <label className="field">
                    <span>Add staff note</span>
                    <textarea name="body" rows={2} placeholder="Write internal comment..." required />
                  </label>
                  <button className="btn btn-secondary text-xs py-1 px-3 self-end" type="submit">
                    Add note
                  </button>
                </form>

                <div className="customer-audit-list max-h-48 overflow-y-auto flex flex-col gap-2 text-xs">
                  {detail.notes.map((note) => (
                    <div className="p-2 bg-surface-muted rounded border border-line" key={note.id}>
                      <strong className="block text-ink">{note.body}</strong>
                      <span className="muted text-xs">
                        {note.actor} · {new Date(note.createdAt).toLocaleString("fi-FI")}
                      </span>
                    </div>
                  ))}
                  {detail.notes.length === 0 && <p className="muted text-xs">No internal notes added yet.</p>}
                </div>
              </div>
            )}

            {recordTab === "audit" && (
              <div className="customer-audit-list max-h-64 overflow-y-auto flex flex-col gap-2 text-xs">
                {detail.audit.slice(0, 10).map((event) => (
                  <div className="p-2 border-b border-line" key={event.id}>
                    <strong className="block text-ink">{event.action.replace("order.", "").replaceAll("_", " ")}</strong>
                    <span className="muted text-xs">
                      {event.actor} · {new Date(event.createdAt).toLocaleString("fi-FI")}
                    </span>
                  </div>
                ))}
                {detail.audit.length === 0 && <p className="muted text-xs">No system audit events recorded.</p>}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Cancel Order Dialog */}
      {pendingCancel && (
        <div className="admin-dialog-backdrop">
          <form
            className="admin-dialog card"
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              void transition("CANCELLED", String(values.get("reason") ?? ""));
            }}
          >
            <h2>Cancel this order?</h2>
            <label className="field">
              <span>Reason</span>
              <textarea name="reason" required placeholder="Explain why the order is being cancelled..." />
            </label>
            <div className="profile-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setPendingCancel(false)}>
                Keep order
              </button>
              <button className="btn btn-danger" type="submit">
                Cancel order
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Order Safe-Guard Dialog */}
      {pendingDelete && (
        <div className="admin-dialog-backdrop">
          <div className="admin-dialog card max-w-md w-full p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-danger border-b border-line pb-2">
              <span className="text-xl">⚠️</span>
              <h3 className="text-lg font-bold text-ink">Delete Order {detail.order.publicReference}</h3>
            </div>

            {detail.payments.reduce((sum, p) => sum + (p.kind === "PAYMENT" ? p.amountCents : -p.amountCents), 0) > 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex flex-col gap-1 font-medium">
                <strong className="font-bold text-amber-950">🔒 Paid Order Protected</strong>
                <span>
                  This order has recorded payments and cannot be deleted to preserve tax and financial compliance. Please refund or cancel the order instead.
                </span>
              </div>
            ) : (
              <p className="text-xs text-ink leading-relaxed">
                Are you sure you want to <strong>permanently delete</strong> order <strong>{detail.order.publicReference}</strong>? This action cannot be undone, will release reserved harvest volume, and update customer stats.
              </p>
            )}

            <div className="profile-actions justify-end gap-2 border-t border-line pt-3">
              <button type="button" className="btn btn-secondary text-xs" onClick={() => setPendingDelete(false)} disabled={deleting}>
                Cancel
              </button>
              {detail.payments.reduce((sum, p) => sum + (p.kind === "PAYMENT" ? p.amountCents : -p.amountCents), 0) <= 0 && (
                <button type="button" className="btn text-xs font-bold bg-danger text-white py-1.5 px-4 shadow-md" onClick={() => void handleConfirmDeleteOrder()} disabled={deleting}>
                  {deleting ? "Deleting…" : "🗑️ Yes, Permanently Delete"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
