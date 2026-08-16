"use client";

import { useMemo, useState } from "react";
import type { packages } from "@/db/schema";
import { PackageModal } from "./package-modal";

type PackageRow = typeof packages.$inferSelect;

export function PricingLadder({
  productId,
  packagesList,
  canEdit,
  onRefresh,
}: {
  productId: string;
  packagesList: PackageRow[];
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sortedPackages = useMemo(() => {
    return [...packagesList].sort((a, b) => a.sortOrder - b.sortOrder || a.volumeMl - b.volumeMl);
  }, [packagesList]);

  // Find smallest active package unit price for bulk savings comparison
  const baseUnitPrice = useMemo(() => {
    const activePkgs = sortedPackages.filter((p) => p.active);
    if (!activePkgs.length) return null;
    const smallest = activePkgs.reduce((min, curr) => (curr.volumeMl < min.volumeMl ? curr : min), activePkgs[0]);
    return smallest.priceCents / smallest.volumeMl;
  }, [sortedPackages]);

  async function setDefaultPkg(id: string) {
    setError("");
    setNotice("");
    const response = await fetch(`/api/admin/packages/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "default" }),
    });
    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Could not set default package.");
    setNotice("Default package updated.");
    onRefresh();
  }

  async function toggleActive(pkg: PackageRow) {
    setError("");
    setNotice("");
    const response = await fetch(`/api/admin/packages/${pkg.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "update",
        package: {
          labelFi: pkg.labelFi,
          labelEn: pkg.labelEn,
          volumeMl: pkg.volumeMl,
          priceCents: pkg.priceCents,
          active: !pkg.active,
          isDefault: pkg.isDefault,
        },
      }),
    });
    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Could not update package status.");
    setNotice(pkg.active ? "Package archived." : "Package activated.");
    onRefresh();
  }

  async function deletePackage(id: string) {
    setError("");
    setNotice("");
    const response = await fetch(`/api/admin/packages/${id}`, { method: "DELETE" });
    const body = await response.json();
    setDeletingId(null);
    if (!response.ok) return setError(body.message ?? body.code ?? "Could not delete package.");
    setNotice("Package deleted.");
    onRefresh();
  }

  async function reorder(packageIds: string[]) {
    setError("");
    const response = await fetch(`/api/admin/products/${productId}/packages`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packageIds }),
    });
    if (!response.ok) return setError("Could not reorder packages.");
    onRefresh();
  }

  function shiftPackage(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= sortedPackages.length) return;
    const next = [...sortedPackages];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    void reorder(next.map((p) => p.id));
  }

  return (
    <div className="card p-4 md:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <span className="eyebrow">UNIT ECONOMICS &amp; PACKAGING LADDER</span>
          <h3 className="text-base font-bold text-ink">Packages &amp; Pricing Matrix</h3>
          <p className="text-xs muted">
            Prices are displayed in Euros (€) and unit price per Litre (€/L) is computed automatically.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            className="btn text-xs py-1.5 px-3 flex items-center gap-1"
            onClick={() => {
              setEditingPkg(null);
              setShowModal(true);
            }}
          >
            ＋ Add Package
          </button>
        )}
      </div>

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      {notice && <p className="text-xs font-semibold text-emerald-700">{notice}</p>}

      {/* Packages Table Matrix */}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-muted border-b border-line text-muted uppercase font-bold text-[11px] tracking-wider">
            <tr>
              <th className="p-3 w-10 text-center">Order</th>
              <th className="p-3">Package Container</th>
              <th className="p-3">Volume</th>
              <th className="p-3 text-right">Price (€)</th>
              <th className="p-3 text-right">Unit Price (€/L)</th>
              <th className="p-3">Savings Callout</th>
              <th className="p-3 text-center">Default</th>
              <th className="p-3 text-center">Status</th>
              {canEdit && <th className="p-3 text-right">Actions</th>}
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {sortedPackages.map((pkg, index) => {
              const litres = pkg.volumeMl / 1000;
              const euros = (pkg.priceCents / 100).toFixed(2);
              const unitPrice = pkg.priceCents / pkg.volumeMl;
              const unitPricePerLitreStr = (unitPrice * 1000 / 100).toFixed(2);

              // Calculate savings percentage relative to base unit price
              let savingsPercent = 0;
              if (baseUnitPrice && baseUnitPrice > unitPrice) {
                savingsPercent = Math.round(((baseUnitPrice - unitPrice) / baseUnitPrice) * 100);
              }

              return (
                <tr
                  key={pkg.id}
                  className={`hover:bg-surface-muted/50 transition-colors ${
                    pkg.isDefault ? "bg-amber-50/40 font-medium" : ""
                  }`}
                >
                  {/* Shift Reorder Controls */}
                  <td className="p-3 text-center">
                    {canEdit && sortedPackages.length > 1 && (
                      <div className="inline-flex flex-col gap-0.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => shiftPackage(index, -1)}
                          className="hover:text-primary disabled:opacity-30 text-[10px]"
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={index === sortedPackages.length - 1}
                          onClick={() => shiftPackage(index, 1)}
                          className="hover:text-primary disabled:opacity-30 text-[10px]"
                          title="Move down"
                        >
                          ▼
                        </button>
                      </div>
                    )}
                  </td>

                  {/* Package Label */}
                  <td className="p-3">
                    <strong className="text-ink font-bold text-sm block">{pkg.labelFi}</strong>
                    <span className="muted text-xs block">{pkg.labelEn}</span>
                  </td>

                  {/* Volume */}
                  <td className="p-3 ops-tabular">
                    <span className="font-semibold text-ink">{litres.toLocaleString("fi-FI")} L</span>
                    <span className="muted block text-[11px]">{pkg.volumeMl} mL</span>
                  </td>

                  {/* Price (€) */}
                  <td className="p-3 text-right font-bold text-primary text-sm ops-tabular">
                    {euros} €
                  </td>

                  {/* Unit Price (€/L) */}
                  <td className="p-3 text-right font-medium text-ink/80 ops-tabular">
                    {unitPricePerLitreStr} € / L
                  </td>

                  {/* Savings Callout */}
                  <td className="p-3">
                    {savingsPercent > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                        🏷️ -{savingsPercent}% / L cheaper
                      </span>
                    ) : (
                      <span className="muted text-[11px]">—</span>
                    )}
                  </td>

                  {/* Default Radio Selector */}
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      className={`text-base transition-transform ${pkg.isDefault ? "scale-125" : "opacity-30 hover:opacity-100"}`}
                      onClick={() => canEdit && !pkg.isDefault && void setDefaultPkg(pkg.id)}
                      title={pkg.isDefault ? "Current Default Package" : "Set as Default Package"}
                    >
                      {pkg.isDefault ? "⭐" : "☆"}
                    </button>
                  </td>

                  {/* Active Status */}
                  <td className="p-3 text-center">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      pkg.active ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-surface-muted text-muted border-line"
                    }`}>
                      {pkg.active ? "Active" : "Archived"}
                    </span>
                  </td>

                  {/* Actions */}
                  {canEdit && (
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary text-xs py-1 px-2"
                          onClick={() => {
                            setEditingPkg(pkg);
                            setShowModal(true);
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          className="text-button text-xs"
                          onClick={() => void toggleActive(pkg)}
                        >
                          {pkg.active ? "Archive" : "Activate"}
                        </button>
                        <button
                          type="button"
                          className="text-button text-xs text-danger"
                          onClick={() => setDeletingId(pkg.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Package Edit/Add Modal */}
      {showModal && (
        <PackageModal
          productId={productId}
          editingPackage={editingPkg}
          onClose={() => {
            setShowModal(false);
            setEditingPkg(null);
          }}
          onSaved={onRefresh}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="admin-dialog-backdrop">
          <div className="admin-dialog card max-w-sm w-full p-5 flex flex-col gap-3">
            <p className="eyebrow text-danger">CONFIRM DELETE</p>
            <h3 className="text-lg font-bold text-ink">Delete Package?</h3>
            <p className="text-xs muted">
              Are you sure you want to delete this package? If the package is referenced by existing orders, it cannot be deleted and should be archived instead.
            </p>
            <div className="profile-actions justify-end gap-2 mt-2">
              <button className="btn btn-secondary text-xs" type="button" onClick={() => setDeletingId(null)}>
                Cancel
              </button>
              <button className="btn btn-danger text-xs" type="button" onClick={() => void deletePackage(deletingId)}>
                Delete Package
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
