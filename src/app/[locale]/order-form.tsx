"use client";

import { useMemo, useState } from "react";
import type { OrderReceipt } from "@/domain/orders";
import { formatEuros, formatLitres, type Locale } from "@/lib/format";
import { copy } from "@/lib/i18n";

export type PublicProduct = {
  id: string;
  name: string;
  media: Array<{ id: string; url: string; alt: string; isPrimary: boolean }>;
  packages: Array<{ id: string; label: string; volumeMl: number; priceCents: number }>;
  dates: Array<{ date: string; remainingMl: number; acceptsOrders: boolean; soldOut: boolean }>;
};

type Pickup = { name: string; address: string; instructions: string; time: string };
type Contact = { phone: string; email: string; hours: string };

export function OrderForm({
  locale,
  products,
  pickup,
  idempotencyKey: initialIdempotencyKey,
  privacyNoticeUrl,
  contact,
}: {
  locale: Locale;
  products: PublicProduct[];
  pickup: Pickup;
  idempotencyKey: string;
  privacyNoticeUrl?: string;
  contact: Contact;
}) {
  const t = copy[locale];
  const smsNumber = contact.phone.replace(/[^+\d]/g, "");
  const whatsappNumber = contact.phone.replace(/\D/g, "").replace(/^0/, "358");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const product = products.find((item) => item.id === productId);
  const defaultPackage = products[0]?.packages.find((item) => item.volumeMl === 10000) ?? products[0]?.packages[0];
  const [packageId, setPackageId] = useState(defaultPackage?.id ?? "");
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
    <form className="card mt-6 grid gap-6" onSubmit={submit} noValidate>
      <p className="text-sm">{t.required}</p>
      {error && <div className="error rounded-md border border-current p-3" role="alert" tabIndex={-1}>{error}</div>}
      <fieldset className="grid gap-4">
        <legend className="text-xl font-bold">1. {t.package} &amp; {t.date}</legend>
        <label className="field">
          <span>{locale === "fi" ? "Tuote" : "Product"} *</span>
          <select value={productId} onChange={(event) => changeProduct(event.target.value)}>
            {products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t.package} *</span>
          <select value={selectedPackage?.id ?? ""} onChange={(event) => { setPackageId(event.target.value); setQuantity(1); setDate(""); }}>
            {product?.packages.map((item) => (
              <option key={item.id} value={item.id}>{item.label} — {formatLitres(item.volumeMl, locale)} l — {formatEuros(item.priceCents, locale)}</option>
            ))}
          </select>
        </label>
        {selectedPackage?.volumeMl === 10000 && (
          <label className="field">
            <span>{locale === "fi" ? "Määrä" : "Quantity"} *</span>
            <div className="quantity-control"><button className="stepper" type="button" aria-label={locale === "fi" ? "Vähennä määrää" : "Decrease quantity"} onClick={() => { setQuantity(Math.max(1, quantity - 1)); setDate(""); }}>−</button><input type="number" name="quantity" min={1} max={100} step={1} value={quantity} onChange={(event) => { setQuantity(Math.max(1, Math.min(100, Number(event.target.value) || 1))); setDate(""); }} required /><button className="stepper" type="button" aria-label={locale === "fi" ? "Lisää määrää" : "Increase quantity"} onClick={() => { setQuantity(Math.min(100, quantity + 1)); setDate(""); }}>+</button></div>
            <small>{locale === "fi" ? "10 litran pakkaukselle voit valita määrän." : "Quantity can be selected for the 10 litre package."}</small>
          </label>
        )}
        <div className="grid gap-2" aria-live="polite">
          {product?.dates.map((item) => (
            <div key={item.date} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 py-2">
              <span>{item.date}</span>
              <span className="pill">
                {item.soldOut ? t.soldOut : item.acceptsOrders ? `${t.remaining}: ${formatLitres(item.remainingMl, locale)} l` : t.closed}
              </span>
            </div>
          ))}
        </div>
        <label className="field">
          <span>{t.date} *</span>
          <select required value={date} onChange={(event) => setDate(event.target.value)} aria-invalid={Boolean(fieldErrors.fulfillmentDate)}>
            <option value="">—</option>
            {orderableDates.map((item) => <option key={item.date} value={item.date}>{item.date}</option>)}
          </select>
        </label>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-xl font-bold">2. {t.method}</legend>
        <label className="flex min-h-11 items-center gap-3"><input type="radio" checked={method === "PICKUP"} onChange={() => setMethod("PICKUP")} /> {t.pickup}</label>
        <label className="flex min-h-11 items-center gap-3"><input type="radio" checked={method === "DELIVERY"} onChange={() => setMethod("DELIVERY")} /> {t.delivery}</label>
        {method === "PICKUP" ? (
          <div className="rounded-lg bg-slate-100 p-4"><strong>{pickup.name}</strong><br />{pickup.address}<br />{pickup.instructions}<br />{pickup.time}</div>
        ) : (
          <div className="grid gap-4">
            <p className="font-bold text-[var(--berry)]">{t.deliveryPending}</p>
            <label className="field"><span>{t.street} *</span><input name="streetAddress" required minLength={2} maxLength={160} /></label>
            <label className="field"><span>{t.postalCode} *</span><input name="postalCode" required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} /></label>
            <label className="field"><span>{t.city} *</span><input name="city" required minLength={2} maxLength={100} /></label>
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="text-xl font-bold">3. {t.details}</legend>
        <label className="field"><span>{t.name} *</span><input name="customerName" required minLength={2} maxLength={120} autoComplete="name" /></label>
        <label className="field"><span>{t.mobile} *</span><input name="mobile" required type="tel" minLength={7} maxLength={30} autoComplete="tel" /></label>
        <label className="field"><span>{t.email}</span><input name="email" type="email" maxLength={254} autoComplete="email" /></label>
        <label className="field"><span>{t.notes}</span><textarea name="notes" maxLength={1000} rows={3} /></label>
      </fieldset>
      <div className="grid gap-2">
        {privacyNoticeUrl && <a className="font-bold underline" href={privacyNoticeUrl} target="_blank" rel="noreferrer">{locale === "fi" ? "Tietosuojaseloste" : "Privacy notice"}</a>}
        <label className="flex items-start gap-3"><input className="mt-1" name="privacyAcknowledged" type="checkbox" required /> <span>{t.privacy} *</span></label>
      </div>
      <div className="summary-card"><div><span>{locale === "fi" ? "Yhteensä" : "Total"}</span><strong>{formatLitres(totalLitres * 1000, locale)} l · {formatEuros(subtotalCents, locale)}</strong></div><p>{t.pending}</p>{method === "DELIVERY" && <p>{t.deliveryPending}</p>}</div>
      {contact.phone && <div className="card grid gap-2 bg-white"><strong>{locale === "fi" ? "Tarvitsetko apua tilaukseen?" : "Need help with your order?"}</strong><p>{locale === "fi" ? "Voit tilata myös viestillä." : "You can also order by message."}</p><div className="flex flex-wrap gap-2"><a className="btn btn-secondary" href={`sms:${smsNumber}`}>{locale === "fi" ? "Lähetä tekstiviesti" : "Send SMS"}</a><a className="btn btn-secondary" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer">WhatsApp</a></div></div>}
      <button className="btn" disabled={submitting || !date || !selectedPackage} type="submit">{submitting ? "…" : t.submit}</button>
    </form>
  );
}
