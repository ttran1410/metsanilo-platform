"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import Link from "next/link";
import { AdminNotice, AdminStatusBadge } from "../../presentation";
import { PackageModal } from "../packages/package-modal";
import { ProductPreviewModal } from "../preview-modal";
import { useProductMediaActionController } from "../media/use-product-media-action-controller";
import { usePackageActionController } from "../packages/use-package-action-controller";
import type { AdminProductMedia } from "../types/media";

import type { packages, products } from "@/db/schema";

type Product = {
  product: typeof products.$inferSelect;
  packages: Array<typeof packages.$inferSelect>;
  media: Array<AdminProductMedia & { attachmentId: string }>;
};


type AvailabilityRow = {
  id: string;
  businessDate: string;
  capacityMl: number;
  reservedMl: number;
  acceptsOrders: boolean;
  manualSoldOut: boolean;
};

export function ProductDetailView({
  initial,
  availabilityRows,
  productId,
  loadInitialFromApi = false,
  canEdit,
  canMedia,
}: {
  initial?: Product & { impact?: { activeOrders: number; availabilityRows: number } };
  availabilityRows?: AvailabilityRow[];
  productId?: string;
  loadInitialFromApi?: boolean;
  canEdit: boolean;
  canMedia: boolean;
}) {
  const [product, setProduct] = useState<Product>(initial as Product);
  const [loadedAvailabilityRows, setLoadedAvailabilityRows] = useState(availabilityRows);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [altEditing, setAltEditing] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPkg, setEditingPkg] = useState<Product["packages"][number] | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [deletingPkgId, setDeletingPkgId] = useState<string | null>(null);
  const mediaActions = useProductMediaActionController({ onError: setError });
  const packageActions = usePackageActionController({ onRefresh: refreshProduct, onError: setError });
  const detailRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!loadInitialFromApi || !productId) return;
    detailRequestRef.current?.abort();
    const controller = new AbortController();
    detailRequestRef.current = controller;
    fetch(`/api/admin/products/${productId}`, { cache: "no-store", signal: controller.signal, headers: { "x-admin-request-scope": "product-detail" } })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => { if (body?.data?.product) { setProduct(body.data); setLoadedAvailabilityRows(body.data.availabilityRows ?? []); } else setError("Product not found."); })
      .catch((reason) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError("Could not load product."); });
    return () => controller.abort();
  }, [loadInitialFromApi, productId]);

  if (!initial && !productId) return <div className="card" role="status">Product not found.</div>;
  if (!loadedAvailabilityRows || !product?.product) return <div className="card" role="status">Loading product...</div>;
  const currentAvailabilityRows = loadedAvailabilityRows;

  async function refreshProduct() {
    try {
      const response = await fetch(`/api/admin/products/${product.product.id}`);
      const body = await response.json();
      if (response.ok && body.data) {
        setProduct(body.data);
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  }

  // Set Default Package
  async function setDefaultPkg(id: string) {
    setError("");
    if (!await packageActions.setDefault(id)) return;
    setMessage("Default package updated.");
  }

  // Toggle Package Active Status
  async function togglePkgActive(pkg: Product["packages"][number]) {
    setError("");
    if (!await packageActions.toggleActive(pkg)) return;
    setMessage(pkg.active ? "Package archived." : "Package activated.");
  }

  // Delete Package
  async function handleDeletePkg(id: string) {
    setError("");
    if (!await packageActions.remove(id)) return;
    setDeletingPkgId(null);
    setMessage("Package deleted.");
  }

  // Save Media Alt Text
  async function saveAlt(event: FormEvent<HTMLFormElement>, image: Product["media"][number]) {
    event.preventDefault();
    setError("");
    const values = new FormData(event.currentTarget);
    const result = await mediaActions.saveMetadata(image.attachmentId, values.get("altFi"), values.get("altEn"));
    if (!result.ok) return;
    setProduct((current) => ({
      ...current,
      media: current.media.map((item) =>
        item.attachmentId === image.attachmentId ? { ...item, altFi: String(values.get("altFi") ?? ""), altEn: String(values.get("altEn") ?? "") } : item
      ),
    }));
    setAltEditing(null);
    setMessage("Image alt text updated.");
  }

  // Make Primary Media Image
  async function makePrimary(image: Product["media"][number]) {
    setError("");
    const result = await mediaActions.setPrimary(image.attachmentId);
    if (!result.ok) return;
    setProduct((current) => ({
      ...current,
      media: current.media.map((item) => ({ ...item, isPrimary: item.attachmentId === image.attachmentId })),
    }));
    setMessage("Primary image updated.");
  }

  // Delete Media Asset
  async function deleteMedia(attachmentId: string) {
    setError("");
    const result = await mediaActions.remove(attachmentId);
    if (!result.ok) return;
    setProduct((current) => ({
      ...current,
      media: current.media.filter((item) => item.attachmentId !== attachmentId),
    }));
    setMessage("Image deleted.");
  }

  // Reorder Media
  async function reorderMedia(ordered: Product["media"]) {
    setError("");
    const firstId = ordered[0]?.attachmentId;
    if (!firstId) return;
    const result = await mediaActions.reorder(firstId, ordered.map((item) => item.attachmentId));
    if (!result.ok) return;
    setProduct((current) => ({ ...current, media: ordered }));
    setMessage("Gallery order updated.");
  }

  function shiftMedia(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= product.media.length) return;
    const next = [...product.media];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    void reorderMedia(next);
  }

  function dropImage(event: DragEvent<HTMLElement>, target: Product["media"][number]) {
    event.preventDefault();
    if (!dragging || dragging === target.attachmentId) return;
    const next = [...product.media];
    const from = next.findIndex((item) => item.attachmentId === dragging);
    const to = next.findIndex((item) => item.attachmentId === target.attachmentId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragging(null);
    void reorderMedia(next);
  }

  async function upload(event: FormEvent<HTMLFormElement>, dropped?: File) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const file = dropped ?? (data.get("file") as File | null);
    if (!file || !file.size) return setError("Choose an image first.");
    data.set("file", file);
    data.set("productId", product.product.id);
    const result = await mediaActions.upload(data);
    if (!result.ok) return;
    setMessage("Image uploaded successfully.");
    void refreshProduct();
  }

  function dropUpload(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void upload(event, file);
  }

  const totalCapacity = currentAvailabilityRows.reduce((sum, row) => sum + row.capacityMl, 0);
  const totalReserved = currentAvailabilityRows.reduce((sum, row) => sum + row.reservedMl, 0);
  const soldOutDates = currentAvailabilityRows.filter(
    (row) => row.manualSoldOut || !row.acceptsOrders || row.capacityMl <= row.reservedMl
  ).length;

  return (
    <div className="shell pb-10 flex flex-col gap-4">
      {message && <AdminNotice tone="success" live>{message}</AdminNotice>}
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      {/* UNIFIED HERO HEADER */}
      <header className="card flex flex-col gap-3 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <Link className="text-xs font-semibold muted hover:text-primary mb-1 inline-flex items-center gap-1" href="/admin/products">
              ← Back to product catalog
            </Link>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <h1 className="text-2xl font-bold tracking-tight text-ink">{product.product.nameFi}</h1>
              <AdminStatusBadge
                status={product.product.active ? "CONFIRMED" : "CANCELLED"}
                label={product.product.active ? "Active" : "Archived"}
              />
              <span className="text-xs px-2 py-0.5 rounded bg-surface-muted border border-line font-medium muted ops-tabular">
                Code: {product.product.code}
              </span>
            </div>
            <p className="text-xs muted mt-1 font-medium">
              English: <strong>{product.product.nameEn}</strong> · Slug: <code className="text-xs">{product.product.slug}</code>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <Link className="btn text-xs py-1.5 px-3" href={`/admin/products/${product.product.id}/edit`}>
                Edit product ✏️
              </Link>
            )}

            <button
              className="btn btn-secondary text-xs py-1.5 px-3"
              type="button"
              onClick={() => setShowPreviewModal(true)}
            >
              Storefront preview 👁️
            </button>
          </div>
        </div>

        {/* Fact Chips Bar */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <span>📅 Available Window: <strong className="text-ink font-medium">{product.product.availableFrom} – {product.product.availableThrough}</strong></span>
          <span>🌐 Storefront Visibility: <strong className={product.product.showOnHomepage ? "text-emerald-700 font-semibold" : "muted"}>{product.product.showOnHomepage ? "Visible" : "Hidden"}</strong></span>
          <span>📝 Reserve Portal: <strong className={product.product.showOnReserve ? "text-purple-700 font-semibold" : "muted"}>{product.product.showOnReserve ? "Visible" : "Hidden"}</strong></span>
          <span>📦 Packages: <strong className="text-ink font-semibold">{product.packages.filter((p) => p.active).length} active</strong></span>
        </div>
      </header>

      {/* 2-COLUMN DASHBOARD GRID */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* LEFT COLUMN (2 Cols): Package Manager & Content */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* PACKAGE HIERARCHY CARD */}
          <section className="card p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 mb-4">
              <div>
                <p className="eyebrow">PACKAGE OPTIONS</p>
                <h2 className="text-lg font-bold text-ink">Packages &amp; Pricing</h2>
                <p className="text-xs muted">Default package is pre-selected on customer reservation forms.</p>
              </div>

              {canEdit && (
                <button
                  type="button"
                  className="btn text-xs py-1.5 px-3"
                  onClick={() => {
                    setEditingPkg(null);
                    setShowPackageModal(true);
                  }}
                >
                  ＋ Add package
                </button>
              )}
            </div>

            {/* Packages Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              {product.packages.map((item) => {
                const litres = item.volumeMl / 1000;
                const euros = (item.priceCents / 100).toFixed(2);
                const unitPricePerLitre = (item.priceCents / item.volumeMl * 1000 / 100).toFixed(2);

                return (
                  <article
                    key={item.id}
                    className={`card p-4 flex flex-col justify-between gap-3 border transition-all ${
                      item.isDefault ? "border-amber-300 bg-amber-50/30 shadow-sm ring-1 ring-amber-200" : "border-line"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-bold text-ink">{item.labelFi}</h3>
                          <span className="text-xs muted font-medium block">{item.labelEn}</span>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {item.isDefault ? (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                              ⭐ Default
                            </span>
                          ) : (
                            item.active &&
                            canEdit && (
                              <button
                                type="button"
                                className="text-[11px] font-semibold text-primary hover:underline"
                                onClick={() => void setDefaultPkg(item.id)}
                              >
                                Set default
                              </button>
                            )
                          )}

                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                            item.active ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-surface-muted text-muted border-line"
                          }`}>
                            {item.active ? "Active" : "Archived"}
                          </span>
                        </div>
                      </div>

                      {/* Volume & Pricing Stats */}
                      <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-line/60">
                        <div>
                          <span className="text-xl font-bold text-ink ops-tabular">{litres.toLocaleString("fi-FI")} L</span>
                          <span className="text-xs muted block">{item.volumeMl} mL</span>
                        </div>

                        <div className="text-right">
                          <span className="text-xl font-bold text-primary ops-tabular">{euros} €</span>
                          <span className="text-xs muted block font-medium">{unitPricePerLitre} €/L</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Controls */}
                    {canEdit && (
                      <div className="flex items-center justify-between border-t border-line/60 pt-2.5 mt-1 text-xs">
                        <button
                          type="button"
                          className="btn btn-secondary text-xs py-1 px-2"
                          onClick={() => {
                            setEditingPkg(item);
                            setShowPackageModal(true);
                          }}
                        >
                          ✏️ Edit
                        </button>

                        <button
                          type="button"
                          className="text-button text-xs"
                          onClick={() => void togglePkgActive(item)}
                        >
                          {item.active ? "Archive" : "Activate"}
                        </button>

                        <button
                          type="button"
                          className="text-button text-xs text-danger"
                          onClick={() => setDeletingPkgId(item.id)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          {/* PRODUCT DESCRIPTIONS CARD */}
          <section className="card p-4 md:p-5 flex flex-col gap-3">
            <div className="border-b border-line pb-3">
              <p className="eyebrow">STOREFRONT COPY</p>
              <h2 className="text-lg font-bold text-ink">Product Descriptions</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bg-surface-muted/50 p-3.5 rounded-xl border border-line">
                <span className="text-xs font-bold uppercase muted block mb-1">Finnish Description</span>
                <p className="text-sm text-ink/90 whitespace-pre-wrap">
                  {product.product.descriptionFi || "No Finnish description provided."}
                </p>
              </div>

              <div className="bg-surface-muted/50 p-3.5 rounded-xl border border-line">
                <span className="text-xs font-bold uppercase muted block mb-1">English Description</span>
                <p className="text-sm text-ink/90 whitespace-pre-wrap">
                  {product.product.descriptionEn || "No English description provided."}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (1 Col): Media Gallery & Harvest Sync */}
        <div className="flex flex-col gap-4">
          {/* MEDIA ASSETS REDESIGNED CARD */}
          <section className="card p-4 flex flex-col gap-3">
            <div className="border-b border-line pb-3">
              <p className="eyebrow">MEDIA ASSETS</p>
              <h2 className="text-lg font-bold text-ink">Product Gallery ({product.media.length})</h2>
              <p className="text-xs muted">Compact thumbnail grid. Hover or use arrows to reorder.</p>
            </div>

            {/* Thumbnail Cards Grid (Compact 110x110px Crop) */}
            <div className="grid grid-cols-2 gap-2.5">
              {product.media.map((image, index) => (
                <div
                  key={image.attachmentId}
                  draggable={canMedia}
                  onDragStart={() => setDragging(image.attachmentId)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => dropImage(e, image)}
                  className={`relative rounded-xl overflow-hidden border bg-surface-muted flex flex-col group ${
                    image.isPrimary ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-line"
                  }`}
                >
                  <div className="relative aspect-square w-full bg-surface-muted overflow-hidden">
                    <img src={image.url} alt={image.altFi || "Product photo"} className="w-full h-full object-cover" />

                    {image.isPrimary && (
                      <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-700 text-on-primary shadow-sm">
                        Primary
                      </span>
                    )}

                    {/* Quick Shift Arrows */}
                    {canMedia && product.media.length > 1 && (
                      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-ink/80 p-0.5 rounded text-on-primary">
                        <button
                          type="button"
                          className="px-1 text-xs hover:text-emerald-300 disabled:opacity-30"
                          disabled={index === 0}
                          onClick={() => shiftMedia(index, -1)}
                          title="Move left"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className="px-1 text-xs hover:text-emerald-300 disabled:opacity-30"
                          disabled={index === product.media.length - 1}
                          onClick={() => shiftMedia(index, 1)}
                          title="Move right"
                        >
                          →
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Image Footer Controls */}
                  <div className="p-2 flex flex-col gap-1 text-[11px] bg-surface border-t border-line">
                    <p className="font-medium truncate text-ink">{image.altFi || "No alt text"}</p>

                    {canMedia && (
                      <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-line/60">
                        {!image.isPrimary && (
                          <button
                            type="button"
                            className="text-[10px] font-semibold text-primary hover:underline"
                            onClick={() => void makePrimary(image)}
                          >
                            Set primary
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-[10px] text-muted hover:text-ink"
                          onClick={() => setAltEditing(altEditing === image.attachmentId ? null : image.attachmentId)}
                        >
                          Alt text
                        </button>
                        <button
                          type="button"
                          className="text-[10px] text-danger hover:underline"
                          onClick={() => void deleteMedia(image.attachmentId)}
                        >
                          Delete
                        </button>
                      </div>
                    )}

                    {altEditing === image.attachmentId && (
                      <form className="mt-1 flex flex-col gap-1 text-xs" onSubmit={(e) => void saveAlt(e, image)}>
                        <input name="altFi" defaultValue={image.altFi} placeholder="Alt text FI" required className="text-[11px] py-1 px-1.5 border rounded" />
                        <input name="altEn" defaultValue={image.altEn} placeholder="Alt text EN" required className="text-[11px] py-1 px-1.5 border rounded" />
                        <button className="btn text-[10px] py-0.5 px-1.5">Save</button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Media Upload Dropzone */}
            {canMedia && (
              <form
                className="mt-2 border-2 border-dashed border-line hover:border-primary rounded-xl p-4 text-center bg-surface-muted/30 flex flex-col items-center gap-2 transition-colors cursor-pointer"
                onSubmit={(e) => void upload(e)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={dropUpload}
              >
                <span className="text-2xl">📷</span>
                <div>
                  <strong className="text-xs text-ink block">Drop a photo here or click to browse</strong>
                  <span className="text-[10px] muted">JPEG, PNG or WebP · max 2 MB</span>
                </div>

                <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="text-xs" />
                <input name="altFi" placeholder="Finnish alt text *" required className="text-xs py-1 px-2 border rounded w-full max-w-xs" />
                <input name="altEn" placeholder="English alt text *" required className="text-xs py-1 px-2 border rounded w-full max-w-xs" />
                <button className="btn text-xs py-1 px-3 mt-1" type="submit">
                  Upload photo
                </button>
              </form>
            )}
          </section>

          {/* HARVEST AVAILABILITY SYNC CARD */}
          <section className="card p-4 flex flex-col gap-3">
            <div className="border-b border-line pb-3">
              <p className="eyebrow">HARVEST CAPACITY</p>
              <h2 className="text-lg font-bold text-ink">Availability Overview</h2>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-surface-muted p-2.5 rounded-xl border border-line">
                <span className="text-xl font-bold text-ink ops-tabular block">{currentAvailabilityRows.length}</span>
                <span className="text-[10px] font-semibold uppercase muted">Planned Dates</span>
              </div>

              <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                <span className="text-xl font-bold text-emerald-800 ops-tabular block">
                  {(Math.max(0, totalCapacity - totalReserved) / 1000).toLocaleString("fi-FI")} L
                </span>
                <span className="text-[10px] font-semibold uppercase text-emerald-700">Remaining</span>
              </div>
            </div>

            {soldOutDates > 0 && (
              <div className="text-xs p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-medium">
                ⚠️ {soldOutDates} date(s) fully booked or closed.
              </div>
            )}

            <Link
              className="btn btn-secondary text-xs py-2 text-center justify-center font-semibold mt-1"
              href={`/admin/availability?product=${product.product.id}`}
            >
              Manage Harvest Dates 📅 ↗
            </Link>
          </section>
        </div>
      </div>

      {/* Package Modal (Add / Edit) */}
      {showPackageModal && (
        <PackageModal
          productId={product.product.id}
          editingPackage={editingPkg}
          onClose={() => {
            setShowPackageModal(false);
            setEditingPkg(null);
          }}
          onSaved={() => void refreshProduct()}
        />
      )}

      {/* Delete Package Confirmation Dialog */}
      {deletingPkgId && (
        <div className="admin-dialog-backdrop">
          <div className="admin-dialog card max-w-sm w-full p-5 flex flex-col gap-3">
            <p className="eyebrow text-danger">CONFIRM DELETE</p>
            <h3 className="text-lg font-bold text-ink">Delete Package?</h3>
            <p className="text-xs muted">
              Are you sure you want to delete this package? If the package has existing orders, consider archiving it instead.
            </p>
            <div className="profile-actions justify-end gap-2 mt-2">
              <button className="btn btn-secondary text-xs" type="button" onClick={() => setDeletingPkgId(null)}>
                Cancel
              </button>
              <button className="btn btn-danger text-xs" type="button" onClick={() => void handleDeletePkg(deletingPkgId)}>
                Delete Package
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Storefront Preview Modal */}
      {showPreviewModal && (
        <ProductPreviewModal
          row={{
            product: product.product,
            packages: product.packages,
            media: product.media,
          }}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
}
