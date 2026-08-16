"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeEmail, normalizeMobile } from "@/domain/order-input";

type Product = {
  product: { id: string; nameFi: string; nameEn: string };
  packages: Array<{ id: string; productId: string; labelFi: string; labelEn: string; volumeMl: number; priceCents: number; active: boolean }>;
};

type AvailabilityItem = {
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

type Order = {
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
  mobile: string;
  email: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  city: string | null;
  itemSubtotalCents: number;
  deliveryFeeCents: number | null;
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
  availabilityList = [],
}: {
  initial: Order;
  products: Product[];
  availabilityList?: AvailabilityItem[];
}) {
  const router = useRouter();
  const isHistorical = Boolean(initial.historicalEntry);
  const today = todayStr();
  const maxAllowedDate = addDaysStr(today, 7);
  const minAllowedDate = initial.fulfillmentDate < today ? initial.fulfillmentDate : today;

  const [form, setForm] = useState({
    ...initial,
    orderSource: initial.orderSource ?? "WEBSITE",
    facebookProfile: initial.facebookProfile ?? "",
    email: initial.email ?? "",
    streetAddress: initial.streetAddress ?? "",
    postalCode: initial.postalCode ?? "",
    city: initial.city ?? "",
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
      /* Keep user input if unparseable until form submit */
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
        city: form.city || null,
        deliveryFeeCents: form.fulfillmentMethod === "PICKUP" ? 0 : form.deliveryFee === "" ? null : Math.round(Number(form.deliveryFee) * 100),
        agreedItemSubtotalCents: Math.round(Number(form.agreedItemSubtotal) * 100),
        adjustmentReason: overridePrice ? form.adjustmentReason : undefined,
      }),
    });

    const body = await response.json();
    setSaving(false);
    if (!response.ok) return setError(body.message ?? body.code ?? "Could not save order");
    router.push(`/admin/orders/${form.id}?updated=1`);
    router.refresh();
  }

  return (
    <form className="card detail-form order-edit-form" onSubmit={save}>
      <div className="order-edit-preview" role="status">
        <strong>Capacity preview</strong>
        <span>
          {volumeDelta === 0
            ? "No capacity change"
            : volumeDelta > 0
            ? `Release ${initial.volumeMl / 1000} L on ${initial.fulfillmentDate}; reserve ${(volumeDelta + initial.volumeMl) / 1000} L on ${form.fulfillmentDate}.`
            : `Release ${initial.volumeMl / 1000} L on ${initial.fulfillmentDate}; reserve ${(volumeDelta + initial.volumeMl) / 1000} L on ${form.fulfillmentDate}.`}
        </span>
        <small>Final capacity is checked atomically when you save. The server can reject if the target date is no longer available.</small>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">
          <span>Product *</span>
          <select value={form.productId} onChange={(e) => handleProductChange(e.target.value)} required>
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
          <span>Package *</span>
          <select value={form.packageId} onChange={(e) => handlePackageChange(e.target.value)} required>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.labelFi} · {(pkg.volumeMl / 1000).toFixed(0)} L · {(pkg.priceCents / 100).toFixed(2)} €
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Quantity *</span>
          <input type="number" min="1" max="100" value={form.quantity} onChange={(e) => handleQuantityChange(e.target.value)} required />
        </label>

        <label className="field">
          <span>Fulfillment date *</span>
          <input
            type="date"
            value={form.fulfillmentDate}
            min={!isHistorical ? minAllowedDate : undefined}
            max={!isHistorical ? maxAllowedDate : undefined}
            onChange={(e) => update("fulfillmentDate", e.target.value)}
            required
          />
          {!isHistorical && (
            <small className="muted">
              Allowed window: Today ({minAllowedDate}) to {maxAllowedDate} (next 7 days)
            </small>
          )}
        </label>

        <label className="field">
          <span>Fulfillment method *</span>
          <select value={form.fulfillmentMethod} onChange={(e) => update("fulfillmentMethod", e.target.value)}>
            <option value="PICKUP">Pickup</option>
            <option value="DELIVERY">Delivery</option>
          </select>
        </label>

        <label className="field">
          <span>Order source</span>
          <select value={form.orderSource} onChange={(e) => update("orderSource", e.target.value)}>
            <option value="WEBSITE">Website</option>
            <option value="MANUAL">Manual</option>
            <option value="SMS">SMS</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="FACEBOOK_MESSAGE">Facebook Message</option>
            <option value="OTHER">Other</option>
          </select>
        </label>

        <label className="field">
          <span>Customer name *</span>
          <input value={form.customerName} onChange={(e) => update("customerName", e.target.value)} required />
        </label>

        <label className="field">
          <span>Mobile *</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.mobile}
            onChange={(e) => update("mobile", e.target.value)}
            onBlur={handleMobileBlur}
            required
            placeholder="+358501234567 or 0501234567"
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
          <span>Facebook Profile / Name (Optional)</span>
          <input
            value={form.facebookProfile}
            onChange={(e) => update("facebookProfile", e.target.value)}
            placeholder="e.g. facebook.com/username or Facebook Name"
          />
        </label>

        <label className="field md:col-span-2">
          <span>Customer street address {form.fulfillmentMethod === "DELIVERY" ? "*" : "(Optional)"}</span>
          <input
            value={form.streetAddress}
            onChange={(e) => update("streetAddress", e.target.value)}
            required={form.fulfillmentMethod === "DELIVERY"}
            placeholder={form.fulfillmentMethod === "DELIVERY" ? "Required for delivery" : "Optional for pickup"}
          />
        </label>

        <label className="field">
          <span>Postal code</span>
          <input inputMode="numeric" value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} />
        </label>

        <label className="field">
          <span>City</span>
          <input value={form.city} onChange={(e) => update("city", e.target.value)} />
        </label>

        <div className="field">
          <label className="checkbox-field">
            <span>Override catalog price</span>
            <input type="checkbox" checked={overridePrice} onChange={(e) => handleOverrideToggle(e.target.checked)} />
          </label>
          <small className="muted">Current catalog total: {(standardCents / 100).toFixed(2)} €</small>
        </div>

        <label className="field">
          <span>Agreed items price (€) *</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.agreedItemSubtotal}
            onChange={(e) => update("agreedItemSubtotal", e.target.value)}
            disabled={!overridePrice}
            required
          />
        </label>

        <label className="field">
          <span>Delivery fee (€)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.fulfillmentMethod === "PICKUP" ? "0.00" : form.deliveryFee}
            onChange={(e) => update("deliveryFee", e.target.value)}
            disabled={form.fulfillmentMethod === "PICKUP"}
            placeholder="To be agreed"
          />
        </label>

        {overridePrice && (
          <label className="field md:col-span-2">
            <span>Adjustment reason *</span>
            <input
              value={form.adjustmentReason}
              onChange={(e) => update("adjustmentReason", e.target.value)}
              minLength={2}
              required
              placeholder="Discount, customer-provided container…"
            />
          </label>
        )}
      </div>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="profile-actions">
        <button className="btn btn-secondary" type="button" onClick={() => router.back()}>
          Cancel
        </button>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save order"}
        </button>
      </div>
    </form>
  );
}
