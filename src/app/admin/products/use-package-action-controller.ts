"use client";

type PackageRow = { id: string; labelFi: string; labelEn: string; volumeMl: number; priceCents: number; active: boolean; isDefault: boolean };

export function usePackageActionController({ onRefresh, onError }: { onRefresh: () => void; onError: (message: string) => void }) {
  async function request(path: string, init: RequestInit, fallback: string) {
    try {
      const response = await fetch(path, init);
      const body = await response.json().catch(() => ({})) as { message?: string; code?: string };
      if (!response.ok) { onError(body.message ?? body.code ?? fallback); return false; }
      onRefresh();
      return true;
    } catch {
      onError("An unexpected network error occurred.");
      return false;
    }
  }

  function setDefault(packageId: string) {
    return request(`/api/admin/packages/${packageId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "default" }) }, "Could not set default package.");
  }

  function toggleActive(pkg: PackageRow) {
    return request(`/api/admin/packages/${pkg.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "update", package: { labelFi: pkg.labelFi, labelEn: pkg.labelEn, volumeMl: pkg.volumeMl, priceCents: pkg.priceCents, active: !pkg.active, isDefault: pkg.isDefault } }) }, "Could not update package status.");
  }

  function remove(packageId: string) {
    return request(`/api/admin/packages/${packageId}`, { method: "DELETE" }, "Could not delete package.");
  }

  function reorder(productId: string, packageIds: string[]) {
    return request(`/api/admin/products/${productId}/packages`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ packageIds }) }, "Could not reorder packages.");
  }

  return { setDefault, toggleActive, remove, reorder };
}
