"use client";

export type AdminOrderSourceOption = { key: string; labelEn: string; active: boolean };

let orderSourcesPromise: Promise<AdminOrderSourceOption[] | null> | null = null;
let orderSourcesFetchedAt = 0;

export function getAdminOrderSources() {
  const now = Date.now();
  if (orderSourcesPromise && now - orderSourcesFetchedAt < 15_000) return orderSourcesPromise;
  orderSourcesFetchedAt = now;
  orderSourcesPromise = fetch("/api/admin/order-sources", { cache: "no-store", headers: { "x-admin-request-scope": "reference-order-sources" } })
    .then(async (response) => { if (!response.ok) return null; const body = await response.json(); return Array.isArray(body.data) ? body.data as AdminOrderSourceOption[] : null; })
    .catch(() => null);
  return orderSourcesPromise;
}
