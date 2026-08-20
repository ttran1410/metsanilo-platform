"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminNotice } from "../../presentation";

export function ProductCreateView() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [nameFi, setNameFi] = useState("");
  const [slug, setSlug] = useState("");
  const [slugUserEdited, setSlugUserEdited] = useState(false);

  const [pkgLabelFi, setPkgLabelFi] = useState("5 litran sanko");
  const [pkgLabelEn, setPkgLabelEn] = useState("5 litre bucket");
  const [pkgVolumeLitres, setPkgVolumeLitres] = useState("5");
  const [pkgPriceEuros, setPkgPriceEuros] = useState("45.00");

  function handleNameFiChange(val: string) {
    setNameFi(val);
    if (!slugUserEdited) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/ä/g, "a")
        .replace(/ö/g, "o")
        .replace(/å/g, "a")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generatedSlug);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const values = new FormData(event.currentTarget);
    const litresNum = Number(pkgVolumeLitres);
    const eurosNum = Number(pkgPriceEuros);

    if (isNaN(litresNum) || litresNum <= 0) {
      setSaving(false);
      return setError("Initial package volume must be greater than 0 Litres.");
    }
    if (isNaN(eurosNum) || eurosNum < 0) {
      setSaving(false);
      return setError("Initial package price must be 0 or greater.");
    }

    const payload = {
      code: String(values.get("code")).trim().toUpperCase(),
      slug: String(values.get("slug")).trim().toLowerCase(),
      nameFi: nameFi.trim(),
      nameEn: String(values.get("nameEn")).trim(),
      descriptionFi: String(values.get("descriptionFi")).trim(),
      descriptionEn: String(values.get("descriptionEn")).trim(),
      availableFrom: values.get("availableFrom"),
      availableThrough: values.get("availableThrough"),
      active: true,
      showOnHomepage: values.get("showOnHomepage") === "on",
      showOnReserve: values.get("showOnReserve") === "on",
      packages: [
        {
          labelFi: pkgLabelFi.trim() || `${litresNum} litran sanko`,
          labelEn: pkgLabelEn.trim() || `${litresNum} litre bucket`,
          volumeMl: Math.round(litresNum * 1000),
          priceCents: Math.round(eurosNum * 100),
          active: true,
          isDefault: true,
        },
      ],
    };

    const response = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json();
    setSaving(false);

    if (!response.ok) {
      return setError(body.message ?? body.code ?? "Product could not be created.");
    }

    router.push(`/admin/products/${body.data.product.id}`);
  }

  return (
    <form className="card p-5 md:p-6 grid gap-6 max-w-4xl" onSubmit={(event) => void submit(event)}>
      <div>
        <p className="eyebrow">NEW PRODUCT</p>
        <h1 className="text-xl font-bold tracking-tight text-ink">Create Catalog Product</h1>
        <p className="text-xs muted">Set up product details, availability date window, and initial package option.</p>
      </div>

      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      {/* CORE PRODUCT IDENTIFICATION */}
      <section className="grid gap-4 border-t border-line pt-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">1. Product Identity &amp; Names</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="field">
            <span>Product code *</span>
            <input name="code" required placeholder="e.g. MUSTIKKA or MUST-5L" className="uppercase" />
            <small className="muted">2–40 uppercase letters, numbers, hyphens</small>
          </label>

          <label className="field">
            <span>URL Slug *</span>
            <input
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugUserEdited(true);
              }}
              required
              placeholder="e.g. mustikka"
            />
          </label>

          <label className="field">
            <span>Finnish name *</span>
            <input
              name="nameFi"
              value={nameFi}
              onChange={(e) => handleNameFiChange(e.target.value)}
              required
              placeholder="e.g. Mustikka"
            />
          </label>

          <label className="field">
            <span>English name *</span>
            <input name="nameEn" required placeholder="e.g. Blueberry" />
          </label>
        </div>
      </section>

      {/* AVAILABILITY DATES & CHANNEL VISIBILITY */}
      <section className="grid gap-4 border-t border-line pt-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">2. Harvest Window &amp; Storefront Channels</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="field">
            <span>Available from *</span>
            <input name="availableFrom" type="date" required onClick={(e) => e.currentTarget.showPicker?.()} />
          </label>

          <label className="field">
            <span>Available through *</span>
            <input name="availableThrough" type="date" required onClick={(e) => e.currentTarget.showPicker?.()} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-6 p-3 bg-surface-muted rounded-xl border border-line">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input name="showOnHomepage" type="checkbox" defaultChecked />
            <span>🌐 Visible on Main Storefront</span>
          </label>

          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input name="showOnReserve" type="checkbox" defaultChecked />
            <span>📝 Visible on Reserve Harvest Portal</span>
          </label>
        </div>
      </section>

      {/* INITIAL PACKAGE SETUP */}
      <section className="grid gap-4 border-t border-line pt-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">3. Initial Package Setup</h2>
        <div className="grid gap-3 md:grid-cols-2 bg-surface-muted/50 p-4 rounded-xl border border-line">
          <label className="field"><span>Package Label FI *</span><input value={pkgLabelFi} onChange={(e) => setPkgLabelFi(e.target.value)} required /></label>
          <label className="field"><span>Package Label EN *</span><input value={pkgLabelEn} onChange={(e) => setPkgLabelEn(e.target.value)} required /></label>
          <label className="field"><span>Volume (Litres) *</span><input type="number" step="0.1" min="0.1" value={pkgVolumeLitres} onChange={(e) => setPkgVolumeLitres(e.target.value)} required /></label>
          <label className="field"><span>Price (€) *</span><input type="number" step="0.01" min="0" value={pkgPriceEuros} onChange={(e) => setPkgPriceEuros(e.target.value)} required /></label>
        </div>
      </section>

      {/* DESCRIPTIONS */}
      <section className="grid gap-4 border-t border-line pt-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">4. Descriptions</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="field"><span>Finnish description</span><textarea name="descriptionFi" rows={3} placeholder="Metsän raikas luomumustikka…" /></label>
          <label className="field"><span>English description</span><textarea name="descriptionEn" rows={3} placeholder="Wild organic bilberry harvested from Finnish forests…" /></label>
        </div>
      </section>

      <div className="profile-actions border-t border-line pt-4 justify-end gap-3">
        <Link className="btn btn-secondary" href="/admin/products">
          Cancel
        </Link>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Creating product…" : "Create product ↗"}
        </button>
      </div>
    </form>
  );
}
