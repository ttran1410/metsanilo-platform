"use client";

import { useState } from "react";
import { updateProduct } from "./product-admin-actions";
import type { ProductRow } from "../master-detail-workspace";

type ProductEditorValues = {
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

export function useProductEditorController({ selectedRow, values, setProductsList, setError, setMessage }: {
  selectedRow: ProductRow | undefined;
  values: ProductEditorValues;
  setProductsList: React.Dispatch<React.SetStateAction<ProductRow[]>>;
  setError: (message: string) => void;
  setMessage: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSaveChanges() {
    if (!selectedRow || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    const payload = {
      ...values,
      code: values.code.trim().toUpperCase(),
      slug: values.slug.trim().toLowerCase(),
      nameFi: values.nameFi.trim(),
      nameEn: values.nameEn.trim(),
      descriptionFi: values.descriptionFi.trim(),
      descriptionEn: values.descriptionEn.trim(),
    };
    try {
      const result = await updateProduct(selectedRow.product.id, payload);
      if (!result.ok) return setError(result.message ?? result.code ?? "Could not save product changes.");
      setProductsList((current) => current.map((item) => item.product.id === selectedRow.product.id ? result.data as ProductRow : item));
      setMessage(`Saved changes for ${payload.nameFi}.`);
    } catch {
      setError("Network error while saving product changes.");
    } finally {
      setSaving(false);
    }
  }

  return { saving, handleSaveChanges };
}
