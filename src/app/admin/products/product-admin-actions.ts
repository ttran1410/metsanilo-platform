"use client";

export type ProductActionResult<T = unknown> = { ok: boolean; status: number; data?: T; code?: string; message?: string };

async function requestProduct<T>(productId: string, init: RequestInit): Promise<ProductActionResult<T>> {
  const response = await fetch(`/api/admin/products/${productId}`, init);
  const body = await response.json().catch(() => ({})) as { data?: T; code?: string; message?: string };
  return { ok: response.ok, status: response.status, data: body.data, code: body.code, message: body.message };
}

export function archiveProduct(productId: string) { return requestProduct(productId, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "active", active: false }) }); }
export function restoreProduct(productId: string) { return requestProduct(productId, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "active", active: true }) }); }
export function deleteProduct(productId: string) { return requestProduct(productId, { method: "DELETE" }); }
