"use client";

import { useState } from "react";
import { AdminNotice, useAdminDialogFocus } from "../../presentation";
import { usePackageEditorController } from "./use-package-editor-controller";
import type { AdminProductPackage } from "../types/package";

export function PackageModal({
  productId,
  editingPackage,
  onClose,
  onSaved,
}: {
  productId: string;
  editingPackage?: AdminProductPackage | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(editingPackage);
  const dialogRef = useAdminDialogFocus(true, onClose);

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

  const { error, busy, handleSubmit } = usePackageEditorController({ productId, editingPackage, values: { labelFi, labelEn, volumeLitres, priceEuros, active, isDefault }, onClose, onSaved });

  return (
    <div className="admin-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="admin-dialog card max-w-lg w-full p-6 shadow-2xl rounded-2xl bg-surface border border-line" role="dialog" aria-modal="true" aria-labelledby="package-modal-title">
        <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
          <div>
            <p className="eyebrow">{isEditing ? "EDIT PACKAGE" : "NEW PACKAGE"}</p>
            <h2 id="package-modal-title" className="text-xl font-bold tracking-tight text-ink">
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
