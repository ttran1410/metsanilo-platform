"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminNotice, AdminStatusBadge } from "../../presentation";
import { getLifecycleSteps } from "@/domain/order-transitions";
import { IconCopy } from "../../ui/admin-row-action-menu";

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
      return "📘 Facebook";
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
  const [activeModal, setActiveModal] = useState<null | "pricing" | "payment" | "exception">(null);
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

  const [modalError, setModalError] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  function openModal(kind: null | "pricing" | "payment" | "exception") {
    setModalError("");
    setActiveModal(kind);
  }

  async function submitAction(event: FormEvent<HTMLFormElement>, kind: "note" | "payment" | "pricing" | "exception") {
    event.preventDefault();
    if (submittingAction) return;
    setSubmittingAction(true);
    setMessage("");
    setModalError("");

    const formElement = event.currentTarget; // Safely capture before async boundary!

    try {
      const values = new FormData(formElement);
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
      if (!response.ok) {
        const errText = body.message ?? body.code ?? "Order update failed";
        if (kind !== "note") {
          setModalError(errText);
        } else {
          setMessage(errText);
        }
        return;
      }

      formElement.reset();
      setActiveModal(null);
      setModalError("");
      if (body.data && "order" in body.data) {
        setDetail(body.data);
      }
      await refresh();
      setMessage(`Order ${kind} recorded.`);
    } catch (err) {
      const errText = err instanceof Error ? err.message : "Action failed";
      if (kind !== "note") {
        setModalError(errText);
      } else {
        setMessage(errText);
      }
    } finally {
      setSubmittingAction(false);
    }
  }

  const configuredLocation = snapshot(detail.order.fulfillmentMethod === "PICKUP" ? detail.order.pickupLocationSnapshotJson : detail.order.deliveryOriginSnapshotJson);
  const location = configuredLocation ?? (detail.order.fulfillmentMethod === "DELIVERY" ? { nameEn: "Delivery origin not configured", address: "Agree origin before calculating route or fee." } : null);
  const locationName = location?.nameEn ?? "Fulfillment location";

  // Quick Action transition helper for Primary CTA
  function getPrimaryNextAction() {
    switch (detail.order.status) {
      case "NEW":
        return { label: "Confirm Order ✓", target: "CONFIRMED" };
      case "CONFIRMED":
        return { label: "Start Picking 🧺", target: "PICKING" };
      case "PICKING":
        return { label: "Mark Ready 📦", target: "READY" };
      case "READY":
        return detail.order.fulfillmentMethod === "PICKUP"
          ? { label: "Confirm Pickup 🤝", target: "PICKED_UP" }
          : { label: "Dispatch Delivery 🚚", target: "OUT_FOR_DELIVERY" };
      case "OUT_FOR_DELIVERY":
        return { label: "Mark Delivered ✅", target: "DELIVERED" };
      default:
        return null;
    }
  }

  const primaryAction = getPrimaryNextAction();

  return (
    <div className="order-detail-workspace flex flex-col gap-4 pb-24 md:pb-6">
      {/* TIER 1: ORDER HERO HEADER & LIFECYCLE STEPPER */}
      <header className="card admin-order-hero flex flex-col gap-3 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
          <div className="flex flex-col gap-1">
            <Link className="back-link text-xs font-semibold text-muted hover:text-primary mb-0.5 inline-flex items-center gap-1" href="/admin/orders">
              ← Order queue
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="ops-tabular text-2xl font-bold tracking-tight">{detail.order.publicReference}</h1>
              <button
                type="button"
                className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer"
                onClick={() => copyText(detail.order.publicReference, "Ref")}
                title="Copy Order Reference"
              >
                <IconCopy className="w-4 h-4" />
              </button>
              <AdminStatusBadge status={detail.order.status} />
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-surface-muted border border-line font-semibold muted">
                {formatSourceLabel(detail.order.orderSource)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted mt-1 font-medium">
              <span>📅 Date: <strong className="text-ink font-bold">{detail.order.fulfillmentDate}</strong></span>
              <span>🚚 Method: <strong className="text-ink font-bold">{detail.order.fulfillmentMethod}</strong></span>
              <span>📦 Total: <strong className="text-ink font-bold">{money(detail.order.finalTotalCents ?? detail.order.itemSubtotalCents)}</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="btn btn-secondary text-xs py-1.5 px-3 font-semibold"
              href={`/admin/orders/${detail.order.id}/edit?from=${encodeURIComponent(`/admin/orders/${detail.order.id}`)}`}
            >
              Edit order ✏️
            </Link>

            {canDelete ? (
              <button
                type="button"
                className="btn btn-secondary text-xs py-1.5 px-3 text-rose-700 hover:bg-rose-50 hover:border-rose-300 font-bold"
                onClick={() => setPendingDelete(true)}
                title="Permanently delete order"
              >
                🗑️ Delete
              </button>
            ) : (
              <button
                type="button"
                disabled
                title="🔒 Requires Permanent Delete permission (orders.delete)."
                className="btn btn-secondary text-xs py-1.5 px-3 text-ink/30 cursor-not-allowed opacity-50 font-bold"
              >
                🔒 🗑️ Delete
              </button>
            )}

            {primaryAction && (
              <button className="btn text-xs py-1.5 px-3 font-bold" type="button" onClick={() => void transition(primaryAction.target)}>
                {primaryAction.label}
              </button>
            )}

            {!isClosed && (
              <button className="btn btn-danger text-xs py-1.5 px-2.5" type="button" onClick={() => setPendingCancel(true)}>
                Cancel ✕
              </button>
            )}
          </div>
        </div>

        {/* Compact Horizontal Stepper */}
        <div className="compact-stepper flex items-center gap-1.5 pt-1 overflow-x-auto text-xs">
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

      {/* Dismissible Toast Notification */}
      {message && (
        <div className="card admin-toast flex items-center justify-between gap-2 py-2.5 px-4 bg-primary-soft text-primary rounded-md text-sm font-medium" role="status">
          <span>{message}</span>
          <button type="button" className="text-sm font-bold text-primary hover:opacity-75" onClick={() => setMessage("")} aria-label="Dismiss notice">
            ×
          </button>
        </div>
      )}

      {/* TIER 2: BALANCED 2-COLUMN GRID (50-50) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CARD A (LEFT): ORDER ITEMS & LOGISTICS */}
        <section className="card flex flex-col gap-4 p-4 md:p-5">
          <div className="border-b border-line pb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <span>📦</span> 01. Items &amp; Logistics
            </h2>
            <span className="text-xs font-bold text-forest bg-primary-soft/80 px-2 py-0.5 rounded border border-forest/20">
              {(detail.order.volumeMl / 1000).toFixed(1)} L Total
            </span>
          </div>

          <div className="p-3.5 bg-surface-muted rounded-xl flex flex-col justify-between border border-line/60">
            <div>
              <span className="muted block text-[11px] font-bold uppercase tracking-wider mb-1">Product &amp; Package</span>
              <strong className="block text-base text-ink font-bold">{detail.order.productNameFi}</strong>
              <span className="block muted text-xs mt-0.5 font-medium">{detail.order.packageLabelFi}</span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-line/60 flex items-center justify-between text-xs">
              <span className="muted font-medium">Quantity × Unit Volume:</span>
              <span className="ops-tabular font-bold text-forest text-sm">
                {detail.order.quantity ?? 1} × {(detail.order.volumeMl / 1000 / (detail.order.quantity ?? 1)).toFixed(1)} L
              </span>
            </div>
          </div>

          {/* Location & Address Info */}
          {location && (
            <div className="p-3.5 bg-surface-muted rounded-xl text-xs border border-line/60 space-y-2">
              <div>
                <span className="font-bold uppercase muted block mb-0.5 text-[11px]">
                  {detail.order.fulfillmentMethod === "PICKUP" ? "Pickup Terminal Location" : "Delivery Origin"}
                </span>
                <strong className="text-sm text-ink">{locationName}</strong> · <span className="muted">{location.address}</span>
                {location.instructionsEn && <p className="muted italic mt-0.5">{location.instructionsEn}</p>}
              </div>

              {detail.order.fulfillmentMethod === "DELIVERY" && detail.order.streetAddress && (
                <div className="pt-2 border-t border-line/60 space-y-1.5">
                  <span className="font-bold uppercase muted block text-[11px]">Customer Delivery Address</span>
                  <strong className="text-sm text-ink block">
                    {detail.order.streetAddress}, {detail.order.postalCode} {detail.order.city}
                  </strong>
                  <a
                    className="btn btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 font-semibold text-forest shadow-xs"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${detail.order.streetAddress}, ${detail.order.postalCode ?? ""} ${detail.order.city ?? ""}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    📍 Open route in Google Maps ↗
                  </a>
                </div>
              )}

              {detail.order.fulfillmentMethod === "PICKUP" && (
                <div className="pt-1.5 border-t border-line/60">
                  <a
                    className="text-xs text-forest underline font-semibold inline-flex items-center gap-1"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address ?? "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    📍 Open pickup terminal map ↗
                  </a>
                </div>
              )}
            </div>
          )}
        </section>

        {/* CARD B (RIGHT): CUSTOMER DETAILS & 4-BUTTON CONTACT SUITE */}
        <section className="card flex flex-col gap-4 p-4 md:p-5">
          <div className="border-b border-line pb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <span>👤</span> 02. Customer Profile &amp; Contact
            </h2>
            <span className="text-xs font-bold text-muted bg-paper px-2 py-0.5 rounded border border-line">
              Source: {detail.order.orderSource ?? "WEBSITE"}
            </span>
          </div>

          <div className="p-3.5 bg-surface-muted rounded-xl border border-line/60 space-y-3">
            <div>
              <span className="muted block text-[11px] font-bold uppercase tracking-wider">Customer Name</span>
              <strong className="text-lg text-ink font-bold block">{detail.order.customerName}</strong>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-line/60">
              <div>
                <span className="muted block text-[11px] font-semibold">Mobile phone:</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <strong className="font-mono text-sm text-ink">{detail.order.mobile ?? "No phone"}</strong>
                  {detail.order.mobile && (
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer"
                      onClick={() => copyText(detail.order.mobile!, "Phone")}
                      title="Copy Phone Number"
                    >
                      <IconCopy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {detail.order.email && (
                <div>
                  <span className="muted block text-[11px] font-semibold">Email address:</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-ink font-medium truncate block">{detail.order.email}</span>
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer"
                      onClick={() => copyText(detail.order.email!, "Email")}
                      title="Copy Email Address"
                    >
                      <IconCopy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4-BUTTON CONTACT SUITE */}
          <div className="space-y-2 pt-1">
            <span className="block text-xs font-bold uppercase tracking-wider text-muted">Direct Communication</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {detail.order.mobile ? (
                <>
                  <a className="btn btn-secondary text-xs py-2 px-2.5 font-bold flex items-center justify-center gap-1 shadow-xs" href={`tel:${detail.order.mobile}`}>
                    📞 Call
                  </a>
                  <a className="btn btn-secondary text-xs py-2 px-2.5 font-bold flex items-center justify-center gap-1 shadow-xs" href={`sms:${detail.order.mobile}`}>
                    💬 SMS
                  </a>
                  <a
                    className="btn btn-secondary text-xs py-2 px-2.5 font-bold flex items-center justify-center gap-1 shadow-xs text-emerald-800 border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
                    href={`https://wa.me/${detail.order.mobile.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🟢 WhatsApp
                  </a>
                </>
              ) : (
                <div className="col-span-3 text-xs muted italic py-1">No mobile phone recorded for call/sms.</div>
              )}

              {fbInfo && fbInfo.url ? (
                <a
                  className="btn btn-secondary text-xs py-2 px-2.5 font-bold flex items-center justify-center gap-1 shadow-xs text-blue-900 border-blue-300 bg-blue-50 hover:bg-blue-100"
                  href={fbInfo.url}
                  target="_blank"
                  rel="noreferrer"
                  title={`Open Facebook profile: ${fbInfo.label}`}
                >
                  📘 Facebook ↗
                </a>
              ) : (
                <button type="button" disabled className="btn btn-secondary text-xs py-2 px-2.5 opacity-40 cursor-not-allowed">
                  📘 Facebook
                </button>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* TIER 3: COMPACT FINANCIAL STRIP & INTERNAL RECORDS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* FINANCIAL SUMMARY STRIP & MODAL TRIGGERS (Lg: 6 cols) */}
        <section className="card lg:col-span-6 flex flex-col justify-between p-4 md:p-5 space-y-4">
          <div className="border-b border-line pb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <span>💳</span> Financial Settlement
            </h2>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${detail.paymentSummary.outstandingCents > 0 ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-emerald-100 text-emerald-900 border border-emerald-300"}`}>
              {detail.paymentSummary.status}
            </span>
          </div>

          {/* 1-Row Compact Financial Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs p-3 bg-surface-muted rounded-xl border border-line/60">
            <div>
              <span className="muted text-[11px] block font-semibold">Subtotal</span>
              <strong className="ops-tabular text-sm font-bold text-ink">{money(detail.order.itemSubtotalCents)}</strong>
            </div>
            <div>
              <span className="muted text-[11px] block font-semibold">Delivery Fee</span>
              <strong className="ops-tabular text-sm font-bold text-ink">{money(detail.order.deliveryFeeCents)}</strong>
            </div>
            <div>
              <span className="muted text-[11px] block font-semibold">Total Order</span>
              <strong className="ops-tabular text-sm font-bold text-ink">{money(detail.order.finalTotalCents)}</strong>
            </div>
            <div>
              <span className="muted text-[11px] block font-semibold">Balance Due</span>
              <strong className={`ops-tabular text-sm font-bold ${detail.paymentSummary.outstandingCents > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {money(detail.paymentSummary.outstandingCents)}
              </strong>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" className="btn text-xs py-1.5 px-3 font-bold shadow-xs" onClick={() => openModal("payment")}>
              💵 Record Payment
            </button>
            <button type="button" className="btn btn-secondary text-xs py-1.5 px-3 font-semibold shadow-xs" onClick={() => openModal("pricing")}>
              ✍️ Adjust Pricing / Fee
            </button>
            {detail.order.fulfillmentMethod === "DELIVERY" && (
              <button type="button" className="btn btn-secondary text-xs py-1.5 px-3 font-semibold text-amber-800 shadow-xs" onClick={() => openModal("exception")}>
                ⚠️ Delivery Exception
              </button>
            )}
          </div>
        </section>

        {/* INTERNAL STAFF NOTES & AUDIT FEED (Lg: 6 cols) */}
        <section className="card lg:col-span-6 flex flex-col p-4 md:p-5 space-y-3">
          <div className="border-b border-line pb-2 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs font-bold">
              <button
                type="button"
                className={`pb-1 border-b-2 transition-all ${recordTab === "notes" ? "border-forest text-forest" : "border-transparent text-muted"}`}
                onClick={() => setRecordTab("notes")}
              >
                📝 Staff Notes ({detail.notes.length})
              </button>
              <button
                type="button"
                className={`pb-1 border-b-2 transition-all ${recordTab === "audit" ? "border-forest text-forest" : "border-transparent text-muted"}`}
                onClick={() => setRecordTab("audit")}
              >
                📜 Activity Log ({detail.audit.length})
              </button>
            </div>
          </div>

          {recordTab === "notes" && (
            <div className="flex flex-col gap-3">
              <form className="flex gap-2 text-xs" onSubmit={(event) => void submitAction(event, "note")}>
                <input name="body" className="flex-1 min-h-[38px] px-3 py-1.5 text-xs rounded-lg border border-line bg-paper" placeholder="Add staff comment..." required />
                <button className="btn btn-secondary text-xs py-1 px-3 min-h-[38px] font-bold" type="submit" disabled={submittingAction}>
                  {submittingAction ? "Adding…" : "Add"}
                </button>
              </form>

              <div className="max-h-36 overflow-y-auto flex flex-col gap-2 text-xs pr-1">
                {detail.notes.map((note) => (
                  <div className="p-2.5 bg-surface-muted rounded-lg border border-line/60" key={note.id}>
                    <strong className="block text-ink">{note.body}</strong>
                    <span className="muted text-[11px] font-medium">
                      {note.actor} · {new Date(note.createdAt).toLocaleString("fi-FI", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                ))}
                {detail.notes.length === 0 && <p className="muted text-xs italic py-1">No staff notes added yet.</p>}
              </div>
            </div>
          )}

          {recordTab === "audit" && (
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5 text-xs pr-1">
              {detail.audit.slice(0, 10).map((event) => (
                <div className="p-2 border-b border-line/60 flex items-center justify-between" key={event.id}>
                  <strong className="text-ink font-semibold">{event.action.replace("order.", "").replaceAll("_", " ")}</strong>
                  <span className="muted text-[11px]">
                    {event.actor} · {new Date(event.createdAt).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
              {detail.audit.length === 0 && <p className="muted text-xs italic py-1">No activity events recorded.</p>}
            </div>
          )}
        </section>
      </div>

      {/* FINANCIAL MODALS (Record Payment / Adjust Price / Delivery Exception) */}
      {activeModal && (
        <div className="admin-dialog-backdrop">
          <div className="admin-dialog card max-w-md w-full p-5 flex flex-col gap-4" role="dialog" aria-modal="true" aria-label="Order financial action">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h3 className="text-base font-bold text-ink">
                {activeModal === "payment" && "💵 Record Payment"}
                {activeModal === "pricing" && "✍️ Adjust Price & Fee"}
                {activeModal === "exception" && "⚠️ Record Delivery Exception"}
              </h3>
              <button type="button" className="text-lg font-bold text-muted hover:text-ink" onClick={() => openModal(null)}>
                ✕
              </button>
            </div>

            {modalError && <AdminNotice tone="error" live>{modalError}</AdminNotice>}

            {activeModal === "payment" && (
              <form className="space-y-3 text-sm" onSubmit={(event) => void submitAction(event, "payment")}>
                {/* Financial Summary Card */}
                <div className="p-3 bg-surface-muted/80 rounded-xl border border-line space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted font-medium">Order Total:</span>
                    <strong className="text-ink ops-tabular font-bold">
                      {money(detail.order.finalTotalCents ?? detail.order.itemSubtotalCents)}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-muted">
                    <span>Paid to Date:</span>
                    <span className="text-emerald-700 font-semibold ops-tabular">
                      {money(detail.paymentSummary.paidCents)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-line/60 pt-1.5 font-bold text-ink">
                    <span>Remaining Balance:</span>
                    <span className={`ops-tabular ${detail.paymentSummary.outstandingCents > 0 ? "text-amber-700 font-mono" : "text-emerald-700 font-mono"}`}>
                      {money(detail.paymentSummary.outstandingCents)}
                    </span>
                  </div>
                </div>

                {/* Delivery Fee Pending Warning */}
                {detail.order.fulfillmentMethod === "DELIVERY" && detail.order.deliveryFeeCents === null && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-900 space-y-2">
                    <strong className="font-bold flex items-center gap-1.5 text-amber-950">
                      ⚠️ Delivery Fee Pending
                    </strong>
                    <p className="leading-relaxed">
                      The delivery fee is not set yet. Please adjust pricing and set the delivery fee before recording payment.
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary text-xs py-1 px-2.5 font-bold"
                      onClick={() => setActiveModal("pricing")}
                    >
                      ✍️ Set Delivery Fee First
                    </button>
                  </div>
                )}

                <label className="field">
                  <span>Payment amount (€)</span>
                  <input
                    name="paymentEuros"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={(detail.paymentSummary.outstandingCents / 100).toFixed(2)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Payment method</span>
                  <select name="method" defaultValue="CASH" required>
                    <option value="CASH">Cash</option>
                    <option value="MOBILEPAY">MobilePay</option>
                    <option value="CARD">Card</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="field">
                  <span>Reference (Optional)</span>
                  <input name="reference" placeholder="Transaction ref or note" />
                </label>
                <div className="flex justify-end gap-2 pt-2 border-t border-line">
                  <button className="btn btn-secondary text-xs" type="button" disabled={submittingAction} onClick={() => setActiveModal(null)}>
                    Cancel
                  </button>
                  <button className="btn text-xs font-bold min-w-[130px]" type="submit" disabled={submittingAction}>
                    {submittingAction ? "⏳ Saving…" : "Confirm Payment"}
                  </button>
                </div>
              </form>
            )}

            {activeModal === "pricing" && (
              <form className="space-y-3 text-sm" onSubmit={(event) => void submitAction(event, "pricing")}>
                {detail.paymentSummary.paidCents > 0 && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-950 space-y-1">
                    <strong className="font-bold flex items-center gap-1 text-blue-900">
                      ℹ️ Payment Recorded Notice
                    </strong>
                    <p className="leading-relaxed">
                      A payment of <strong>{money(detail.paymentSummary.paidCents)}</strong> has already been recorded. Adjusting total below will update the remaining balance or overpayment status.
                    </p>
                  </div>
                )}

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
                  <input name="reason" minLength={2} placeholder="Discount, custom container..." required />
                </label>
                <div className="flex justify-end gap-2 pt-2 border-t border-line">
                  <button className="btn btn-secondary text-xs" type="button" disabled={submittingAction} onClick={() => setActiveModal(null)}>
                    Cancel
                  </button>
                  <button className="btn text-xs font-bold min-w-[110px]" type="submit" disabled={submittingAction}>
                    {submittingAction ? "⏳ Saving…" : "Save Pricing"}
                  </button>
                </div>
              </form>
            )}

            {activeModal === "exception" && (
              <form className="space-y-3 text-sm" onSubmit={(event) => void submitAction(event, "exception")}>
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
                <div className="flex justify-end gap-2 pt-2 border-t border-line">
                  <button className="btn btn-secondary text-xs" type="button" disabled={submittingAction} onClick={() => setActiveModal(null)}>
                    Cancel
                  </button>
                  <button className="btn text-xs font-bold min-w-[140px]" type="submit" disabled={submittingAction}>
                    {submittingAction ? "⏳ Saving…" : "Record Exception"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Cancel Order Dialog */}
      {pendingCancel && (
        <div className="admin-dialog-backdrop">
          <form
            className="admin-dialog card space-y-3 p-5 max-w-md w-full" role="dialog" aria-modal="true" aria-label="Cancel order"
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              void transition("CANCELLED", String(values.get("reason") ?? ""));
            }}
          >
            <h2 className="text-lg font-bold text-ink">Cancel Order {detail.order.publicReference}?</h2>
            <label className="field">
              <span>Reason for cancellation</span>
              <textarea name="reason" required placeholder="Explain why the order is being cancelled..." />
            </label>
            <div className="profile-actions justify-end gap-2 border-t border-line pt-2">
              <button className="btn btn-secondary text-xs" type="button" onClick={() => setPendingCancel(false)}>
                Keep order
              </button>
              <button className="btn btn-danger text-xs font-bold" type="submit">
                Cancel order
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Order Safe-Guard Dialog */}
      {pendingDelete && (
        <div className="admin-dialog-backdrop">
          <div className="admin-dialog card max-w-md w-full p-5 flex flex-col gap-4" role="alertdialog" aria-modal="true" aria-label="Delete order safeguard">
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

      {/* MOBILE STICKY BOTTOM ACTION FOOTER */}
      {primaryAction && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-paper/95 backdrop-blur-md p-3.5 shadow-lg md:hidden">
          <div className="flex items-center justify-between gap-3 shell">
            <div>
              <p className="text-[11px] text-muted uppercase font-bold tracking-wider font-mono">Order {detail.order.publicReference}</p>
              <p className="text-sm font-bold text-ink">Status: {detail.order.status}</p>
            </div>
            <button className="btn text-sm py-2 px-5 min-h-[44px] font-bold" type="button" onClick={() => void transition(primaryAction.target)}>
              {primaryAction.label}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
