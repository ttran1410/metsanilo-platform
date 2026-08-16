"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminNotice, AdminPageHeader } from "./presentation";
import { normalizeEmail, normalizeMobile } from "@/domain/order-input";

import { CustomerAddressFields } from "../customer-address-fields";

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
  const [deliveryFeeStr, setDeliveryFeeStr] = useState("");
  const [paymentEurosStr, setPaymentEurosStr] = useState("");
  const [userEditedPayment, setUserEditedPayment] = useState(false);
  const [mobileInput, setMobileInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [cityInput, setCityInput] = useState("Pori");
  const [orderSource, setOrderSource] = useState("PHONE");
  const [sourceOptions, setSourceOptions] = useState<Array<{ key: string; labelEn: string }>>([]);
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

  useEffect(() => {
    void fetch("/api/admin/order-sources")
      .then(async (response) => (response.ok ? setSourceOptions((await response.json()).data.filter((item: { active: boolean }) => item.active)) : undefined))
      .catch(() => undefined);
  }, []);

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
    const paymentStatus = String(values.get("paymentStatus") ?? "PAID");
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

    if (historical && paymentStatus === "PAID" && !(paymentEuros > 0 || calculatedTotalCents > 0)) {
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
      source: String(values.get("source") ?? "PHONE"),
      deliveryFeeCents: fulfillmentMethod === "PICKUP" ? 0 : deliveryFeeStr ? Math.round(Number(deliveryFeeStr) * 100) : undefined,

      ...(historical
        ? {
            completedStatus: values.get("completedStatus"),
            completedAt: new Date().toISOString(),
            reason: values.get("reason"),
            itemSubtotalCents: calculatedSubtotal,
            paymentAmountCents: paymentStatus === "PAID" ? Math.round((paymentEuros > 0 ? paymentEuros : calculatedTotalCents / 100) * 100) : undefined,
            paymentMethod: paymentStatus === "PAID" ? values.get("paymentMethod") || undefined : undefined,
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
      return setMessage(body.message ?? body.code ?? "Request failed");
    }
    const createdId = body.data?.id ?? body.data?.order?.id;
    router.push(`/admin/orders${createdId ? `?created=${encodeURIComponent(createdId)}` : ""}`);
  }

  return (
    <section className="shell pb-10">
      <AdminPageHeader
        eyebrow="ORDER INTAKE"
        title="Create order"
        description="Create a manual customer order or record a completed historical order."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <a className="btn btn-secondary" href="/admin/orders">
              ← Back to orders
            </a>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={historical} onChange={(e) => setHistorical(e.target.checked)} /> Record historical order
            </label>
          </div>
        }
      />

      {message && (
        <AdminNotice tone={message.startsWith("Historical") || message.startsWith("Manual") ? "success" : "error"} live>
          {message}
        </AdminNotice>
      )}

      <form className="card mt-3 grid gap-3 md:grid-cols-2" onSubmit={submit}>
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
          <span>Package &amp; price</span>
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
          <small className="muted">Calculated subtotal: {(calculatedSubtotal / 100).toFixed(2)} €</small>
        </label>

        <label className="field">
          <span>Fulfillment date</span>
          <input name="fulfillmentDate" type="date" required />
        </label>

        {/* Fulfillment Method & Delivery Fee Side-by-Side */}
        <label className="field">
          <span>Fulfillment method</span>
          <select name="fulfillmentMethod" value={fulfillmentMethod} onChange={(e) => setFulfillmentMethod(e.target.value as "PICKUP" | "DELIVERY")} required>
            <option value="PICKUP">Pickup</option>
            <option value="DELIVERY">Delivery</option>
          </select>
        </label>

        <label className="field">
          <span>Delivery fee (€)</span>
          <input
            name="deliveryFeeEuros"
            type="number"
            min="0"
            step="0.01"
            value={fulfillmentMethod === "PICKUP" ? "0.00" : deliveryFeeStr}
            onChange={(e) => setDeliveryFeeStr(e.target.value)}
            disabled={fulfillmentMethod === "PICKUP"}
            placeholder={fulfillmentMethod === "PICKUP" ? "0.00" : "Leave blank until agreed"}
          />
        </label>

        <label className="field">
          <span>Order source</span>
          <select name="source" value={orderSource} onChange={(e) => setOrderSource(e.target.value)}>
            {[
              { key: "PHONE", labelEn: "Phone" },
              { key: "SMS", labelEn: "SMS" },
              { key: "WHATSAPP", labelEn: "WhatsApp" },
              { key: "FACEBOOK", labelEn: "Facebook message" },
              { key: "OTHER", labelEn: "Other" },
            ].map((source) => (
              <option key={source.key} value={source.key}>
                {source.labelEn}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Customer name *</span>
          <input name="customerName" required />
        </label>

        <label className={`field ${mobileError ? "field-invalid" : ""}`}>
          <span>Mobile phone {!isFacebookSource && "*"}</span>
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

        <label className="field md:col-span-2">
          <span>Facebook Profile / Name {isFacebookSource && "*"}</span>
          <input name="facebookProfile" required={isFacebookSource} placeholder="e.g. facebook.com/name or Facebook Name" />
        </label>

        {/* Customer Address Fieldset */}
        <div className="md:col-span-2">
          <CustomerAddressFields
            fulfillmentMethod={fulfillmentMethod}
            city={cityInput}
            onCityChange={setCityInput}
            showFieldsetWrapper
            legend="Customer address"
            locale="en"
          />
        </div>

        {historical && (
          <>
            <label className="field">
              <span>Completed status</span>
              <select name="completedStatus">
                <option value="PICKED_UP">Picked up</option>
                <option value="DELIVERED">Delivered</option>
              </select>
            </label>

            <label className="field">
              <span>Payment status</span>
              <select name="paymentStatus" defaultValue="PAID">
                <option value="PAID">Paid</option>
                <option value="UNPAID">Unpaid</option>
              </select>
            </label>

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

            <label className="field">
              <span>Payment method</span>
              <select name="paymentMethod">
                <option value="CASH">Cash</option>
                <option value="MOBILEPAY">MobilePay</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="OTHER">Other</option>
              </select>
            </label>

            <label className="field md:col-span-2">
              <span>Reason / evidence note</span>
              <input name="reason" required minLength={2} placeholder="Historical order record details..." />
            </label>
          </>
        )}

        <div className="md:col-span-2 flex justify-end gap-3 mt-2">
          <button className="btn btn-secondary" type="button" onClick={() => router.back()}>
            Cancel
          </button>
          <button className="btn" type="submit">
            {historical ? "Record historical order" : "Create manual order"}
          </button>
        </div>
      </form>
    </section>
  );
}
