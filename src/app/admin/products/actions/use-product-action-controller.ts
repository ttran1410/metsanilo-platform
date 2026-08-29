"use client";

import { archiveProduct, deleteProduct, reorderProducts, restoreProduct } from "./product-admin-actions";
import type { ProductRow } from "../master-detail-workspace";

type ProductActionControllerOptions = {
  productsList: ProductRow[];
  selectedRow: ProductRow | undefined;
  setProductsList: React.Dispatch<React.SetStateAction<ProductRow[]>>;
  setActive: (active: boolean) => void;
  selectProduct: (row: ProductRow) => void;
  setError: (message: string) => void;
  setMessage: (message: string) => void;
};

export function useProductActionController({
  productsList,
  selectedRow,
  setProductsList,
  setActive,
  selectProduct,
  setError,
  setMessage,
}: ProductActionControllerOptions) {
  async function handleMoveProduct(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= productsList.length) return;
    const next = [...productsList];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setProductsList(next);
    const result = await reorderProducts(next.map((item) => item.product.id));
    if (!result.ok) setError("Could not save product order.");
    else setMessage("Product display order updated.");
  }

  async function handleToggleActive(targetActive: boolean) {
    if (!selectedRow) return;
    setError("");
    setMessage("");
    const result = targetActive ? await restoreProduct(selectedRow.product.id) : await archiveProduct(selectedRow.product.id);
    if (!result.ok) return setError(result.message ?? "Could not update product active status.");
    setActive(targetActive);
    setProductsList((current) => current.map((item) => item.product.id === selectedRow.product.id ? result.data as ProductRow : item));
    setMessage(targetActive ? `${selectedRow.product.nameFi} is now active.` : `${selectedRow.product.nameFi} has been archived.`);
  }

  async function handleDeleteOrArchive() {
    if (!selectedRow) return;
    setError("");
    setMessage("");
    const result = await deleteProduct(selectedRow.product.id);
    if (!result.ok) {
      if (result.code === "PRODUCT_IN_USE" || result.status === 409) {
        const archiveResult = await archiveProduct(selectedRow.product.id);
        if (archiveResult.ok) {
          setActive(false);
          setProductsList((current) => current.map((item) => item.product.id === selectedRow.product.id ? archiveResult.data as ProductRow : item));
          return setMessage("Product has historical orders and was safely archived instead of deleted.");
        }
      }
      return setError(result.message ?? "Could not delete or archive product.");
    }
    const nextList = productsList.filter((item) => item.product.id !== selectedRow.product.id);
    setProductsList(nextList);
    if (nextList[0]) selectProduct(nextList[0]);
    setMessage("Product deleted.");
  }

  return { handleMoveProduct, handleToggleActive, handleDeleteOrArchive };
}
