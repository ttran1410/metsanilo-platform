"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import type { OrderReceipt } from "@/domain/orders";
import { formatEuros, formatLitres, formatStorefrontDate, type Locale } from "@/lib/format";
import { copy } from "@/lib/i18n";
import { CustomerFieldError, customerValidationCopy, focusFirstCustomerFieldError } from "./customer-form-validation";
import { localizeServerFieldErrors, validateReservationFields, type ReservationField } from "./order-form-validation";
import { CustomerAddressFields } from "@/app/customer-address-fields";

export type PublicProduct = {
  id: string;
  name: string;
  description: string;
  availableFrom?: string;
  availableThrough?: string;
  media: Array<{ id: string; url: string; alt: string; isPrimary: boolean }>;
  packages: Array<{ id: string; label: string; volumeMl: number; priceCents: number; isDefault?: boolean; sortOrder?: number }>;
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
  const defaultPackage = product?.packages.find((item) => item.isDefault && item.volumeMl === 10000) ?? product?.packages.find((item) => item.isDefault) ?? product?.packages.find((item) => item.volumeMl === 10000) ?? product?.packages.slice().sort((a, b) => b.volumeMl - a.volumeMl)[0];
  const [packageId, setPackageId] = useState(initialPackageId ?? defaultPackage?.id ?? "");
  const selectedPackage = product?.packages.find((item) => item.id === packageId) ?? product?.packages[0];
  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState("");
  const [method, setMethod] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [idempotencyKey, setIdempotencyKey] = useState(initialIdempotencyKey);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ReservationField, string>>>({});
  const [receipt, setReceipt] = useState<OrderReceipt>();
  const subtotalCents = (selectedPackage?.priceCents ?? 0) * quantity;
  const totalLitres = ((selectedPackage?.volumeMl ?? 0) * quantity) / 1000;

  const orderableDates = useMemo(
    () => product?.dates.filter((item) => item.acceptsOrders && !item.soldOut && item.remainingMl >= (selectedPackage?.volumeMl ?? Infinity) * quantity) ?? [],
    [product, selectedPackage, quantity],
  );
  const visibleOrderableDates = orderableDates.slice(0, 7);
  const defaultDate = useMemo(() => {
    if (visibleOrderableDates.length === 0) return "";
    const toLocalIso = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    const today = new Date();
    const todayIso = toLocalIso(today);
    today.setDate(today.getDate() + 1);
    const tomorrowIso = toLocalIso(today);
    const nextAvailableDate = visibleOrderableDates.find((item) => item.date >= tomorrowIso);
    return nextAvailableDate?.date ?? visibleOrderableDates.find((item) => item.date === todayIso)?.date ?? visibleOrderableDates[0].date;
  }, [visibleOrderableDates]);
  const selectedDate = date && orderableDates.some((item) => item.date === date) ? date : defaultDate;
  const selectedDateLabel = selectedDate ? formatStorefrontDate(selectedDate, locale) : (locale === "fi" ? "päivä valitsematta" : "date not selected");

  function changeProduct(nextId: string) {
    const next = products.find((item) => item.id === nextId);
    setProductId(nextId);
    const nextPackage = next?.packages.find((item) => item.isDefault) ?? next?.packages.find((item) => item.volumeMl === 10000) ?? next?.packages.slice().sort((a, b) => b.volumeMl - a.volumeMl)[0];
    setPackageId(nextPackage?.id ?? "");
    setQuantity(1);
    setDate("");
  }

  function clearFieldError(field: string) {
    if (!(field in fieldErrors)) return;
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field as ReservationField];
      return next;
    });
  }

  function handleFormChange(event: React.FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      clearFieldError(target.name);
    }
  }

  function showFieldErrors(nextErrors: Partial<Record<ReservationField, string>>, form: HTMLFormElement) {
    setFieldErrors(nextErrors);
    focusFirstCustomerFieldError(form, nextErrors);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const validationErrors = validateReservationFields({
      productId,
      packageId: selectedPackage?.id ?? "",
      fulfillmentDate: selectedDate,
      fulfillmentMethod: method,
      customerName: String(values.get("customerName") ?? ""),
      mobile: String(values.get("mobile") ?? ""),
      email: String(values.get("email") ?? ""),
      streetAddress: String(values.get("streetAddress") ?? ""),
      postalCode: String(values.get("postalCode") ?? ""),
      city: String(values.get("city") ?? ""),
    }, locale);

    if (Object.keys(validationErrors).length > 0) {
      setError(customerValidationCopy[locale].checkHighlighted);
      showFieldErrors(validationErrors, form);
      return;
    }

    setSubmitting(true);
    setError(undefined);
    setFieldErrors({});
    const payload = {
      locale,
      productId,
      packageId: selectedPackage?.id,
      quantity,
      fulfillmentDate: selectedDate,
      fulfillmentMethod: method,
      customerName: values.get("customerName"),
      mobile: values.get("mobile"),
      email: values.get("email"),
      streetAddress: method === "DELIVERY" ? values.get("streetAddress") : undefined,
      postalCode: method === "DELIVERY" ? values.get("postalCode") : undefined,
      city: method === "DELIVERY" ? values.get("city") : undefined,
      notes: values.get("notes"),
      marketingConsent: values.get("marketingConsent") === "true",
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
        setError(body.code === "SAME_DAY_CUTOFF" ? (locale === "fi" ? "Saman päivän varaukset ovat sulkeutuneet. Valitse toinen päivä." : "Same-day reservations are closed. Please choose another date.") : body.code === "SOLD_OUT" ? (locale === "fi" ? "Tälle päivälle ei ole enää riittävästi kapasiteettia. Valitse toinen päivä." : "There is no longer enough capacity for this date. Please choose another date.") : t.error);
        const serverErrors = localizeServerFieldErrors(body.fieldErrors, locale);
        showFieldErrors(serverErrors, form);
        return;
      }
      setReceipt(body.data);
      setIdempotencyKey(crypto.randomUUID());
    } catch {
      setError(t.error);
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <section className="p-6 md:p-10 rounded-2xl bg-[var(--store-surface)] border border-[var(--store-primary-soft-strong)] shadow-md my-8 space-y-6 animate-in fade-in" aria-live="polite">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--store-primary-soft)] border border-[var(--store-primary-soft-strong)] flex items-center justify-center text-[var(--forest)]">
            <Check className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-[var(--moss)]">{locale === "fi" ? "Kiitos varauksesta" : "Thank you"}</span>
            <h2 className="text-2xl md:text-3xl font-serif font-semibold text-[var(--store-ink)] tracking-tight">{t.success}</h2>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--store-surface-muted)] border border-[var(--store-line)] flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs text-[var(--store-muted)] uppercase tracking-wider block font-bold">{t.reference}</span>
            <strong className="text-xl md:text-2xl font-mono text-[var(--forest)] tracking-wide">{receipt.publicReference}</strong>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[var(--store-primary-soft)] text-[var(--forest)] border border-[var(--store-primary-soft-strong)]">
            {locale === "fi" ? "Odottaa vahvistusta" : "Pending confirmation"}
          </span>
        </div>

        <div className="space-y-2 text-sm text-[var(--store-ink)]">
          <p className="font-semibold text-base">
            {receipt.productName} — {receipt.packageLabel} ({formatLitres(receipt.volumeMl, locale)} l)
          </p>
          <p className="text-[var(--store-muted)]">
            {locale === "fi" ? "Toimituspäivä" : "Fulfillment date"}: <strong className="text-[var(--store-ink)]">{formatStorefrontDate(receipt.fulfillmentDate, locale)}</strong>
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[var(--store-primary-soft)] border border-[var(--store-primary-soft-strong)] text-sm leading-relaxed text-[var(--store-ink)]">
          <strong className="block mb-1 text-[var(--forest)]">{locale === "fi" ? "Mitä tapahtuu seuraavaksi?" : "What happens next?"}</strong>
          <p>{t.pending}</p>
        </div>

        {receipt.pickup ? (
          <div className="p-4 rounded-xl bg-[var(--store-surface)] border border-[var(--store-line)] space-y-1 text-sm">
            <h3 className="font-bold text-[var(--forest)]">{t.pickupDetails}</h3>
            <p className="font-medium text-[var(--store-ink)]">{receipt.pickup.name}</p>
            <p className="text-[var(--store-muted)] whitespace-pre-line">{receipt.pickup.address}</p>
            <p className="text-[var(--store-muted)]">{receipt.pickup.instructions}</p>
            <p className="text-[var(--store-muted)] font-semibold">{receipt.pickup.time}</p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[var(--store-surface)] border border-[var(--store-line)] space-y-1 text-sm">
            <strong className="text-[var(--forest)]">{t.deliveryPending}</strong>
            <p className="text-[var(--store-muted)]">{receipt.delivery?.streetAddress}, {receipt.delivery?.postalCode} {receipt.delivery?.city}</p>
          </div>
        )}
      </section>
    );
  }

  if (products.length === 0) return <div className="card mt-6">{t.closed}</div>;

  return (
    <>
      <form className="reservation-form" onSubmit={submit} onChange={handleFormChange} noValidate>
      <div className="reservation-fields">
      {contact.phone && <section className="message-booking-banner" aria-labelledby="message-booking-title"><div className="message-booking-copy"><span className="message-booking-kicker">{locale === "fi" ? "Nopea varaus" : "Quick booking"}</span><strong id="message-booking-title">{locale === "fi" ? "Varaa viestillä" : "Prefer to message us?"}</strong></div><div className="message-booking-actions"><a className="message-action" href={`sms:${smsNumber}`}><strong>SMS</strong><ArrowRight aria-hidden="true" /></a><a className="message-action message-action-whatsapp" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer"><strong>WhatsApp</strong><ArrowRight aria-hidden="true" /></a></div></section>}
        <div className="senior-trust-strip" role="note"><span><Check aria-hidden="true" /> {locale === "fi" ? "Poimittu ja toimitettu saman päivän aikana" : "Picked and delivered the same day"}</span><span><Check aria-hidden="true" /> {locale === "fi" ? "Ei ennakkomaksua" : "No prepayment"}</span></div>
        <p className="required-note">{customerValidationCopy[locale].requiredNote}</p>
        {error && <div className="error form-error" role="alert" tabIndex={-1}>{error}</div>}
        <fieldset className="form-step">
        <legend><span>01</span> {locale === "fi" ? "Valitse marja ja pakkaus" : "Choose berries and package"}</legend>
        <div className="form-field">
        <div className="selection-label" id="product-selection-label">{locale === "fi" ? "Tuote" : "Product"}</div>
        <div className={`reserve-product-grid${fieldErrors.productId ? " field-invalid" : ""}`} role="radiogroup" aria-labelledby="product-selection-label" data-field="productId" aria-invalid={Boolean(fieldErrors.productId)} aria-describedby={fieldErrors.productId ? "productId-error" : undefined}>
          {products.map((item) => {
            const available = item.packages.some((pkg) => item.dates.some((dateItem) => dateItem.acceptsOrders && !dateItem.soldOut && dateItem.remainingMl >= pkg.volumeMl));
            return <label className={`reserve-product-card${item.id === productId ? " selected" : ""}${available ? "" : " unavailable"}`} key={item.id}><input type="radio" name="productId" value={item.id} checked={item.id === productId} onChange={() => changeProduct(item.id)} disabled={!available} required aria-describedby={fieldErrors.productId ? "productId-error" : undefined} /><span className="reserve-product-image">{item.media[0] ? <Image src={item.media[0].url} alt="" width={240} height={180} unoptimized /> : <span aria-hidden="true">M</span>}</span><span className="reserve-product-card-copy"><strong>{item.name}</strong><small className="whitespace-pre-line">{item.description?.trim() || (locale === "fi" ? "Satakunnan kauden sato" : "Seasonal harvest from Satakunta")}</small></span><span className={`availability-badge reserve-product-status${available ? "" : " unavailable"}`}>{available ? (locale === "fi" ? "Saatavilla" : "Available") : (locale === "fi" ? "Ei saatavilla" : "Unavailable")}</span><span className="selection-check" aria-hidden="true"><Check /></span></label>;
          })}
          {Array.from({ length: Math.max(0, 3 - products.length) }).map((_, index) => <div className="reserve-product-card reserve-coming-soon" aria-disabled="true" key={`coming-soon-${index}`}><span className="reserve-product-image"><Plus aria-hidden="true" /></span><span className="reserve-product-card-copy"><strong>{locale === "fi" ? "Tulossa pian" : "Coming soon"}</strong><small>{locale === "fi" ? "Uusi kauden sato lisätään pian." : "Another seasonal harvest will be added soon."}</small></span><span className="availability-badge reserve-product-status coming-soon-status">{locale === "fi" ? "Tulossa pian" : "Coming soon"}</span></div>)}
        </div>
        <CustomerFieldError field="productId" error={fieldErrors.productId} />
        </div>
        <div className="form-field">
        <div className="selection-label" id="package-selection-label">{t.package}</div>
        <div className={`selection-grid package-selection${fieldErrors.packageId ? " field-invalid" : ""}`} role="radiogroup" aria-labelledby="package-selection-label" data-field="packageId" aria-invalid={Boolean(fieldErrors.packageId)} aria-describedby={fieldErrors.packageId ? "packageId-error" : undefined}>
          {product?.packages.map((item) => {
            const litres = item.volumeMl / 1000;
            const unitPriceCents = litres > 0 ? Math.round(item.priceCents / litres) : item.priceCents;
            return <label className={`selection-card package-selection-card${item.id === selectedPackage?.id ? " selected" : ""}`} key={item.id}>
              <input type="radio" name="packageId" value={item.id} checked={item.id === selectedPackage?.id} onChange={() => { setPackageId(item.id); setQuantity(1); setDate(""); }} required aria-describedby={fieldErrors.packageId ? "packageId-error" : undefined} />
              <span className="selection-card-copy"><strong>{item.label}</strong><small>{formatLitres(item.volumeMl, locale)} l · {formatEuros(unitPriceCents, locale)}/{locale === "fi" ? "l" : "L"}</small></span>
              <strong className="selection-price">{formatEuros(item.priceCents, locale)}</strong>
              <span className="selection-check" aria-hidden="true"><Check /></span>
            </label>;
          })}
        </div>
        <CustomerFieldError field="packageId" error={fieldErrors.packageId} />
        </div>
        {selectedPackage?.volumeMl === 10000 && (
          <label className="field">
            <span>{locale === "fi" ? "Määrä" : "Quantity"}</span>
            <div className="quantity-control"><button className="stepper" type="button" aria-label={locale === "fi" ? "Vähennä määrää" : "Decrease quantity"} onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus aria-hidden="true" /></button><input type="number" name="quantity" min={1} max={100} step={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} required /><button className="stepper" type="button" aria-label={locale === "fi" ? "Lisää määrää" : "Increase quantity"} onClick={() => setQuantity(Math.min(100, quantity + 1))}><Plus aria-hidden="true" /></button></div>
            <small>{locale === "fi" ? "10 litran pakkaukselle voit valita määrän." : "Quantity can be selected for the 10 litre package."}</small>
          </label>
        )}
        </fieldset>

      <fieldset className="form-step">
        <legend><span>02</span> {t.method}</legend>
        <div className={`field fulfillment-date-field${fieldErrors.fulfillmentDate ? " field-invalid" : ""}`} data-field="fulfillmentDate" aria-invalid={Boolean(fieldErrors.fulfillmentDate)} aria-describedby={fieldErrors.fulfillmentDate ? "fulfillmentDate-error" : undefined}><span>{t.date}</span><div className="date-chip-grid" role="radiogroup" aria-label={t.date}>{visibleOrderableDates.map((item) => { const label = formatStorefrontDate(item.date, locale, { weekday: "short", day: "numeric", month: "numeric" }); return <label className={`date-chip${selectedDate === item.date ? " selected" : ""}`} key={item.date}><input type="radio" name="fulfillmentDate" value={item.date} checked={selectedDate === item.date} onChange={() => setDate(item.date)} required aria-describedby={fieldErrors.fulfillmentDate ? "fulfillmentDate-error" : undefined} /><span>{label}</span></label>; })}</div>{orderableDates.length === 0 && <small className="availability-hint" aria-live="polite">{t.closed}</small>}<CustomerFieldError field="fulfillmentDate" error={fieldErrors.fulfillmentDate} /></div>
        <div className="choice-grid">
          <label className={`choice-card${method === "PICKUP" ? " selected" : ""}`}><input type="radio" checked={method === "PICKUP"} onChange={() => setMethod("PICKUP")} /> <span><strong>{t.pickup}</strong><small>{locale === "fi" ? "Nouda sovittuna päivänä Porista" : "Collect on the agreed date in Pori"}</small></span></label>
          <label className={`choice-card${method === "DELIVERY" ? " selected" : ""}`}><input type="radio" checked={method === "DELIVERY"} onChange={() => setMethod("DELIVERY")} /> <span><strong>{t.delivery}</strong><small>{locale === "fi" ? "Sovitaan toimituksesta" : "Delivery to be agreed"}</small></span></label>
        </div>
        {method === "PICKUP" ? (
          <div className="pickup-card"><span>{locale === "fi" ? "Noutopaikka" : "Pickup point"}</span><strong>{pickup.name}</strong><p>{pickup.address}<br />{pickup.instructions}<br />{pickup.time}</p></div>
        ) : (
          <div className="mt-3 w-full">
            <CustomerAddressFields
              fulfillmentMethod="DELIVERY"
              fieldErrors={fieldErrors}
              locale={locale}
            />
          </div>
        )}
      </fieldset>

      <fieldset className="form-step">
        <legend><span>03</span> {t.details}</legend>
        <div className="contact-grid">
          <label className={`field${fieldErrors.customerName ? " field-invalid" : ""}`} data-field="customerName"><span>{t.name}</span><input name="customerName" required minLength={2} maxLength={120} autoComplete="name" aria-invalid={Boolean(fieldErrors.customerName)} aria-describedby={fieldErrors.customerName ? "customerName-error" : undefined} /><CustomerFieldError field="customerName" error={fieldErrors.customerName} /></label>
          <label className={`field${fieldErrors.mobile ? " field-invalid" : ""}`} data-field="mobile"><span>{t.mobile}</span><input name="mobile" required type="tel" minLength={7} maxLength={30} autoComplete="tel" aria-invalid={Boolean(fieldErrors.mobile)} aria-describedby={fieldErrors.mobile ? "mobile-error" : undefined} /><CustomerFieldError field="mobile" error={fieldErrors.mobile} /></label>
          <label className={`field${fieldErrors.email ? " field-invalid" : ""}`} data-field="email"><span>{t.email}</span><input name="email" type="email" maxLength={254} autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} /><CustomerFieldError field="email" error={fieldErrors.email} /></label>
          <label className="field contact-notes"><span>{t.notes}</span><textarea name="notes" maxLength={1000} rows={3} /></label>
        </div>
      </fieldset>
      <div className="privacy-notice" role="note">
        <span>{t.privacy}</span>{privacyNoticeUrl && <> {locale === "fi" ? "Lue" : "Read"} <a className="font-bold underline" href={privacyNoticeUrl} target="_blank" rel="noreferrer">{locale === "fi" ? "tietosuojaseloste" : "the privacy notice"}</a>.</>}
      </div>
      <label className="marketing-consent-field"><input type="checkbox" name="marketingConsent" value="true" /> <span>{locale === "fi" ? "Haluan saada METSÄNILO-kausitarjouksia tekstiviestillä tai WhatsAppilla." : "I would like to receive METSÄNILO seasonal offers by SMS or WhatsApp."}</span></label>
      </div>
      <div className="reservation-summary-bar">
        <div className="summary-selection"><span className="summary-kicker">{locale === "fi" ? "Varauksesi" : "Your reservation"}</span><strong>{product?.name ?? (locale === "fi" ? "Valitse tuote" : "Choose a product")}</strong><small>{selectedPackage?.label ?? t.package} · {quantity} {locale === "fi" ? "kpl" : quantity === 1 ? "item" : "items"} · {selectedDateLabel}</small></div>
        <div className="summary-meta"><span>{method === "PICKUP" ? t.pickup : t.delivery}</span><span>{formatLitres(totalLitres * 1000, locale)} l</span></div>
        <div className={`summary-total${method === "DELIVERY" ? " summary-total-delivery" : ""}`}><span>{method === "DELIVERY" ? t.productTotal : (locale === "fi" ? "Yhteensä" : "Total")}</span><strong>{formatEuros(subtotalCents, locale)}</strong>{method === "DELIVERY" && <small>{t.deliveryFeePending}<br />{t.excludesDeliveryFee}</small>}</div>
      <button className="btn btn-accent submit-button" disabled={submitting} type="submit">{submitting ? "…" : t.submit}<ArrowRight aria-hidden="true" /></button>
      </div>
      </form>
    </>
  );
}
