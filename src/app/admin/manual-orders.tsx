"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminNotice, AdminPageHeader } from "./presentation";
import { normalizeEmail, normalizeMobile } from "@/domain/order-input";
import { CustomerAddressFields } from "../customer-address-fields";

type OrderSource = { key: string; labelEn: string };

type Product = {
  product: { id: string; nameFi: string };
  packages: Array<{ id: string; labelFi: string; volumeMl: number; priceCents: number }>;
};

export function ManualOrdersModule({ products }: { products: Product[] }) {
  const router = useRouter();
  const [historical, setHistorical] = useState(false);
  const [message, setMessage] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [productId, setProductId] = useState(products[0]?.product.id ?? "");
  const [packageId, setPackageId] = useState(products[0]?.packages[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [fulfillmentDateInput, setFulfillmentDateInput] = useState("");
  const [deliveryFeeStr, setDeliveryFeeStr] = useState("");

  const isPastDate = useMemo(() => {
    if (!fulfillmentDateInput) return false;
    const today = new Date().toISOString().slice(0, 10);
    return fulfillmentDateInput < today;
  }, [fulfillmentDateInput]);
  const [paymentEurosStr, setPaymentEurosStr] = useState("");
  const [userEditedPayment, setUserEditedPayment] = useState(false);
  const [mobileInput, setMobileInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [cityInput, setCityInput] = useState("Pori");
  const [orderSource, setOrderSource] = useState("PHONE");
  const [completedStatus, setCompletedStatus] = useState<"PICKED_UP" | "DELIVERED">("PICKED_UP");
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "UNPAID">("PAID");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [sources, setSources] = useState<OrderSource[]>([
    { key: "PHONE", labelEn: "Phone" },
    { key: "SMS", labelEn: "SMS" },
    { key: "WHATSAPP", labelEn: "WhatsApp" },
    { key: "FACEBOOK", labelEn: "Facebook" },
    { key: "OTHER", labelEn: "Other" },
  ]);

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

  const isFacebookSource = orderSource === "FACEBOOK";

  const selectedProduct = products.find((row) => row.product.id === productId);
  const selectedPackage = selectedProduct?.packages.find((item) => item.id === packageId);
  const calculatedSubtotal = useMemo(() => (selectedPackage?.priceCents ?? 0) * quantity, [selectedPackage, quantity]);

  const deliveryFeeCents = fulfillmentMethod === "PICKUP" ? 0 : deliveryFeeStr ? Math.round(Number(deliveryFeeStr) * 100) : 0;
  const calculatedTotalCents = calculatedSubtotal + deliveryFeeCents;

  // Sync Payment Received default value dynamically unless user edited manually
  useEffect(() => {
    if (!userEditedPayment) {
      setPaymentEurosStr((calculatedTotalCents / 100).toFixed(2));
    }
  }, [calculatedTotalCents, userEditedPayment]);

  function selectProduct(value: string) {
    setProductId(value);
    setPackageId(products.find((row) => row.product.id === value)?.packages[0]?.id ?? "");
  }

  function handleMobileBlur() {
    if (!mobileInput.trim()) return;
    try {
      setMobileInput(normalizeMobile(mobileInput));
      setMobileError("");
    } catch {
      /* Keep user input until submit */
    }
  }

  function handleEmailBlur() {
    if (!emailInput.trim()) return;
    setEmailInput(normalizeEmail(emailInput) ?? "");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setMobileError("");
    const values = new FormData(event.currentTarget);
    const formPaymentStatus = String(values.get("paymentStatus") ?? paymentStatus);
    const paymentEuros = Number(paymentEurosStr);

    let normalizedMobile: string | undefined = undefined;
    if (mobileInput.trim()) {
      try {
        normalizedMobile = normalizeMobile(mobileInput);
      } catch {
        if (orderSource !== "FACEBOOK") {
          setMobileError("Enter a valid mobile number (e.g. 040 123 4567 or +358401234567).");
          return setMessage("Invalid phone number format.");
        }
      }
    } else if (orderSource !== "FACEBOOK") {
      setMobileError("Enter a valid mobile number (e.g. 040 123 4567 or +358401234567).");
      return setMessage("Mobile phone is required.");
    }

    if (historical && formPaymentStatus === "PAID" && !(paymentEuros > 0 || calculatedTotalCents > 0)) {
      return setMessage("Enter the amount received for a paid historical order.");
    }

    const common = {
      productId: values.get("productId"),
      packageId: values.get("packageId"),
      quantity,
      fulfillmentDate: values.get("fulfillmentDate"),
      fulfillmentMethod,
      customerName: values.get("customerName"),
      mobile: normalizedMobile,
      email: normalizeEmail(emailInput) || undefined,
      facebookProfile: String(values.get("facebookProfile") ?? "").trim() || undefined,
      streetAddress: String(values.get("streetAddress") ?? "").trim() || undefined,
      postalCode: String(values.get("postalCode") ?? "").trim() || undefined,
      city: String(values.get("city") ?? "").trim() || "Pori",
      source: String(values.get("source") ?? orderSource),
      deliveryFeeCents: fulfillmentMethod === "PICKUP" ? 0 : deliveryFeeStr ? Math.round(Number(deliveryFeeStr) * 100) : undefined,

      ...(historical
        ? {
            completedStatus: values.get("completedStatus") ?? completedStatus,
            completedAt: new Date().toISOString(),
            reason: values.get("reason"),
            itemSubtotalCents: calculatedSubtotal,
            paymentAmountCents: formPaymentStatus === "PAID" ? Math.round((paymentEuros > 0 ? paymentEuros : calculatedTotalCents / 100) * 100) : undefined,
            paymentMethod: formPaymentStatus === "PAID" ? (values.get("paymentMethod") ?? paymentMethod) || undefined : undefined,
          }
        : { status: "NEW" }),
    };

    const response = await fetch(historical ? "/api/admin/orders/historical" : "/api/admin/orders/external", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(common),
    });
    const body = await response.json();
    if (!response.ok) {
      if (body.details?.mobile || body.fieldErrors?.mobile) setMobileError("Enter a valid mobile number, for example 040 123 4567.");
      const fieldDetails = body.fieldErrors ? ` (${Object.entries(body.fieldErrors).map(([k, v]) => `${k}: ${v}`).join(", ")})` : "";
      return setMessage(`${body.message ?? body.code ?? "Request failed"}${fieldDetails}`);
    }
    const createdId = body.data?.id ?? body.data?.order?.id;
    router.push(`/admin/orders${createdId ? `?created=${encodeURIComponent(createdId)}` : ""}`);
  }

  return (
    <section className="shell pb-28 md:pb-12">
      <AdminPageHeader
        eyebrow="ORDER INTAKE"
        title={historical ? "Record historical order" : "Create manual order"}
        description="Create a manual customer order or record a completed historical order."
        actions={
          <a className="btn btn-secondary" href="/admin/orders">
            ← Back to orders
          </a>
        }
      />

      {message && (
        <AdminNotice tone={message.startsWith("Historical") || message.startsWith("Manual") ? "success" : "error"} live>
          {message}
        </AdminNotice>
      )}

      {/* Top Segmented Mode Switcher */}
      <div className="mt-4 flex rounded-xl border border-line bg-oat/50 p-1 max-w-md mx-auto shadow-xs">
        <button
          type="button"
          className={`flex-1 py-2 px-3 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            !historical
              ? "bg-white text-forest shadow-sm border border-line/60"
              : "text-muted hover:text-ink"
          }`}
          onClick={() => setHistorical(false)}
        >
          <span>🛒</span> New Order Intake
        </button>
        <button
          type="button"
          className={`flex-1 py-2 px-3 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            historical
              ? "bg-white text-berry shadow-sm border border-line/60"
              : "text-muted hover:text-ink"
          }`}
          onClick={() => setHistorical(true)}
        >
          <span>📜</span> Historical Record
        </button>
      </div>

      <form className="mt-6 space-y-5" onSubmit={submit}>
        <input type="hidden" name="fulfillmentMethod" value={fulfillmentMethod} />
        <input type="hidden" name="source" value={orderSource} />
        {historical && (
          <>
            <input type="hidden" name="completedStatus" value={completedStatus} />
            <input type="hidden" name="paymentStatus" value={paymentStatus} />
            <input type="hidden" name="paymentMethod" value={paymentMethod} />
          </>
        )}

        {/* CARD 01: Product & Quantity */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-line/60 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
              <span className="text-base">📦</span> 01. Product &amp; Quantity
            </h3>
            <span className="text-xs font-bold text-forest bg-primary-soft/80 px-2.5 py-1 rounded-full border border-forest/20">
              Subtotal: {(calculatedSubtotal / 100).toFixed(2)} €
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="field">
              <span>Product</span>
              <select name="productId" value={productId} onChange={(e) => selectProduct(e.target.value)} required>
                {products.map((row) => (
                  <option key={row.product.id} value={row.product.id}>
                    {row.product.nameFi}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Package &amp; unit price</span>
              <select name="packageId" value={packageId} onChange={(e) => setPackageId(e.target.value)} required>
                {(selectedProduct?.packages ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.labelFi} · {(item.priceCents / 100).toFixed(2)} €
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Quantity</span>
              <input name="quantity" type="number" min="1" max="100" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} required />
            </label>
          </div>
        </div>

        {/* CARD 02: Fulfillment & Schedule */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-line/60 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
              <span className="text-base">🚚</span> 02. Fulfillment &amp; Schedule
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Fulfillment method</span>
              <div className="toggle-btn-group toggle-btn-group-2">
                <button
                  type="button"
                  className={`toggle-btn${fulfillmentMethod === "PICKUP" ? " selected" : ""}`}
                  onClick={() => {
                    setFulfillmentMethod("PICKUP");
                    setCompletedStatus("PICKED_UP");
                  }}
                >
                  🏪 Pickup
                </button>
                <button
                  type="button"
                  className={`toggle-btn${fulfillmentMethod === "DELIVERY" ? " selected" : ""}`}
                  onClick={() => {
                    setFulfillmentMethod("DELIVERY");
                    setCompletedStatus("DELIVERED");
                  }}
                >
                  🚚 Delivery
                </button>
              </div>
            </div>

            <label className="field">
              <span>Fulfillment date</span>
              <input
                name="fulfillmentDate"
                type="date"
                required
                value={fulfillmentDateInput}
                onChange={(e) => setFulfillmentDateInput(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
              />
            </label>

            {!historical && isPastDate && (
              <div className="md:col-span-2 rounded-xl border border-amber-300/80 bg-amber-50/90 p-3.5 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚠️</span>
                  <span>
                    <strong>Selected date ({fulfillmentDateInput}) is in the past.</strong> If recording a completed past order, switch to Historical Record mode.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary py-1 px-3 text-xs bg-white border-amber-300 text-amber-950 hover:bg-amber-100 font-bold"
                  onClick={() => setHistorical(true)}
                >
                  📜 Switch to Historical Mode
                </button>
              </div>
            )}

            {fulfillmentMethod === "DELIVERY" && (
              <label className="field md:col-span-2">
                <span>Delivery fee (€)</span>
                <input
                  name="deliveryFeeEuros"
                  type="number"
                  min="0"
                  step="0.01"
                  value={deliveryFeeStr}
                  onChange={(e) => setDeliveryFeeStr(e.target.value)}
                  placeholder="Leave blank until agreed"
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
                    className={`toggle-btn${orderSource === src.key ? " selected" : ""}`}
                    onClick={() => setOrderSource(src.key)}
                  >
                    {src.labelEn}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="field">
                <span>Customer name</span>
                <input name="customerName" required placeholder="Full customer name" />
              </label>

              <label className={`field ${mobileError ? "field-invalid" : ""}`}>
                <span>Mobile phone</span>
                <input
                  name="mobile"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={Boolean(mobileError)}
                  value={mobileInput}
                  onChange={(e) => {
                    setMobileInput(e.target.value);
                    setMobileError("");
                  }}
                  onBlur={handleMobileBlur}
                  placeholder={isFacebookSource ? "Optional for Facebook orders (e.g. 040 123 4567)" : "+358 40 123 4567 or 040 123 4567"}
                  required={!isFacebookSource}
                />
                {mobileError && <small className="field-error-message">{mobileError}</small>}
              </label>

              <label className="field">
                <span>Email</span>
                <input name="email" type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} onBlur={handleEmailBlur} placeholder="customer@example.com" />
              </label>

              <label className="field">
                <span>Facebook profile / handle</span>
                <input name="facebookProfile" required={isFacebookSource} placeholder={isFacebookSource ? "Required for Facebook orders" : "Optional profile URL or name"} />
              </label>
            </div>

            {/* Customer Address Fieldset */}
            <div className="pt-2">
              <CustomerAddressFields
                fulfillmentMethod={fulfillmentMethod}
                city={cityInput}
                onCityChange={setCityInput}
                showFieldsetWrapper
                legend="Customer address"
                locale="en"
              />
            </div>
          </div>
        </div>

        {/* CARD 04: Historical Settlement (Historical Mode Only) */}
        {historical && (
          <div className="card p-5 space-y-4 border-l-4 border-berry bg-berry-soft/20">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-berry flex items-center gap-2">
                <span className="text-base">💳</span> 04. Historical Past Settlement
              </h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Completed status</span>
                <div className="toggle-btn-group toggle-btn-group-2">
                  <button
                    type="button"
                    className={`toggle-btn toggle-btn-danger${completedStatus === "PICKED_UP" ? " selected" : ""}`}
                    onClick={() => {
                      setCompletedStatus("PICKED_UP");
                      setFulfillmentMethod("PICKUP");
                    }}
                  >
                    Picked up (Pickup)
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn toggle-btn-danger${completedStatus === "DELIVERED" ? " selected" : ""}`}
                    onClick={() => {
                      setCompletedStatus("DELIVERED");
                      setFulfillmentMethod("DELIVERY");
                    }}
                  >
                    Delivered (Delivery)
                  </button>
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Payment status</span>
                <div className="toggle-btn-group toggle-btn-group-2">
                  <button
                    type="button"
                    className={`toggle-btn${paymentStatus === "PAID" ? " selected" : ""}`}
                    onClick={() => setPaymentStatus("PAID")}
                  >
                    Paid
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn toggle-btn-danger${paymentStatus === "UNPAID" ? " selected" : ""}`}
                    onClick={() => setPaymentStatus("UNPAID")}
                  >
                    Unpaid
                  </button>
                </div>
              </div>

              {paymentStatus === "PAID" && (
                <>
                  <label className="field">
                    <span>Payment received (€)</span>
                    <input
                      name="paymentEuros"
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentEurosStr}
                      onChange={(e) => {
                        setPaymentEurosStr(e.target.value);
                        setUserEditedPayment(true);
                      }}
                      placeholder={(calculatedTotalCents / 100).toFixed(2)}
                    />
                    <small className="muted">Calculated total: {(calculatedTotalCents / 100).toFixed(2)} €</small>
                  </label>

                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Payment method</span>
                    <div className="toggle-btn-group toggle-btn-group-auto">
                      {[
                        { key: "CASH", label: "Cash" },
                        { key: "MOBILEPAY", label: "MobilePay" },
                        { key: "CARD", label: "Card" },
                        { key: "BANK_TRANSFER", label: "Bank transfer" },
                        { key: "OTHER", label: "Other" },
                      ].map((pm) => (
                        <button
                          key={pm.key}
                          type="button"
                          className={`toggle-btn${paymentMethod === pm.key ? " selected" : ""}`}
                          onClick={() => setPaymentMethod(pm.key)}
                        >
                          {pm.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <label className="field md:col-span-2">
                <span>Reason / evidence note</span>
                <input name="reason" required minLength={2} placeholder="Historical order record details..." />
              </label>
            </div>
          </div>
        )}

        {/* Desktop Buttons */}
        <div className="hidden md:flex justify-end gap-3 pt-2">
          <button className="btn btn-secondary" type="button" onClick={() => router.back()}>
            Cancel
          </button>
          <button className="btn" type="submit">
            {historical ? "Record historical order" : "Create manual order"}
          </button>
        </div>

        {/* Mobile Sticky Footer */}
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-paper/95 backdrop-blur-md p-3.5 shadow-lg md:hidden">
          <div className="flex items-center justify-between gap-3 shell">
            <div>
              <p className="text-[11px] text-muted uppercase font-bold tracking-wider">Total amount</p>
              <p className="text-lg font-bold text-ink">{(calculatedTotalCents / 100).toFixed(2)} €</p>
            </div>
            <button className="btn text-sm py-2 px-5 min-h-[44px]" type="submit">
              {historical ? "Record Order" : "Create Order"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
