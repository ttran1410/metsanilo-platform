"use client";

type PackageRow = { id: string; labelFi: string; labelEn: string; volumeMl: number; priceCents: number; active: boolean; isDefault: boolean };
import { deletePackage, reorderPackages, setPackageDefault, updatePackage } from "./package-admin-actions";

export function usePackageActionController({ onRefresh, onError }: { onRefresh: () => void; onError: (message: string) => void }) {
  async function request(action: () => Promise<unknown>, fallback: string) {
    try {
      await action();
      onRefresh();
      return true;
    } catch (error) {
      onError(error instanceof Error ? error.message : fallback);
      return false;
    }
  }

  function setDefault(packageId: string) {
    return request(() => setPackageDefault(packageId), "Could not set default package.");
  }

  function toggleActive(pkg: PackageRow) {
    return request(() => updatePackage({ packageId: pkg.id, package: { labelFi: pkg.labelFi, labelEn: pkg.labelEn, volumeMl: pkg.volumeMl, priceCents: pkg.priceCents, active: !pkg.active, isDefault: pkg.isDefault } }), "Could not update package status.");
  }

  function remove(packageId: string) {
    return request(() => deletePackage(packageId), "Could not delete package.");
  }

  function reorder(productId: string, packageIds: string[]) {
    return request(() => reorderPackages(productId, packageIds), "Could not reorder packages.");
  }

  return { setDefault, toggleActive, remove, reorder };
}
