"use client";

import { useEffect, useMemo, useState } from "react";
import type { OrderReceipt } from "@/domain/orders";
import { formatEuros, formatLitres, type Locale } from "@/lib/format";
import { copy } from "@/lib/i18n";

type AvailabilityStatus = "available" | "today" | "unavailable" | "season";
const availabilityLabels: Record<Locale, Record<AvailabilityStatus, string>> = {
  fi: { available: "Saatavilla", today: "Tämän päivän erä on varattu", unavailable: "Tilapäisesti loppu", season: "Saatavuus päättynyt tältä kaudelta" },
  en: { available: "Available", today: "Fully reserved for today", unavailable: "Currently unavailable", season: "Seasonal availability ended" },
};

export type PublicProduct = {
  id: string;
  name: string;
  description: string;
  media: Array<{ id: string; url: string; alt: string; isPrimary: boolean }>;
  packages: Array<{ id: string; label: string; volumeMl: number; priceCents: number }>;
  dates: Array<{ date: string; remainingMl: number; acceptsOrders: boolean; soldOut: boolean }>;
};

function getAvailabilityStatus(dates: PublicProduct["dates"], volumeMl?: number): AvailabilityStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (dates.some((date) => date.acceptsOrders && !date.soldOut && (volumeMl === undefined || date.remainingMl >= volumeMl))) return "available";
  const todayDate = dates.find((date) => date.date === today);
  if (todayDate?.soldOut || (todayDate && volumeMl !== undefined && todayDate.remainingMl < volumeMl)) return "today";
  if (!dates.some((date) => date.date > today && date.acceptsOrders)) return "season";
  return "unavailable";
}

type Pickup = { name: string; address: string; instructions: string; time: string };
type Contact = { phone: string; email: string; hours: string };

export function OrderForm({
  locale,
  products,
  pickup,
  idempotencyKey: initialIdempotencyKey,
  privacyNoticeUrl,
  contact,
  initialProductId,
  initialPackageId,
}: {
  locale: Locale;
  products: PublicProduct[];
  pickup: Pickup;
  idempotencyKey: string;
  privacyNoticeUrl?: string;
  contact: Contact;
  initialProductId?: string;
  initialPackageId?: string;
}) {
  const t = copy[locale];
  const smsNumber = contact.phone.replace(/[^+\d]/g, "");
  const whatsappNumber = contact.phone.replace(/\D/g, "").replace(/^0/, "358");
  const resolvedInitialProductId = initialProductId === undefined ? (products[0]?.id ?? "") : initialProductId;
  const [productId, setProductId] = useState(resolvedInitialProductId);
  const product = products.find((item) => item.id === productId);
  const defaultPackage = product?.packages.find((item) => item.volumeMl === 10000) ?? product?.packages[0];
  const [packageId, setPackageId] = useState(initialPackageId ?? defaultPackage?.id ?? "");
  const selectedPackage = product?.packages.find((item) => item.id === packageId) ?? product?.packages[0];
  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState("");
  const [method, setMethod] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [idempotencyKey, setIdempotencyKey] = useState(initialIdempotencyKey);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<OrderReceipt>();
  const subtotalCents = (selectedPackage?.priceCents ?? 0) * quantity;
  const totalLitres = ((selectedPackage?.volumeMl ?? 0) * quantity) / 1000;

  const orderableDates = useMemo(
    () => product?.dates.filter((item) => item.acceptsOrders && !item.soldOut && item.remainingMl >= (selectedPackage?.volumeMl ?? Infinity) * quantity) ?? [],
    [product, selectedPackage, quantity],
  );
  const defaultDate = useMemo(() => {
    if (orderableDates.length === 0) return "";
    const toLocalIso = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    const today = new Date();
    const todayIso = toLocalIso(today);
    today.setDate(today.getDate() + 1);
    const tomorrowIso = toLocalIso(today);
    const nextAvailableDate = orderableDates.find((item) => item.date >= tomorrowIso);
    return nextAvailableDate?.date ?? orderableDates.find((item) => item.date === todayIso)?.date ?? orderableDates[0].date;
  }, [orderableDates]);

  useEffect(() => {
    if (!date || !orderableDates.some((item) => item.date === date)) setDate(defaultDate);
  }, [date, defaultDate, orderableDates]);

  function changeProduct(nextId: string) {
    const next = products.find((item) => item.id === nextId);
    setProductId(nextId);
    const nextPackage = next?.packages.find((item) => item.volumeMl === 10000) ?? next?.packages[0];
    setPackageId(nextPackage?.id ?? "");
    setQuantity(1);
    setDate("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    setFieldErrors({});
    const values = new FormData(event.currentTarget);
    const payload = {
      locale,
      productId,
      packageId: selectedPackage?.id,
      quantity,
      fulfillmentDate: date,
      fulfillmentMethod: method,
      customerName: values.get("customerName"),
      mobile: values.get("mobile"),
      email: values.get("email"),
      streetAddress: method === "DELIVERY" ? values.get("streetAddress") : undefined,
      postalCode: method === "DELIVERY" ? values.get("postalCode") : undefined,
      city: method === "DELIVERY" ? values.get("city") : undefined,
      notes: values.get("notes"),
      privacyAcknowledged: values.get("privacyAcknowledged") === "on",
      idempotencyKey,
    };
    try {
      const response = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(`${t.error} (${body.code ?? "RETRY_LATER"})`);
        setFieldErrors(body.fieldErrors ?? {});
        return;
      }
      setReceipt(body.data);
      setIdempotencyKey(crypto.randomUUID());
    } catch {
      setError(`${t.error} (RETRY_LATER)`);
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <section className="card success mt-6" aria-live="polite">
        <h3 className="text-2xl font-bold">{t.success}</h3>
        <p className="mt-3"><strong>{t.reference}:</strong> {receipt.publicReference}</p>
        <p className="mt-2">{receipt.productName} — {receipt.packageLabel} ({formatLitres(receipt.volumeMl, locale)} l), {receipt.fulfillmentDate}</p>
        <p className="mt-3 font-bold">{t.pending}</p>
        {receipt.pickup ? (
          <div className="mt-4 rounded-lg bg-white p-4">
            <h4 className="font-bold">{t.pickupDetails}</h4>
            <p>{receipt.pickup.name}<br />{receipt.pickup.address}<br />{receipt.pickup.instructions}<br />{receipt.pickup.time}</p>
          </div>
        ) : (
          <div className="mt-4"><strong>{t.deliveryPending}</strong><br />{receipt.delivery?.streetAddress}, {receipt.delivery?.postalCode} {receipt.delivery?.city}</div>
        )}
      </section>
    );
  }

  if (products.length === 0) return <div className="card mt-6">{t.closed}</div>;

  return (
    <>
      <form className="reservation-form" onSubmit={submit} noValidate>
      <div className="reservation-fields">
      {contact.phone && <section className="message-booking-banner" aria-labelledby="message-booking-title"><div className="message-booking-copy"><span className="message-booking-kicker">{locale === "fi" ? "Nopea varaus" : "Quick booking"}</span><strong id="message-booking-title">{locale === "fi" ? "Varaa viestillä" : "Prefer to message us?"}</strong></div><div className="message-booking-actions"><a className="message-action" href={`sms:${smsNumber}`}><strong>SMS</strong><span aria-hidden="true">→</span></a><a className="message-action message-action-whatsapp" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer"><strong>WhatsApp</strong><span aria-hidden="true">→</span></a></div></section>}
        <p className="required-note">{t.required}</p>
        {error && <div className="error form-error" role="alert" tabIndex={-1}>{error}</div>}
        <fieldset className="form-step">
        <legend><span>01</span> {locale === "fi" ? "Valitse marja ja pakkaus" : "Choose berries and package"}</legend>
        <div className="selection-label">{locale === "fi" ? "Tuote" : "Product"} *</div>
        <div className="reserve-product-grid">
          {products.map((item) => {
            const available = item.packages.some((pkg) => item.dates.some((dateItem) => dateItem.acceptsOrders && !dateItem.soldOut && dateItem.remainingMl >= pkg.volumeMl));
            const status = available ? "available" : getAvailabilityStatus(item.dates);
            const availablePackages = item.packages.filter((pkg) => getAvailabilityStatus(item.dates, pkg.volumeMl) === "available");
            const bestValueId = availablePackages.reduce((best, pkg) => !best || pkg.priceCents / pkg.volumeMl < best.priceCents / best.volumeMl ? pkg : best, availablePackages[0])?.id;
            return <article className={`reserve-product-card${item.id === productId ? " selected" : ""}${available ? "" : " unavailable"}`} key={item.id}>
              <label className="reserve-product-card-header"><input type="radio" name="productId" value={item.id} checked={item.id === productId} onChange={() => changeProduct(item.id)} disabled={!available} /><span className="reserve-product-image">{item.media[0] ? <img src={item.media[0].url} alt="" /> : <span aria-hidden="true">M</span>}</span><span className="reserve-product-card-copy"><strong>{item.name}</strong><small>{item.description?.split(/[.!?]/)[0] || (locale === "fi" ? "Satakunnan kauden sato" : "Seasonal harvest from Satakunta")}</small></span><span className={`availability-badge reserve-product-status${available ? "" : " unavailable"}`}>{availabilityLabels[locale][status]}</span><span className="selection-check" aria-hidden="true">✓</span></label>
              {item.id === productId && <div className="reserve-product-packages"><div className="selection-label">{t.package} *</div><div className="selection-grid package-selection">{item.packages.map((pkg) => { const litres = pkg.volumeMl / 1000; const unitPriceCents = litres > 0 ? Math.round(pkg.priceCents / litres) : pkg.priceCents; const packageStatus = getAvailabilityStatus(item.dates, pkg.volumeMl); const packageAvailable = packageStatus === "available"; return <label className={`selection-card package-selection-card${pkg.id === selectedPackage?.id ? " selected" : ""}${packageAvailable ? "" : " unavailable"}`} key={pkg.id}><input type="radio" name="packageId" value={pkg.id} checked={pkg.id === selectedPackage?.id} onChange={() => { setPackageId(pkg.id); setQuantity(1); setDate(""); }} disabled={!packageAvailable} /><span className="selection-card-copy"><strong>{pkg.label}</strong><small>{formatLitres(pkg.volumeMl, locale)} l · {formatEuros(unitPriceCents, locale)}/{locale === "fi" ? "l" : "L"}</small></span><strong className="selection-price">{formatEuros(pkg.priceCents, locale)}</strong>{bestValueId === pkg.id && packageAvailable && <span className="reserve-best-value">{locale === "fi" ? "Paras hinta / l" : "Best value"}</span>}<span className="selection-check" aria-hidden="true">✓</span></label>; })}</div></div>}
            </article>;
          })}
        </div>
        {selectedPackage?.volumeMl === 10000 && (
          <label className="field">
            <span>{locale === "fi" ? "Määrä" : "Quantity"} *</span>
            <div className="quantity-control"><button className="stepper" type="button" aria-label={locale === "fi" ? "Vähennä määrää" : "Decrease quantity"} onClick={() => { setQuantity(Math.max(1, quantity - 1)); setDate(""); }}>−</button><input type="number" name="quantity" min={1} max={100} step={1} value={quantity} onChange={(event) => { setQuantity(Math.max(1, Math.min(100, Number(event.target.value) || 1))); setDate(""); }} required /><button className="stepper" type="button" aria-label={locale === "fi" ? "Lisää määrää" : "Increase quantity"} onClick={() => { setQuantity(Math.min(100, quantity + 1)); setDate(""); }}>+</button></div>
            <small>{locale === "fi" ? "10 litran pakkaukselle voit valita määrän." : "Quantity can be selected for the 10 litre package."}</small>
          </label>
        )}
        </fieldset>

      <fieldset className="form-step">
        <legend><span>02</span> {t.method}</legend>
        <label className="field fulfillment-date-field"><span>{t.date} *</span><select required value={date} onChange={(event) => setDate(event.target.value)} aria-invalid={Boolean(fieldErrors.fulfillmentDate)}><option value="">—</option>{orderableDates.map((item) => <option key={item.date} value={item.date}>{item.date}</option>)}</select><small className="availability-hint" aria-live="polite">{orderableDates.length > 0 ? (locale === "fi" ? `${orderableDates.length} noutopäivää saatavilla` : `${orderableDates.length} pickup dates available`) : t.closed}</small></label>
        <div className="choice-grid">
          <label className={`choice-card${method === "PICKUP" ? " selected" : ""}`}><input type="radio" checked={method === "PICKUP"} onChange={() => setMethod("PICKUP")} /> <span><strong>{t.pickup}</strong><small>{locale === "fi" ? "Nouda sovittuna päivänä Porista" : "Collect on the agreed date in Pori"}</small></span></label>
          <label className={`choice-card${method === "DELIVERY" ? " selected" : ""}`}><input type="radio" checked={method === "DELIVERY"} onChange={() => setMethod("DELIVERY")} /> <span><strong>{t.delivery}</strong><small>{locale === "fi" ? "Sovitaan erikseen" : "Arranged separately"}</small></span></label>
        </div>
        {method === "PICKUP" ? (
          <div className="pickup-card"><span>{locale === "fi" ? "Noutopaikka" : "Pickup point"}</span><strong>{pickup.name}</strong><p>{pickup.address}<br />{pickup.instructions}<br />{pickup.time}</p></div>
        ) : (
          <div className="grid gap-4">
            <p className="delivery-note">{t.deliveryPending}</p>
            <label className="field"><span>{t.street} *</span><input name="streetAddress" required minLength={2} maxLength={160} /></label>
            <label className="field"><span>{t.postalCode}</span><input name="postalCode" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} /></label>
            <label className="field"><span>{t.city}</span><input name="city" minLength={2} maxLength={100} /></label>
          </div>
        )}
      </fieldset>

      <fieldset className="form-step">
        <legend><span>03</span> {t.details}</legend>
        <div className="contact-grid">
          <label className="field"><span>{t.name} *</span><input name="customerName" required minLength={2} maxLength={120} autoComplete="name" /></label>
          <label className="field"><span>{t.mobile} *</span><input name="mobile" required type="tel" minLength={7} maxLength={30} autoComplete="tel" /></label>
          <label className="field"><span>{t.email}</span><input name="email" type="email" maxLength={254} autoComplete="email" /></label>
          <label className="field contact-notes"><span>{t.notes}</span><textarea name="notes" maxLength={1000} rows={3} /></label>
        </div>
      </fieldset>
      <div className="grid gap-2">
        {privacyNoticeUrl && <a className="font-bold underline" href={privacyNoticeUrl} target="_blank" rel="noreferrer">{locale === "fi" ? "Tietosuojaseloste" : "Privacy notice"}</a>}
        <label className="privacy-check"><input name="privacyAcknowledged" type="checkbox" required /> <span>{t.privacy} *</span></label>
      </div>
      </div>
      <div className="reservation-summary-bar">
        <div className="summary-selection"><span className="summary-kicker">{locale === "fi" ? "Varauksesi" : "Your reservation"}</span><strong>{product?.name ?? (locale === "fi" ? "Valitse tuote" : "Choose a product")}</strong><small>{selectedPackage?.label ?? t.package} · {date || (locale === "fi" ? "päivä valitsematta" : "date not selected")}</small></div>
        <div className="summary-meta"><span>{method === "PICKUP" ? t.pickup : t.delivery}</span><span>{formatLitres(totalLitres * 1000, locale)} l</span></div>
        <div className="summary-total"><span>{locale === "fi" ? "Yhteensä" : "Total"}</span><strong>{formatEuros(subtotalCents, locale)}</strong></div>
        <button className="btn btn-accent submit-button" disabled={submitting || !date || !selectedPackage} type="submit">{submitting ? "…" : t.submit}<span aria-hidden="true">→</span></button>
      </div>
      </form>
    </>
  );
}
