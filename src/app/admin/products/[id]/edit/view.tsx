"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminNotice } from "../../../presentation";

type Product = {
  id: string;
  code: string;
  slug: string;
  nameFi: string;
  nameEn: string;
  descriptionFi: string;
  descriptionEn: string;
  availableFrom: string;
  availableThrough: string;
  active: boolean;
  showOnHomepage: boolean;
  showOnReserve: boolean;
};

export function ProductEditView({
  initial,
  impact,
}: {
  initial: Product;
  impact: { activeOrders: number; availabilityRows: number };
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    const values = new FormData(event.currentTarget);
    const payload = {
      code: String(values.get("code")).trim().toUpperCase(),
      slug: String(values.get("slug")).trim().toLowerCase(),
      nameFi: String(values.get("nameFi")).trim(),
      nameEn: String(values.get("nameEn")).trim(),
      descriptionFi: String(values.get("descriptionFi")).trim(),
      descriptionEn: String(values.get("descriptionEn")).trim(),
      availableFrom: values.get("availableFrom"),
      availableThrough: values.get("availableThrough"),
      active: values.get("active") === "on",
      showOnHomepage: values.get("showOnHomepage") === "on",
      showOnReserve: values.get("showOnReserve") === "on",
    };

    const response = await fetch(`/api/admin/products/${initial.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "update", product: payload }),
    });

    const body = await response.json();
    setSaving(false);

    if (!response.ok) {
      return setError(body.message ?? body.code ?? "Product could not be updated.");
    }

    setMessage("Product updated successfully.");
    router.push(`/admin/products/${initial.id}`);
    router.refresh();
  }

  return (
    <section className="product-edit-workspace pb-10 max-w-4xl flex flex-col gap-4">
      {message && <AdminNotice tone="success" live>{message}</AdminNotice>}
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      {/* CHANGE IMPACT PREVIEW WARNING */}
      <div className="card p-4 bg-amber-50/60 border-amber-200 text-amber-900 flex flex-col gap-1">
        <div className="flex items-center gap-2 font-bold text-sm">
          <span>⚠️ Change Impact Preview</span>
        </div>
        <p className="text-xs text-amber-800 leading-relaxed">
          This product is currently linked to <strong>{impact.activeOrders} active order(s)</strong> and{" "}
          <strong>{impact.availabilityRows} planned harvest availability row(s)</strong>. Date window changes will be rejected if they exclude active orders or reserved capacity.
        </p>
      </div>

      <form className="card p-5 md:p-6 grid gap-6" onSubmit={(event) => void save(event)}>
        <div>
          <p className="eyebrow">EDIT PRODUCT</p>
          <h1 className="text-xl font-bold tracking-tight text-ink">Edit {initial.nameFi}</h1>
          <p className="text-xs muted">Update core product codes, language descriptions, dates, and publishing channels.</p>
        </div>

        {/* 1. PRODUCT IDENTITY */}
        <section className="grid gap-4 border-t border-line pt-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">1. Identity &amp; Codes</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="field">
              <span>Product code *</span>
              <input name="code" defaultValue={initial.code} required className="uppercase font-medium" />
            </label>

            <label className="field">
              <span>URL Slug *</span>
              <input name="slug" defaultValue={initial.slug} required className="font-medium" />
            </label>

            <label className="field">
              <span>Finnish name *</span>
              <input name="nameFi" defaultValue={initial.nameFi} required />
            </label>

            <label className="field">
              <span>English name *</span>
              <input name="nameEn" defaultValue={initial.nameEn} required />
            </label>
          </div>
        </section>

        {/* 2. DATES & CHANNELS */}
        <section className="grid gap-4 border-t border-line pt-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">2. Availability Window &amp; Publishing</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="field">
              <span>Available from *</span>
              <input name="availableFrom" type="date" defaultValue={initial.availableFrom} required />
            </label>

            <label className="field">
              <span>Available through *</span>
              <input name="availableThrough" type="date" defaultValue={initial.availableThrough} required />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-6 p-3 bg-surface-muted rounded-xl border border-line">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input name="active" type="checkbox" defaultChecked={initial.active} />
              <span>Product Active</span>
            </label>

            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input name="showOnHomepage" type="checkbox" defaultChecked={initial.showOnHomepage} />
              <span>🌐 Storefront Visibility</span>
            </label>

            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input name="showOnReserve" type="checkbox" defaultChecked={initial.showOnReserve} />
              <span>📝 Reserve Portal Visibility</span>
            </label>
          </div>
        </section>

        {/* 3. DESCRIPTIONS */}
        <section className="grid gap-4 border-t border-line pt-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">3. Storefront Copy</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="field">
              <span>Finnish description</span>
              <textarea name="descriptionFi" defaultValue={initial.descriptionFi} rows={4} />
            </label>

            <label className="field">
              <span>English description</span>
              <textarea name="descriptionEn" defaultValue={initial.descriptionEn} rows={4} />
            </label>
          </div>
        </section>

        <div className="profile-actions border-t border-line pt-4 justify-end gap-3">
          <button className="btn btn-secondary" type="button" onClick={() => router.back()}>
            Cancel
          </button>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Saving changes…" : "Save product"}
          </button>
        </div>
      </form>
    </section>
  );
}
