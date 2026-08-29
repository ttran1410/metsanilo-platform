"use client";

import { useState, type FormEvent } from "react";
import type { AdminProductPackage } from "../types/package";

export function usePackageEditorController({ productId, editingPackage, values, onClose, onSaved }: { productId: string; editingPackage?: AdminProductPackage | null; values: { labelFi: string; labelEn: string; volumeLitres: string; priceEuros: string; active: boolean; isDefault: boolean }; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const litresNum = Number(values.volumeLitres); const eurosNum = Number(values.priceEuros);
    if (!values.labelFi.trim() || !values.labelEn.trim()) return setBusy(false), setError("Both Finnish and English package labels are required.");
    if (Number.isNaN(litresNum) || litresNum <= 0) return setBusy(false), setError("Package volume must be greater than 0 Litres.");
    if (Number.isNaN(eurosNum) || eurosNum < 0) return setBusy(false), setError("Package price must be 0 or greater.");
    const payload = { labelFi: values.labelFi.trim(), labelEn: values.labelEn.trim(), volumeMl: Math.round(litresNum * 1000), priceCents: Math.round(eurosNum * 100), active: values.active, isDefault: values.isDefault };
    try {
      const response = await fetch(editingPackage ? `/api/admin/packages/${editingPackage.id}` : `/api/admin/products/${productId}/packages`, { method: editingPackage ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(editingPackage ? { action: "update", package: payload } : payload) });
      const body = await response.json();
      if (!response.ok) return setError(body.message ?? body.code ?? "Could not save package.");
      onSaved(); onClose();
    } catch { setError("An unexpected network error occurred."); }
    finally { setBusy(false); }
  }

  return { error, busy, handleSubmit };
}
