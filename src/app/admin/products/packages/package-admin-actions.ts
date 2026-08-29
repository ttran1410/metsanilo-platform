import type { AdminProductPackage } from "../types/package";

export type PackageUpdateCommand = {
  packageId: string;
  package: Pick<AdminProductPackage, "labelFi" | "labelEn" | "volumeMl" | "priceCents" | "active" | "isDefault">;
};

async function requestPackage(path: string, init: RequestInit) {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => ({})) as { data?: unknown; message?: string; code?: string };
  if (!response.ok) throw new Error(body.message ?? body.code ?? "Package action failed.");
  return body.data;
}

export function setPackageDefault(packageId: string) {
  return requestPackage(`/api/admin/packages/${packageId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "default" }) });
}

export function updatePackage(command: PackageUpdateCommand) {
  return requestPackage(`/api/admin/packages/${command.packageId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "update", package: command.package }) });
}

export function deletePackage(packageId: string) {
  return requestPackage(`/api/admin/packages/${packageId}`, { method: "DELETE" });
}

export function reorderPackages(productId: string, packageIds: string[]) {
  return requestPackage(`/api/admin/products/${productId}/packages`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ packageIds }) });
}

export function createPackage(productId: string, packageInput: PackageUpdateCommand["package"]) {
  return requestPackage(`/api/admin/products/${productId}/packages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(packageInput) });
}
