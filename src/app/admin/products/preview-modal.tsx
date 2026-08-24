"use client";

import { useState } from "react";
import type { packages, products } from "@/db/schema";
import { AdminStatusBadge, useAdminDialogFocus } from "../presentation";

type ProductRow = {
  product: typeof products.$inferSelect;
  packages: Array<typeof packages.$inferSelect>;
  media?: Array<{ id: string; attachmentId?: string; url: string; altFi: string; altEn: string; isPrimary: boolean }>;
};

export function ProductPreviewModal({ row, onClose }: { row: ProductRow; onClose: () => void }) {
  const dialogRef = useAdminDialogFocus(true, onClose);
  const activePackages = row.packages
    .filter((pkg) => pkg.active)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.sortOrder - b.sortOrder);

  const [selectedPkgId, setSelectedPkgId] = useState(
    activePackages.find((pkg) => pkg.isDefault)?.id ?? activePackages[0]?.id ?? ""
  );

  const selectedPackage = activePackages.find((pkg) => pkg.id === selectedPkgId) ?? activePackages[0];
  const primaryMedia = row.media?.find((img) => img.isPrimary) ?? row.media?.[0];

  return (
    <div className="admin-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="admin-dialog card max-w-md w-full p-0 overflow-hidden shadow-2xl rounded-2xl bg-surface border border-line" role="dialog" aria-modal="true" aria-labelledby="product-preview-title">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-line bg-surface-muted">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted">LIVE STOREFRONT PREVIEW</span>
            <h3 id="product-preview-title" className="text-sm font-semibold text-ink">Customer View</h3>
          </div>
          <button type="button" className="btn btn-secondary text-xs py-1 px-2.5" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        {/* Storefront Card Mockup */}
        <div className="p-5 flex flex-col gap-4">
          {/* Media Header */}
          <div className="relative rounded-xl overflow-hidden bg-surface-muted border border-line aspect-[4/3] flex items-center justify-center">
            {primaryMedia ? (
              <img src={primaryMedia.url} alt={primaryMedia.altFi || row.product.nameFi} className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-6 muted">
                <span className="text-3xl block mb-1">🫐</span>
                <span className="text-xs font-medium">No media uploaded</span>
              </div>
            )}
            <div className="absolute top-3 right-3">
              <AdminStatusBadge status={row.product.active ? "CONFIRMED" : "CANCELLED"} label={row.product.active ? "Active" : "Archived"} />
            </div>
          </div>

          {/* Product Header */}
          <div>
            <small className="text-xs font-semibold text-primary uppercase tracking-wider block mb-1">
              Harvest Window: {row.product.availableFrom} – {row.product.availableThrough}
            </small>
            <h2 className="text-2xl font-bold tracking-tight text-ink">{row.product.nameFi}</h2>
            <p className="text-xs text-muted font-medium mt-0.5">{row.product.nameEn} · Code: {row.product.code}</p>
          </div>

          {/* Description */}
          {row.product.descriptionFi && (
            <p className="text-sm text-ink/80 leading-relaxed bg-surface-muted/50 p-3 rounded-lg border border-line/60">
              {row.product.descriptionFi}
            </p>
          )}

          {/* Package Selector */}
          <div>
            <label className="text-xs font-bold uppercase text-muted block mb-2">Select Package Option</label>
            <div className="flex flex-col gap-2">
              {activePackages.map((pkg) => {
                const isSelected = pkg.id === selectedPkgId;
                const priceEuros = (pkg.priceCents / 100).toFixed(2);
                const volumeLitres = (pkg.volumeMl / 1000).toLocaleString("fi-FI");
                const unitPricePerLitre = (pkg.priceCents / pkg.volumeMl * 1000 / 100).toFixed(2);

                return (
                  <button
                    key={pkg.id}
                    type="button"
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary font-medium"
                        : "border-line bg-surface hover:border-muted"
                    }`}
                    onClick={() => setSelectedPkgId(pkg.id)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-ink">{pkg.labelFi}</span>
                        {pkg.isDefault && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            ⭐ Pre-selected
                          </span>
                        )}
                      </div>
                      <span className="text-xs muted block">
                        {volumeLitres} L · {unitPricePerLitre} €/L
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-bold text-primary">{priceEuros} €</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Simulated CTA Button */}
          {selectedPackage && (
            <div className="pt-2 border-t border-line mt-1">
              <button type="button" className="btn w-full justify-center py-3 text-base font-bold shadow-md cursor-not-allowed opacity-95">
                Reserve {selectedPackage.labelFi} · {(selectedPackage.priceCents / 100).toFixed(2)} € ↗
              </button>
              <p className="text-[11px] text-center muted mt-2">
                This is an interactive preview of the customer reservation experience.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
