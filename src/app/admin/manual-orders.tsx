"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminNotice, AdminPageHeader } from "./presentation";

type Product = { product: { id: string; nameFi: string }; packages: Array<{ id: string; labelFi: string; volumeMl: number; priceCents: number }> };

export function ManualOrdersModule({ products }: { products: Product[] }) {
  const [historical, setHistorical] = useState(false);
  const [message, setMessage] = useState("");
  const [mobileError, setMobileError] = useState("");
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.product.id ?? "");
  const [packageId, setPackageId] = useState(products[0]?.packages[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [sourceOptions, setSourceOptions] = useState<Array<{ key: string; labelEn: string }>>([]);
  const selectedProduct = products.find((row) => row.product.id === productId);
  const selectedPackage = selectedProduct?.packages.find((item) => item.id === packageId);
  const calculatedSubtotal = useMemo(() => (selectedPackage?.priceCents ?? 0) * quantity, [selectedPackage, quantity]);
  useEffect(() => { void fetch("/api/admin/order-sources").then(async (response) => response.ok ? setSourceOptions((await response.json()).data.filter((item: { active: boolean }) => item.active)) : undefined).catch(() => undefined); }, []);
  function selectProduct(value: string) { setProductId(value); setPackageId(products.find((row) => row.product.id === value)?.packages[0]?.id ?? ""); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(""); setMobileError("");
    const values = new FormData(event.currentTarget);
    const paymentStatus = String(values.get("paymentStatus") ?? "PAID");
    const paymentEuros = Number(values.get("paymentEuros"));
    const deliveryFeeValue = String(values.get("deliveryFeeEuros") ?? "").trim();
    if (historical && paymentStatus === "PAID" && !(paymentEuros > 0 || calculatedSubtotal > 0)) return setMessage("Enter the amount received for a paid historical order.");
    const common = {
      productId: values.get("productId"), packageId: values.get("packageId"), quantity,
      fulfillmentDate: values.get("fulfillmentDate"), fulfillmentMethod: values.get("fulfillmentMethod"),
      customerName: values.get("customerName"), mobile: values.get("mobile"), email: values.get("email") || undefined,
      streetAddress: values.get("streetAddress") || undefined, postalCode: values.get("postalCode") || undefined, city: values.get("city") || undefined,
      source: String(values.get("source") ?? "PHONE"),
      deliveryFeeCents: deliveryFeeValue ? Math.round(Number(deliveryFeeValue) * 100) : undefined,
      ...(historical ? {
        completedStatus: values.get("completedStatus"), completedAt: new Date().toISOString(), reason: values.get("reason"), itemSubtotalCents: calculatedSubtotal,
        paymentAmountCents: paymentStatus === "PAID" ? Math.round((paymentEuros > 0 ? paymentEuros : calculatedSubtotal / 100) * 100) : undefined,
        paymentMethod: paymentStatus === "PAID" ? values.get("paymentMethod") || undefined : undefined,
      } : { status: "NEW" }),
    };
    const response = await fetch(historical ? "/api/admin/orders/historical" : "/api/admin/orders/external", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(common) });
    const body = await response.json();
    if (!response.ok) { if (body.details?.mobile || body.fieldErrors?.mobile) setMobileError("Enter a valid Finnish mobile number, for example 040 123 4567."); return setMessage(body.message ?? body.code ?? "Request failed"); }
    const createdId = body.data?.id ?? body.data?.order?.id;
    router.push(`/admin/orders${createdId ? `?created=${encodeURIComponent(createdId)}` : ""}`);
  }
  return <section className="shell pb-10"><AdminPageHeader eyebrow="ORDER INTAKE" title="Create order" description="Create a manual customer order or record a completed historical order." actions={<div className="flex flex-wrap items-center gap-3"><a className="btn btn-secondary" href="/admin/orders">← Back to orders</a><label className="flex items-center gap-2"><input type="checkbox" checked={historical} onChange={(event) => setHistorical(event.target.checked)} /> Record historical order</label></div>} />{message && <AdminNotice tone={message.startsWith("Historical") || message.startsWith("Manual") ? "success" : "error"} live>{message}</AdminNotice>}<form className="card mt-3 grid gap-3 md:grid-cols-2" onSubmit={submit}>
    <label className="field"><span>Product</span><select name="productId" value={productId} onChange={(event) => selectProduct(event.target.value)} required>{products.map((row) => <option key={row.product.id} value={row.product.id}>{row.product.nameFi}</option>)}</select></label>
    <label className="field"><span>Package &amp; price</span><select name="packageId" value={packageId} onChange={(event) => setPackageId(event.target.value)} required>{(selectedProduct?.packages ?? []).map((item) => <option key={item.id} value={item.id}>{item.labelFi} · {(item.priceCents / 100).toFixed(2)} €</option>)}</select></label>
    <label className="field"><span>Quantity</span><input name="quantity" type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} required /><small>Calculated subtotal: {(calculatedSubtotal / 100).toFixed(2)} €</small></label>
    <label className="field"><span>Delivery fee (€)</span><input name="deliveryFeeEuros" type="number" min="0" step="0.01" placeholder="Leave blank until agreed" /></label>
    <label className="field"><span>Fulfillment date</span><input name="fulfillmentDate" type="date" required /></label>
    <label className="field"><span>Customer name</span><input name="customerName" required /></label>
    <label className={`field ${mobileError ? "field-invalid" : ""}`}><span>Mobile *</span><input name="mobile" type="tel" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(mobileError)} value={undefined} onChange={() => setMobileError("")} required />{mobileError && <small className="field-error-message">{mobileError}</small>}</label>
    <label className="field"><span>Email</span><input name="email" type="email" /></label>
    <label className="field"><span>Facebook Profile / Name</span><input name="facebookProfile" placeholder="e.g. facebook.com/name or Facebook Name" /></label>
    <label className="field"><span>Source</span><select name="source" defaultValue="PHONE">{(sourceOptions.length ? sourceOptions : [{ key: "PHONE", labelEn: "Phone" }, { key: "SMS", labelEn: "SMS" }, { key: "WHATSAPP", labelEn: "WhatsApp" }, { key: "FACEBOOK", labelEn: "Facebook message" }]).map((source) => <option key={source.key} value={source.key}>{source.labelEn}</option>)}</select></label>
    <label className="field"><span>Fulfillment method</span><select name="fulfillmentMethod"><option value="PICKUP">Pickup</option><option value="DELIVERY">Delivery</option></select></label>

    <fieldset className="md:col-span-2 grid gap-3 rounded-lg border p-3 md:grid-cols-3"><legend>Customer address</legend><label className="field md:col-span-3"><span>Street address</span><input name="streetAddress" placeholder="Customer street address" /></label><label className="field"><span>Postal code</span><input name="postalCode" inputMode="numeric" /></label><label className="field md:col-span-2"><span>City</span><input name="city" /></label></fieldset>
    {historical && <><label className="field"><span>Completed status</span><select name="completedStatus"><option value="PICKED_UP">Picked up</option><option value="DELIVERED">Delivered</option></select></label><label className="field"><span>Payment status</span><select name="paymentStatus" defaultValue="PAID"><option value="PAID">Paid</option><option value="UNPAID">Unpaid</option></select></label><label className="field"><span>Payment received (€)</span><input name="paymentEuros" type="number" min="0" step="0.01" placeholder={(calculatedSubtotal / 100).toFixed(2)} /></label><label className="field"><span>Payment method</span><select name="paymentMethod"><option value="CASH">Cash</option><option value="MOBILEPAY">MobilePay</option><option value="CARD">Card</option><option value="BANK_TRANSFER">Bank transfer</option></select></label><label className="field"><span>Reason / evidence note</span><input name="reason" required minLength={2} /></label></>}
    <button className="btn w-fit" type="submit">{historical ? "Record historical order" : "Create manual order"}</button>
  </form></section>;
}
