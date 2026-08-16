"use client";

import { useState, type FormEvent } from "react";
import type { packages } from "@/db/schema";
import { AdminNotice } from "../presentation";

type PackageRow = typeof packages.$inferSelect;

export function PackageModal({
  productId,
  editingPackage,
  onClose,
  onSaved,
}: {
  productId: string;
  editingPackage?: PackageRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(editingPackage);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [labelFi, setLabelFi] = useState(editingPackage?.labelFi ?? "");
  const [labelEn, setLabelEn] = useState(editingPackage?.labelEn ?? "");
  const [volumeLitres, setVolumeLitres] = useState(
    editingPackage ? (editingPackage.volumeMl / 1000).toString() : "5"
  );
  const [priceEuros, setPriceEuros] = useState(
    editingPackage ? (editingPackage.priceCents / 100).toFixed(2) : "45.00"
  );
  const [active, setActive] = useState(editingPackage?.active ?? true);
  const [isDefault, setIsDefault] = useState(editingPackage?.isDefault ?? false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    const litresNum = Number(volumeLitres);
    const eurosNum = Number(priceEuros);

    if (!labelFi.trim() || !labelEn.trim()) {
      setBusy(false);
      return setError("Both Finnish and English package labels are required.");
    }
    if (isNaN(litresNum) || litresNum <= 0) {
      setBusy(false);
      return setError("Package volume must be greater than 0 Litres.");
    }
    if (isNaN(eurosNum) || eurosNum < 0) {
      setBusy(false);
      return setError("Package price must be 0 or greater.");
    }

    const payload = {
      labelFi: labelFi.trim(),
      labelEn: labelEn.trim(),
      volumeMl: Math.round(litresNum * 1000),
      priceCents: Math.round(eurosNum * 100),
      active,
      isDefault,
    };

    try {
      const url = editingPackage ? `/api/admin/packages/${editingPackage.id}` : `/api/admin/products/${productId}/packages`;
      const method = editingPackage ? "PATCH" : "POST";
      const bodyPayload = editingPackage ? { action: "update", package: payload } : payload;

      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const body = await response.json();
      setBusy(false);

      if (!response.ok) {
        return setError(body.message ?? body.code ?? "Could not save package.");
      }

      onSaved();
      onClose();
    } catch {
      setBusy(false);
      setError("An unexpected network error occurred.");
    }
  }

  return (
    <div className="admin-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-dialog card max-w-lg w-full p-6 shadow-2xl rounded-2xl bg-surface border border-line">
        <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
          <div>
            <p className="eyebrow">{isEditing ? "EDIT PACKAGE" : "NEW PACKAGE"}</p>
            <h2 className="text-xl font-bold tracking-tight text-ink">
              {isEditing && editingPackage ? `Edit ${editingPackage.labelFi}` : "Add New Package"}
            </h2>
          </div>
          <button type="button" className="btn btn-secondary text-xs py-1 px-2.5" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="field">
              <span>Finnish Label *</span>
              <input
                value={labelFi}
                onChange={(e) => setLabelFi(e.target.value)}
                placeholder="e.g. 5 litraa"
                required
              />
            </label>

            <label className="field">
              <span>English Label *</span>
              <input
                value={labelEn}
                onChange={(e) => setLabelEn(e.target.value)}
                placeholder="e.g. 5 liters"
                required
              />
            </label>

            <label className="field">
              <span>Volume (Litres) *</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                value={volumeLitres}
                onChange={(e) => setVolumeLitres(e.target.value)}
                required
              />
              <small className="muted">
                Stored as {Math.round((Number(volumeLitres) || 0) * 1000)} mL
              </small>
            </label>

            <label className="field">
              <span>Price (€) *</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={priceEuros}
                onChange={(e) => setPriceEuros(e.target.value)}
                required
              />
              {Number(volumeLitres) > 0 && Number(priceEuros) > 0 && (
                <small className="muted">
                  Unit price: {(Number(priceEuros) / Number(volumeLitres)).toFixed(2)} €/L
                </small>
              )}
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-6 p-3 bg-surface-muted rounded-xl border border-line">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <span>Package Active</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <span>⭐ Pre-select as Default Package</span>
            </label>
          </div>

          <div className="profile-actions justify-end gap-2 mt-2">
            <button className="btn btn-secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Saving…" : isEditing ? "Save package changes" : "Add package"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
