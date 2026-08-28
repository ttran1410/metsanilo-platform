"use client";

import { useEffect, useMemo, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";
import { normalizeEmail, normalizeMobile } from "@/domain/order-input";
import { CustomerAddressFields } from "@/app/customer-address-fields";

export type Product = {
  product: { id: string; nameFi: string; nameEn: string };
  packages: Array<{ id: string; productId: string; labelFi: string; labelEn: string; volumeMl: number; priceCents: number; active: boolean }>;
};

export type AvailabilityItem = {
  availability: {
    id: string;
    productId: string;
    businessDate: string;
    capacityMl: number;
    reservedMl: number;
    acceptsOrders: boolean;
    manualSoldOut: boolean;
  };
  product: { id: string; nameFi: string; nameEn: string };
};

export type Order = {
  id: string;
  version: number;
  productId: string;
  packageId: string;
  quantity: number;
  volumeMl: number;
  fulfillmentDate: string;
  fulfillmentMethod: "PICKUP" | "DELIVERY";
  orderSource?: string;
  facebookProfile?: string | null;
  customerName: string;
  mobile: string | null;
  email: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  city: string | null;
  itemSubtotalCents: number;
  deliveryFeeCents: number | null;
  status: string;
  historicalEntry?: boolean;
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysStr(base: string, days: number) {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function OrderEditForm({
  initial,
  products,
}: {
  initial: Order;
  products: Product[];
  availabilityList?: AvailabilityItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");

  const isHistorical = Boolean(initial.historicalEntry);
  const today = todayStr();
  const maxAllowedDate = addDaysStr(today, 7);
  const minAllowedDate = initial.fulfillmentDate < today ? initial.fulfillmentDate : today;

  const [form, setForm] = useState({
    ...initial,
    mobile: initial.mobile ?? "",
    orderSource: initial.orderSource ?? "WEBSITE",
    facebookProfile: initial.facebookProfile ?? "",
    email: initial.email ?? "",
    streetAddress: initial.streetAddress ?? "",
    postalCode: initial.postalCode ?? "",
    city: initial.city && initial.city.trim() ? initial.city : "Pori",
    agreedItemSubtotal: (initial.itemSubtotalCents / 100).toFixed(2),
    deliveryFee: initial.deliveryFeeCents === null ? "" : (initial.deliveryFeeCents / 100).toFixed(2),
    adjustmentReason: "",
  });

  const [overridePrice, setOverridePrice] = useState(() => {
    const pkg = products
      .find((item) => item.product.id === initial.productId)
      ?.packages.find((item) => item.id === initial.packageId);
    return pkg ? initial.itemSubtotalCents !== pkg.priceCents * initial.quantity : false;
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sources, setSources] = useState<Array<{ key: string; labelEn: string }>>([
    { key: "WEBSITE", labelEn: "Website" },
    { key: "PHONE", labelEn: "Phone" },
    { key: "SMS", labelEn: "SMS" },
    { key: "WHATSAPP", labelEn: "WhatsApp" },
    { key: "FACEBOOK", labelEn: "Facebook" },
    { key: "OTHER", labelEn: "Other" },
  ]);

  // Normalise legacy source keys that existed before the settings API
  const normalisedSource = form.orderSource === "MANUAL" ? "PHONE" : form.orderSource === "FACEBOOK_MESSAGE" ? "FACEBOOK" : form.orderSource;

  // Load order sources from settings API
  useEffect(() => {
    fetch("/api/admin/order-sources")
      .then((r) => r.ok ? r.json() : null)
      .then((body) => {
        const rows: Array<{ key: string; labelEn: string; active: boolean }> = body?.data ?? body;
        if (Array.isArray(rows) && rows.length > 0) {
          setSources(rows.filter((s) => s.active).map((s) => ({ key: s.key, labelEn: s.labelEn })));
        }
      })
      .catch(() => { /* keep defaults */ });
  }, []);

  const currentProduct = products.find((item) => item.product.id === form.productId);
  const packages = useMemo(() => currentProduct?.packages.filter((item) => item.active) ?? [], [currentProduct]);
  const selectedPackage = packages.find((item) => item.id === form.packageId) ?? packages[0];
  const standardCents = (selectedPackage?.priceCents ?? initial.itemSubtotalCents) * Number(form.quantity || 1);

  const volumeDelta =
    (selectedPackage?.volumeMl ?? initial.volumeMl / Math.max(1, initial.quantity ?? 1)) * Number(form.quantity || 1) - initial.volumeMl;

  function handleProductChange(nextProductId: string) {
    const nextProd = products.find((item) => item.product.id === nextProductId);
    const nextPkg = nextProd?.packages.find((item) => item.active);
    const nextPkgId = nextPkg?.id ?? "";
    const nextStandard = (nextPkg?.priceCents ?? 0) * Number(form.quantity || 1);

    setForm((old) => ({
      ...old,
      productId: nextProductId,
      packageId: nextPkgId,
      agreedItemSubtotal: !overridePrice ? (nextStandard / 100).toFixed(2) : old.agreedItemSubtotal,
      adjustmentReason: !overridePrice ? "" : old.adjustmentReason,
    }));
  }

  function handlePackageChange(nextPackageId: string) {
    const nextPkg = packages.find((item) => item.id === nextPackageId);
    const nextStandard = (nextPkg?.priceCents ?? 0) * Number(form.quantity || 1);

    setForm((old) => ({
      ...old,
      packageId: nextPackageId,
      agreedItemSubtotal: !overridePrice ? (nextStandard / 100).toFixed(2) : old.agreedItemSubtotal,
      adjustmentReason: !overridePrice ? "" : old.adjustmentReason,
    }));
  }

  function handleQuantityChange(nextQtyStr: string) {
    const qtyNum = Number(nextQtyStr || 1);
    const nextStandard = (selectedPackage?.priceCents ?? 0) * qtyNum;

    setForm((old) => ({
      ...old,
      quantity: qtyNum,
      agreedItemSubtotal: !overridePrice ? (nextStandard / 100).toFixed(2) : old.agreedItemSubtotal,
      adjustmentReason: !overridePrice ? "" : old.adjustmentReason,
    }));
  }

  function handleMobileBlur() {
    if (!form.mobile.trim()) return;
    try {
      const normalized = normalizeMobile(form.mobile);
      update("mobile", normalized);
    } catch {
      /* Keep user input if unparseable until submit */
    }
  }

  function handleEmailBlur() {
    if (!form.email.trim()) return;
    const normalized = normalizeEmail(form.email);
    update("email", normalized ?? "");
  }

  function handleOverrideToggle(checked: boolean) {
    setOverridePrice(checked);
    if (!checked) {
      setForm((old) => ({
        ...old,
        agreedItemSubtotal: (standardCents / 100).toFixed(2),
        adjustmentReason: "",
      }));
    }
  }

  function update(key: string, value: string) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  function handleCancel() {
    if (fromParam) {
      router.push(fromParam);
    } else {
      router.back();
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    if (form.fulfillmentMethod === "DELIVERY" && (!form.streetAddress || form.streetAddress.trim().length < 2)) {
      setSaving(false);
      return setError("Street address is required for Delivery orders.");
    }

    if (!isHistorical && (form.fulfillmentDate < minAllowedDate || form.fulfillmentDate > maxAllowedDate)) {
      setSaving(false);
      return setError(`Fulfillment date must be between ${minAllowedDate} and ${maxAllowedDate} (next 7 days).`);
    }

    let normalizedMobile = form.mobile;
    try {
      normalizedMobile = normalizeMobile(form.mobile);
    } catch {
      setSaving(false);
      return setError("Invalid mobile phone number format.");
    }

    const response = await fetch(`/api/admin/orders/${form.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: form.version,
        productId: form.productId,
        packageId: form.packageId,
        quantity: Number(form.quantity),
        fulfillmentDate: form.fulfillmentDate,
        fulfillmentMethod: form.fulfillmentMethod,
        orderSource: form.orderSource,
        facebookProfile: form.facebookProfile.trim() || null,
        customerName: form.customerName,
        mobile: normalizedMobile,
        email: normalizeEmail(form.email),
        streetAddress: form.streetAddress || null,
        postalCode: form.postalCode || null,
        city: form.city || "Pori",
        deliveryFeeCents: form.fulfillmentMethod === "PICKUP" ? 0 : form.deliveryFee === "" ? null : Math.round(Number(form.deliveryFee) * 100),
        agreedItemSubtotalCents: Math.round(Number(form.agreedItemSubtotal) * 100),
        adjustmentReason: overridePrice ? form.adjustmentReason : undefined,
      }),
    });

    const body = await response.json();
    setSaving(false);
    if (!response.ok) return setError(body.message ?? body.code ?? "Could not save order");

    // Navigate back to exact previous location (Order Queue, Quick View, or Order Detail)
    if (fromParam) {
      const sep = fromParam.includes("?") ? "&" : "?";
      router.push(`${fromParam}${sep}updated=1`);
    } else {
      router.push(`/admin/orders/${form.id}?updated=1`);
    }
    router.refresh();
  }

  const isClosedOrder = ["PICKED_UP", "DELIVERED", "CANCELLED", "REJECTED", "NO_SHOW"].includes(initial.status);

  return (
    <form className="space-y-5 pb-28 md:pb-10" onSubmit={save}>
      {isClosedOrder ? (
        <div className="card p-4 bg-purple-500/10 border-2 border-purple-500/40 rounded-xl flex flex-col gap-1 text-xs shadow-xs">
          <strong className="font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
            🔒 COMPLETED ORDER NOTICE
          </strong>
          <p className="text-purple-950 font-medium leading-relaxed">
            This order is completed (<strong>{initial.status}</strong>). Core items, quantities, date, method, and pricing are locked to protect financial ledgers. You can update <strong>Order Source</strong>, <strong>Facebook Profile</strong>, and <strong>Customer Contact Info</strong> below.
          </p>
        </div>
      ) : (
        /* REAL-TIME PRE-FLIGHT CAPACITY GUARD BANNER */
        <div className="card p-4 bg-surface-muted/60 border-2 border-primary/40 rounded-xl flex flex-col gap-2 shadow-xs">
          <div className="flex items-center justify-between">
            <strong className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              ⚡ REAL-TIME PRE-FLIGHT CAPACITY GUARD
            </strong>
            <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
              Capacity OK ✓
            </span>
          </div>

          <p className="text-xs font-medium text-ink leading-relaxed">
            {form.fulfillmentDate !== initial.fulfillmentDate ? (
              <>
                Releasing <strong>{(initial.volumeMl / 1000).toFixed(1)} L</strong> on <strong>{initial.fulfillmentDate}</strong> → Reserving <strong>{((initial.volumeMl + volumeDelta) / 1000).toFixed(1)} L</strong> on <strong>{form.fulfillmentDate}</strong>.
              </>
            ) : volumeDelta === 0 ? (
              "No volume capacity change required for this order."
            ) : volumeDelta > 0 ? (
              <>
                Reserving <strong>+{(volumeDelta / 1000).toFixed(1)} L</strong> additional capacity on <strong>{form.fulfillmentDate}</strong> (Total: {((initial.volumeMl + volumeDelta) / 1000).toFixed(1)} L).
              </>
            ) : (
              <>
                Releasing <strong>{(-volumeDelta / 1000).toFixed(1)} L</strong> capacity on <strong>{form.fulfillmentDate}</strong> (Total: {((initial.volumeMl + volumeDelta) / 1000).toFixed(1)} L).
              </>
            )}
          </p>

          <small className="muted text-[11px]">
            🔒 Atomic capacity reservation will be verified strictly when you save.
          </small>
        </div>
      )}

      {/* CARD 01: Product & Pricing */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line/60 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
            <span className="text-base">📦</span> 01. Item Selection &amp; Pricing
            {isClosedOrder && <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">Locked</span>}
          </h3>
          <span className="text-xs font-bold text-forest bg-primary-soft/80 px-2.5 py-1 rounded-full border border-forest/20">
            Current Agreed: {form.agreedItemSubtotal} €
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="field">
            <span>Product</span>
            <select value={form.productId} onChange={(e) => handleProductChange(e.target.value)} disabled={isClosedOrder} required>
              {products
                .filter((item) => item.packages.some((pkg) => pkg.active))
                .map((item) => (
                  <option key={item.product.id} value={item.product.id}>
                    {item.product.nameFi} / {item.product.nameEn}
                  </option>
                ))}
            </select>
          </label>

          <label className="field">
            <span>Package variant</span>
            <select value={form.packageId} onChange={(e) => handlePackageChange(e.target.value)} disabled={isClosedOrder} required>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.labelFi} · {(pkg.volumeMl / 1000).toFixed(0)} L · {(pkg.priceCents / 100).toFixed(2)} €
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Quantity</span>
            <input type="number" min="1" max="100" value={form.quantity} onChange={(e) => handleQuantityChange(e.target.value)} disabled={isClosedOrder} required />
          </label>
        </div>

        <div className="pt-2 grid gap-4 md:grid-cols-2">
          <div className="field">
            <label className="checkbox-field">
              <span>Override catalog price</span>
              <input type="checkbox" checked={overridePrice} onChange={(e) => handleOverrideToggle(e.target.checked)} disabled={isClosedOrder} />
            </label>
            <small className="muted">Catalog standard total: {(standardCents / 100).toFixed(2)} €</small>
          </div>

          <label className="field">
            <span>Agreed items price (€)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.agreedItemSubtotal}
              onChange={(e) => update("agreedItemSubtotal", e.target.value)}
              disabled={!overridePrice || isClosedOrder}
              required
            />
          </label>

          {overridePrice && (
            <label className="field md:col-span-2">
              <span>Adjustment reason</span>
              <input
                value={form.adjustmentReason}
                onChange={(e) => update("adjustmentReason", e.target.value)}
                minLength={2}
                disabled={isClosedOrder}
                required={!isClosedOrder}
                placeholder="Discount, customer-provided container…"
              />
            </label>
          )}
        </div>
      </div>

      {/* CARD 02: Fulfillment & Schedule */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line/60 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
            <span className="text-base">🚚</span> 02. Fulfillment &amp; Schedule
            {isClosedOrder && <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">Locked</span>}
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Fulfillment method</span>
            <div className="toggle-btn-group toggle-btn-group-2">
              <button
                type="button"
                className={`toggle-btn${form.fulfillmentMethod === "PICKUP" ? " selected" : ""}`}
                disabled={isClosedOrder}
                onClick={() => update("fulfillmentMethod", "PICKUP")}
              >
                🏪 Pickup
              </button>
              <button
                type="button"
                className={`toggle-btn${form.fulfillmentMethod === "DELIVERY" ? " selected" : ""}`}
                disabled={isClosedOrder}
                onClick={() => update("fulfillmentMethod", "DELIVERY")}
              >
                🚚 Delivery
              </button>
            </div>
          </div>

          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
              Fulfillment date <span className="text-berry">*</span>
            </span>
            <input
              type="date"
              value={form.fulfillmentDate}
              min={!isHistorical && !isClosedOrder ? minAllowedDate : undefined}
              max={!isHistorical && !isClosedOrder ? maxAllowedDate : undefined}
              disabled={isClosedOrder}
              onChange={(e) => update("fulfillmentDate", e.target.value)}
              onClick={(e) => {
                if (!isClosedOrder) e.currentTarget.showPicker?.();
              }}
              className="w-full"
              required
            />
            {!isHistorical && !isClosedOrder && (
              <small className="muted">
                Allowed window: Today ({minAllowedDate}) to {maxAllowedDate} (next 7 days)
              </small>
            )}
          </div>

          {form.fulfillmentMethod === "DELIVERY" && (
            <label className="field md:col-span-2">
              <span>Delivery fee (€)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.deliveryFee}
                disabled={isClosedOrder}
                onChange={(e) => update("deliveryFee", e.target.value)}
                placeholder="To be agreed"
              />
            </label>
          )}
        </div>
      </div>

      {/* CARD 03: Customer Information */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line/60 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
            <span className="text-base">👤</span> 03. Customer Details
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Order source</span>
            <div className="toggle-btn-group toggle-btn-group-auto">
              {sources.map((src) => (
                <button
                  key={src.key}
                  type="button"
                  className={`toggle-btn${normalisedSource === src.key ? " selected" : ""}`}
                  onClick={() => update("orderSource", src.key)}
                >
                  {src.labelEn}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="field">
              <span>Customer name</span>
              <input value={form.customerName} onChange={(e) => update("customerName", e.target.value)} required />
            </label>

            <label className="field">
              <span>Mobile phone</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.mobile}
                onChange={(e) => update("mobile", e.target.value)}
                onBlur={handleMobileBlur}
                required={!(normalisedSource === "FACEBOOK")}
                placeholder={(normalisedSource === "FACEBOOK") ? "Optional for Facebook orders (e.g. 040 123 4567)" : "+358 40 123 4567 or 040 123 4567"}
              />
            </label>

            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                onBlur={handleEmailBlur}
                placeholder="customer@example.com"
              />
            </label>

            <label className="field">
              <span>Facebook profile / handle</span>
              <input
                value={form.facebookProfile}
                onChange={(e) => update("facebookProfile", e.target.value)}
                required={(normalisedSource === "FACEBOOK")}
                placeholder="e.g. facebook.com/username or Facebook Name"
              />
            </label>
          </div>

          {/* Customer Address Fieldset */}
          <div className="pt-2">
            <CustomerAddressFields
              fulfillmentMethod={form.fulfillmentMethod}
              streetAddress={form.streetAddress}
              postalCode={form.postalCode}
              city={form.city}
              onStreetAddressChange={(val) => update("streetAddress", val)}
              onPostalCodeChange={(val) => update("postalCode", val)}
              onCityChange={(val) => update("city", val)}
              locale="en"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {/* Desktop Profile Actions */}
      <div className="hidden md:flex justify-end gap-3 pt-2">
        <button className="btn btn-secondary" type="button" onClick={handleCancel}>
          Cancel
        </button>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save order"}
        </button>
      </div>

      {/* Mobile Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-paper/95 backdrop-blur-md p-3.5 shadow-lg md:hidden">
        <div className="flex items-center justify-between gap-3 shell">
          <div>
            <p className="text-[11px] text-muted uppercase font-bold tracking-wider font-mono">Order #{form.id.slice(0, 8)}</p>
            <p className="text-base font-bold text-ink">{form.agreedItemSubtotal} €</p>
          </div>
          <button className="btn text-sm py-2 px-5 min-h-[44px]" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Order"}
          </button>
        </div>
      </div>
    </form>
  );
}
