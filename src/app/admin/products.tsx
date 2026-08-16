"use client";

import { useMemo, useState } from "react";
import type { packages, products } from "@/db/schema";
import { AdminEmptyState, AdminNotice, AdminPageHeader, AdminStatusBadge } from "./presentation";
import { ProductPreviewModal } from "./products/preview-modal";

type ProductRow = {
  product: typeof products.$inferSelect;
  packages: Array<typeof packages.$inferSelect>;
  media?: Array<{ id: string; attachmentId?: string; url: string; altFi: string; altEn: string; isPrimary: boolean }>;
};

type FilterTab = "all" | "active" | "homepage" | "reserve" | "archived";

export function ProductModule({
  initialProducts,
  canManageProducts,
}: {
  initialProducts: ProductRow[];
  canManageProducts: boolean;
}) {
  const [rows, setRows] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [message, setMessage] = useState("");
  const [previewRow, setPreviewRow] = useState<ProductRow | null>(null);

  const metrics = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((r) => r.product.active).length,
      homepage: rows.filter((r) => r.product.showOnHomepage).length,
      reserve: rows.filter((r) => r.product.showOnReserve).length,
      archived: rows.filter((r) => !r.product.active).length,
    };
  }, [rows]);

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      const text = `${row.product.nameFi} ${row.product.nameEn} ${row.product.code}`.toLowerCase();
      const matchesQuery = !query || text.includes(query.toLowerCase());

      let matchesTab = true;
      if (activeTab === "active") matchesTab = row.product.active;
      else if (activeTab === "homepage") matchesTab = row.product.showOnHomepage;
      else if (activeTab === "reserve") matchesTab = row.product.showOnReserve;
      else if (activeTab === "archived") matchesTab = !row.product.active;

      return matchesQuery && matchesTab;
    });
  }, [rows, query, activeTab]);

  async function toggle(row: ProductRow) {
    const response = await fetch(`/api/admin/products/${row.product.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "active", active: !row.product.active }),
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? "Could not change product status.");
    setRows((current) => current.map((item) => (item.product.id === row.product.id ? body.data : item)));
    setMessage(row.product.active ? "Product archived." : "Product activated.");
  }

  return (
    <section className="shell pb-10">
      <AdminPageHeader
        eyebrow="CATALOG"
        title="Product catalog"
        description="Manage berries, juice packages, media assets, storefront publishing, and harvest window availability."
        actions={canManageProducts ? <a className="btn" href="/admin/products/new">＋ New product</a> : undefined}
      />

      {message && <AdminNotice tone="success" live>{message}</AdminNotice>}

      {/* Catalog Metric Cards Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        <div className="card p-3 flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider muted">Total Catalog</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-ink ops-tabular">{metrics.total}</span>
            <span className="text-xs text-muted">products</span>
          </div>
        </div>

        <div className="card p-3 flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Active Products</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-emerald-700 ops-tabular">{metrics.active}</span>
            <span className="text-xs text-emerald-600 font-medium">ready to order</span>
          </div>
        </div>

        <div className="card p-3 flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Storefront Featured</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-blue-700 ops-tabular">{metrics.homepage}</span>
            <span className="text-xs text-blue-600 font-medium">visible on home</span>
          </div>
        </div>

        <div className="card p-3 flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Reserve Portal</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-purple-700 ops-tabular">{metrics.reserve}</span>
            <span className="text-xs text-purple-600 font-medium">harvest reservations</span>
          </div>
        </div>
      </div>

      {/* Toolbar & Filter Tabs */}
      <div className="card mt-4 p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Filter Tabs */}
          <nav className="flex items-center gap-1 overflow-x-auto pb-1" aria-label="Catalog Filters">
            {[
              { key: "all", label: `All (${metrics.total})` },
              { key: "active", label: `Active (${metrics.active})` },
              { key: "homepage", label: `Storefront (${metrics.homepage})` },
              { key: "reserve", label: `Reserve (${metrics.reserve})` },
              { key: "archived", label: `Archived (${metrics.archived})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-primary text-on-primary shadow-sm"
                    : "bg-surface-muted text-ink/70 hover:bg-surface-muted/80 hover:text-ink"
                }`}
                onClick={() => setActiveTab(tab.key as FilterTab)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Search Input */}
          <div className="w-full md:w-auto flex-1 max-w-xs">
            <input
              aria-label="Search products"
              placeholder="Search by product name or code…"
              className="w-full text-xs py-1.5 px-3 rounded-lg border border-line bg-surface"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* High-Density Redesigned Product Cards Grid */}
      <div className="grid gap-3 mt-3">
        {visibleRows.map((row) => {
          const primaryImage = row.media?.find((img) => img.isPrimary) ?? row.media?.[0];
          const activePackages = row.packages.filter((pkg) => pkg.active);
          const defaultPackage = row.packages.find((pkg) => pkg.isDefault);

          return (
            <article key={row.product.id} className="card p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:border-muted transition-colors">
              {/* Product Thumbnail & Core Info */}
              <div className="flex items-start md:items-center gap-4 flex-1">
                {/* Thumbnail Image (Compact Square Crop) */}
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-surface-muted border border-line shrink-0 flex items-center justify-center relative">
                  {primaryImage ? (
                    <img src={primaryImage.url} alt={primaryImage.altFi || row.product.nameFi} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-2 muted">
                      <span className="text-xl block">🫐</span>
                    </div>
                  )}
                  {row.media && row.media.length > 1 && (
                    <span className="absolute bottom-1 right-1 text-[10px] font-bold px-1 rounded bg-ink/70 text-on-primary">
                      +{row.media.length - 1}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold tracking-tight text-ink">{row.product.nameFi}</h2>
                    <AdminStatusBadge status={row.product.active ? "CONFIRMED" : "CANCELLED"} label={row.product.active ? "Active" : "Archived"} />
                    <span className="text-xs px-2 py-0.5 rounded bg-surface-muted border border-line font-medium text-ink/80 ops-tabular">
                      Code: {row.product.code}
                    </span>
                  </div>

                  <p className="text-xs muted flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>{row.product.nameEn}</span>
                    <span>•</span>
                    <span>Available: <strong>{row.product.availableFrom} – {row.product.availableThrough}</strong></span>
                  </p>

                  {/* Channel Visibility & Package Summary Pills */}
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${row.product.showOnHomepage ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-surface-muted text-muted border-line"}`}>
                      🌐 Storefront {row.product.showOnHomepage ? "On" : "Off"}
                    </span>

                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${row.product.showOnReserve ? "bg-purple-50 text-purple-800 border-purple-200" : "bg-surface-muted text-muted border-line"}`}>
                      📝 Reserve {row.product.showOnReserve ? "On" : "Off"}
                    </span>

                    {/* Active Packages List Chips */}
                    {activePackages.map((pkg) => (
                      <span
                        key={pkg.id}
                        className={`text-[11px] px-2 py-0.5 rounded-lg border font-medium ${
                          pkg.isDefault
                            ? "bg-amber-50 text-amber-900 border-amber-300 font-bold"
                            : "bg-surface text-ink border-line"
                        }`}
                        title={`${(pkg.priceCents / pkg.volumeMl * 1000 / 100).toFixed(2)} €/L`}
                      >
                        {pkg.isDefault ? "⭐ " : ""}{pkg.labelFi} ({(pkg.priceCents / 100).toFixed(2)} €)
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 self-stretch md:self-center justify-end shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-line">
                <a className="btn text-xs py-1.5 px-3" href={`/admin/products/${row.product.id}`}>
                  View detail ↗
                </a>

                {canManageProducts && (
                  <a className="btn btn-secondary text-xs py-1.5 px-3" href={`/admin/products/${row.product.id}/edit`}>
                    Edit ✏️
                  </a>
                )}

                <button className="btn btn-secondary text-xs py-1.5 px-3" type="button" onClick={() => setPreviewRow(row)}>
                  Preview 👁️
                </button>

                {canManageProducts && (
                  <button className="btn btn-secondary text-xs py-1.5 px-3" type="button" onClick={() => void toggle(row)}>
                    {row.product.active ? "Archive" : "Activate"}
                  </button>
                )}
              </div>
            </article>
          );
        })}

        {visibleRows.length === 0 && (
          <AdminEmptyState
            title="No products found"
            description="Adjust your search term or quick filter tabs."
          />
        )}
      </div>

      {/* Live Storefront Interactive Modal */}
      {previewRow && (
        <ProductPreviewModal row={previewRow} onClose={() => setPreviewRow(null)} />
      )}
    </section>
  );
}
