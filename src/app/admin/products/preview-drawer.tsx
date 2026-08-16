"use client";

import { useState } from "react";
import type { packages, products } from "@/db/schema";
import { AdminStatusBadge } from "../presentation";


type ProductRow = {
  product: typeof products.$inferSelect;
  packages: Array<typeof packages.$inferSelect>;
  media?: Array<{ id: string; attachmentId?: string; url: string; altFi: string; altEn: string; isPrimary: boolean }>;
};

export function PreviewDrawer({
  row,
  onClose,
}: {
  row: ProductRow;
  onClose: () => void;
}) {
  const activePackages = row.packages
    .filter((pkg) => pkg.active)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.sortOrder - b.sortOrder);

  const [selectedPkgId, setSelectedPkgId] = useState(
    activePackages.find((pkg) => pkg.isDefault)?.id ?? activePackages[0]?.id ?? ""
  );

  const selectedPackage = activePackages.find((pkg) => pkg.id === selectedPkgId) ?? activePackages[0];
  const primaryMedia = row.media?.find((img) => img.isPrimary) ?? row.media?.[0];

  return (
    <div
      className="fixed inset-0 bg-ink/50 backdrop-blur-xs z-50 flex justify-end transition-opacity"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside className="w-full max-w-md bg-surface h-full shadow-2xl flex flex-col justify-between overflow-y-auto border-l border-line animate-in slide-in-from-right">
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-line bg-surface-muted sticky top-0 z-10">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted">LIVE STOREFRONT PREVIEW</span>
            <h3 className="text-sm font-semibold text-ink">Mobile Reservation View</h3>
          </div>
          <button type="button" className="btn btn-secondary text-xs py-1 px-2.5" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        {/* Customer Smartphone Screen Mockup */}
        <div className="p-5 flex flex-col gap-4 flex-1">
          {/* Media Header */}
          <div className="relative rounded-2xl overflow-hidden bg-surface-muted border border-line aspect-[4/3] flex items-center justify-center shadow-inner">
            {primaryMedia ? (
              <img src={primaryMedia.url} alt={primaryMedia.altFi || row.product.nameFi} className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-6 muted">
                <span className="text-4xl block mb-1">🫐</span>
                <span className="text-xs font-medium">No media uploaded</span>
              </div>
            )}
            <div className="absolute top-3 right-3">
              <AdminStatusBadge status={row.product.active ? "CONFIRMED" : "CANCELLED"} label={row.product.active ? "Active" : "Archived"} />
            </div>
          </div>

          {/* Product Header */}
          <div>
            <small className="text-xs font-bold text-primary uppercase tracking-wider block mb-1">
              📅 Harvest Window: {row.product.availableFrom} – {row.product.availableThrough}
            </small>
            <h2 className="text-2xl font-bold tracking-tight text-ink">{row.product.nameFi}</h2>
            <p className="text-xs text-muted font-medium mt-0.5">{row.product.nameEn} · Code: {row.product.code}</p>
          </div>

          {/* Description */}
          {row.product.descriptionFi && (
            <p className="text-sm text-ink/80 leading-relaxed bg-surface-muted/50 p-3.5 rounded-xl border border-line/60">
              {row.product.descriptionFi}
            </p>
          )}

          {/* Package Options Picker */}
          <div>
            <label className="text-xs font-bold uppercase text-muted block mb-2">Select Packaging Option</label>
            <div className="flex flex-col gap-2.5">
              {activePackages.map((pkg) => {
                const isSelected = pkg.id === selectedPkgId;
                const priceEuros = (pkg.priceCents / 100).toFixed(2);
                const volumeLitres = (pkg.volumeMl / 1000).toLocaleString("fi-FI");
                const unitPricePerLitre = (pkg.priceCents / pkg.volumeMl * 1000 / 100).toFixed(2);

                return (
                  <button
                    key={pkg.id}
                    type="button"
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-sm"
                        : "border-line bg-surface hover:border-muted"
                    }`}
                    onClick={() => setSelectedPkgId(pkg.id)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-ink">{pkg.labelFi}</span>
                        {pkg.isDefault && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            ⭐ Pre-selected
                          </span>
                        )}
                      </div>
                      <span className="text-xs muted block mt-0.5">
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

          {/* Simulated Reserve Button */}
          {selectedPackage && (
            <div className="pt-3 border-t border-line mt-auto">
              <button type="button" className="btn w-full justify-center py-3.5 text-base font-bold shadow-lg cursor-not-allowed opacity-95">
                Reserve {selectedPackage.labelFi} · {(selectedPackage.priceCents / 100).toFixed(2)} € ↗
              </button>
              <p className="text-[11px] text-center muted mt-2">
                This is a real-time preview of the mobile customer reservation experience.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
