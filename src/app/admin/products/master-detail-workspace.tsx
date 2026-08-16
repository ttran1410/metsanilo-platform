"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { packages, products } from "@/db/schema";
import { AdminEmptyState, AdminNotice, AdminStatusBadge } from "../presentation";

import { BilingualEditor } from "./bilingual-editor";
import { MediaGalleryTab } from "./media-gallery-tab";
import { PreviewDrawer } from "./preview-drawer";
import { PricingLadder } from "./pricing-ladder";
import { SeasonTracker } from "./season-tracker";

type ProductRow = {
  product: typeof products.$inferSelect;
  packages: Array<typeof packages.$inferSelect>;
  media?: Array<{
    id: string;
    attachmentId?: string;
    url: string;
    altFi: string;
    altEn: string;
    isPrimary: boolean;
  }>;
};

type ActiveTab = "general" | "packages" | "media" | "channels";
type FilterStatus = "all" | "in_season" | "upcoming" | "archived";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MasterDetailWorkspace({
  initialProducts,
  canManageProducts,
}: {
  initialProducts: ProductRow[];
  canManageProducts: boolean;
}) {
  const router = useRouter();
  const [productsList, setProductsList] = useState(initialProducts);
  const [selectedId, setSelectedId] = useState<string>(initialProducts[0]?.product.id ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [activeTab, setActiveTab] = useState<ActiveTab>("general");
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const today = todayStr();

  const selectedRow = useMemo(() => {
    return productsList.find((p) => p.product.id === selectedId) ?? productsList[0];
  }, [productsList, selectedId]);

  // Form State for currently selected product
  const [nameFi, setNameFi] = useState(selectedRow?.product.nameFi ?? "");
  const [nameEn, setNameEn] = useState(selectedRow?.product.nameEn ?? "");
  const [descFi, setDescFi] = useState(selectedRow?.product.descriptionFi ?? "");
  const [descEn, setDescEn] = useState(selectedRow?.product.descriptionEn ?? "");
  const [availableFrom, setAvailableFrom] = useState(selectedRow?.product.availableFrom ?? "");
  const [availableThrough, setAvailableThrough] = useState(selectedRow?.product.availableThrough ?? "");
  const [code, setCode] = useState(selectedRow?.product.code ?? "");
  const [slug, setSlug] = useState(selectedRow?.product.slug ?? "");
  const [active, setActive] = useState(selectedRow?.product.active ?? true);
  const [showOnHomepage, setShowOnHomepage] = useState(selectedRow?.product.showOnHomepage ?? true);
  const [showOnReserve, setShowOnReserve] = useState(selectedRow?.product.showOnReserve ?? true);

  // Sync state when selected product changes
  function selectProduct(row: ProductRow) {
    setSelectedId(row.product.id);
    setNameFi(row.product.nameFi);
    setNameEn(row.product.nameEn);
    setDescFi(row.product.descriptionFi ?? "");
    setDescEn(row.product.descriptionEn ?? "");
    setAvailableFrom(row.product.availableFrom);
    setAvailableThrough(row.product.availableThrough);
    setCode(row.product.code);
    setSlug(row.product.slug);
    setActive(row.product.active);
    setShowOnHomepage(row.product.showOnHomepage);
    setShowOnReserve(row.product.showOnReserve);
    setMessage("");
    setError("");
  }

  async function refreshCurrentProduct() {
    if (!selectedId) return;
    try {
      const response = await fetch(`/api/admin/products/${selectedId}`);
      const body = await response.json();
      if (response.ok && body.data) {
        setProductsList((current) =>
          current.map((item) => (item.product.id === selectedId ? body.data : item))
        );
      }
    } catch {
      /* ignore */
    }
  }

  // Filter Master List
  const filteredMasterList = useMemo(() => {
    return productsList.filter((row) => {
      const text = `${row.product.nameFi} ${row.product.nameEn} ${row.product.code}`.toLowerCase();
      const matchesSearch = !searchQuery || text.includes(searchQuery.toLowerCase());

      const isPreSeason = today < row.product.availableFrom;
      const isPostSeason = today > row.product.availableThrough;
      const isInSeason = row.product.active && !isPreSeason && !isPostSeason;

      let matchesFilter = true;
      if (filterStatus === "in_season") matchesFilter = isInSeason;
      else if (filterStatus === "upcoming") matchesFilter = isPreSeason;
      else if (filterStatus === "archived") matchesFilter = !row.product.active || isPostSeason;

      return matchesSearch && matchesFilter;
    });
  }, [productsList, searchQuery, filterStatus, today]);

  // Save Changes
  async function handleSaveChanges() {
    if (!selectedRow) return;
    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      code: code.trim().toUpperCase(),
      slug: slug.trim().toLowerCase(),
      nameFi: nameFi.trim(),
      nameEn: nameEn.trim(),
      descriptionFi: descFi.trim(),
      descriptionEn: descEn.trim(),
      availableFrom,
      availableThrough,
      active,
      showOnHomepage,
      showOnReserve,
    };

    const response = await fetch(`/api/admin/products/${selectedRow.product.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "update", product: payload }),
    });

    const body = await response.json();
    setSaving(false);

    if (!response.ok) {
      return setError(body.message ?? body.code ?? "Could not save product changes.");
    }

    setProductsList((current) =>
      current.map((item) => (item.product.id === selectedRow.product.id ? body.data : item))
    );
    setMessage(`Saved changes for ${nameFi}.`);
  }

  // Handle Extend Season
  function handleExtendSeason(newFrom: string, newThrough: string) {
    setAvailableFrom(newFrom);
    setAvailableThrough(newThrough);
    setMessage("Season extended by 1 week. Click 'Save Changes' to apply.");
  }

  // Smart Delete or Archive Guard
  async function handleDeleteOrArchive() {
    if (!selectedRow) return;
    setDeleting(true);
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/products/${selectedRow.product.id}`, {
      method: "DELETE",
    });
    const body = await response.json();
    setDeleting(false);

    if (!response.ok) {
      if (body.code === "PRODUCT_IN_USE" || response.status === 409) {
        // Fallback to non-destructive Archive
        const archResponse = await fetch(`/api/admin/products/${selectedRow.product.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "active", active: false }),
        });
        const archBody = await archResponse.json();
        if (archResponse.ok) {
          setActive(false);
          setProductsList((current) =>
            current.map((item) => (item.product.id === selectedRow.product.id ? archBody.data : item))
          );
          return setMessage("Product has historical orders and was safely archived instead of deleted.");
        }
      }
      return setError(body.message ?? "Could not delete or archive product.");
    }

    // Success delete
    const nextList = productsList.filter((p) => p.product.id !== selectedRow.product.id);
    setProductsList(nextList);
    if (nextList[0]) selectProduct(nextList[0]);
    setMessage("Product deleted.");
  }

  const missingEn = !nameEn.trim() || !descEn.trim();

  return (
    <section className="shell pb-10 flex flex-col gap-3">
      {message && <AdminNotice tone="success" live>{message}</AdminNotice>}
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      {/* MASTER-DETAIL SPLIT WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT MASTER SIDEBAR (4 Cols) */}
        <aside className="lg:col-span-4 card p-4 flex flex-col gap-3 max-h-[85vh] sticky top-4">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div>
              <span className="eyebrow">CATALOG MASTER</span>
              <h2 className="text-base font-bold text-ink">Products ({filteredMasterList.length})</h2>
            </div>

            {canManageProducts && (
              <a className="btn text-xs py-1 px-2.5" href="/admin/products/new">
                ＋ New Product
              </a>
            )}
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col gap-2">
            <input
              placeholder="Search products by name or code…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs py-1.5 px-3 rounded-lg border border-line bg-surface"
            />

            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              {[
                { key: "all", label: "All" },
                { key: "in_season", label: "🟢 In Season" },
                { key: "upcoming", label: "🟡 Upcoming" },
                { key: "archived", label: "⚪ Archived" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition-colors ${
                    filterStatus === tab.key
                      ? "bg-primary text-on-primary"
                      : "bg-surface-muted text-ink/70 hover:bg-surface-muted/80"
                  }`}
                  onClick={() => setFilterStatus(tab.key as FilterStatus)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Product Master Items List */}
          <div className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1">
            {filteredMasterList.map((row) => {
              const isSelected = row.product.id === selectedId;
              const primaryImg = row.media?.find((m) => m.isPrimary) ?? row.media?.[0];
              const isPreSeason = today < row.product.availableFrom;
              const isPostSeason = today > row.product.availableThrough;
              const isInSeason = row.product.active && !isPreSeason && !isPostSeason;
              const activePkgs = row.packages.filter((pkg) => pkg.active);

              return (
                <button
                  key={row.product.id}
                  type="button"
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                      : "border-line bg-surface hover:border-muted"
                  }`}
                  onClick={() => selectProduct(row)}
                >
                  {/* Thumbnail Avatar */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-muted border border-line shrink-0 flex items-center justify-center">
                    {primaryImg ? (
                      <img src={primaryImg.url} alt={row.product.nameFi} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg">🫐</span>
                    )}
                  </div>

                  {/* Text Details */}
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <strong className="text-sm font-bold text-ink truncate">{row.product.nameFi}</strong>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-muted border border-line text-ink/80 shrink-0">
                        {row.product.code}
                      </span>
                    </div>

                    <span className="text-xs muted truncate">{row.product.nameEn}</span>

                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                        isInSeason
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : isPreSeason
                          ? "bg-amber-50 text-amber-900 border-amber-200"
                          : "bg-surface-muted text-muted border-line"
                      }`}>
                        {isInSeason ? "🟢 In Season" : isPreSeason ? "🟡 Upcoming" : "⚪ Ended"}
                      </span>

                      <span className="text-[10px] muted font-medium">
                        {activePkgs.length} pkg{activePkgs.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredMasterList.length === 0 && (
              <AdminEmptyState title="No products found" description="Adjust search term or filter tab." />
            )}
          </div>
        </aside>

        {/* RIGHT DETAIL WORKSPACE EDITOR (8 Cols) */}
        <main className="lg:col-span-8 flex flex-col gap-4">
          {selectedRow ? (
            <div className="flex flex-col gap-4">
              {/* DETAIL EDITOR HEADER */}
              <div className="card p-4 md:p-5 flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                  <div>
                    <span className="eyebrow">PRODUCT WORKSPACE EDITOR</span>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <h1 className="text-2xl font-bold tracking-tight text-ink">{nameFi}</h1>
                      <AdminStatusBadge status={active ? "CONFIRMED" : "CANCELLED"} label={active ? "Active" : "Archived"} />
                      <span className="text-xs px-2 py-0.5 rounded bg-surface-muted border border-line font-medium muted ops-tabular">
                        Code: {code}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                      onClick={() => setShowPreviewDrawer(true)}
                    >
                      👁️ Preview Storefront
                    </button>

                    {canManageProducts && (
                      <button
                        type="button"
                        className="btn text-xs py-1.5 px-4 font-bold shadow-sm"
                        onClick={() => void handleSaveChanges()}
                        disabled={saving}
                      >
                        {saving ? "Saving…" : "💾 Save Changes"}
                      </button>
                    )}
                  </div>
                </div>

                {/* 4 WORKSPACE TABS */}
                <nav className="flex items-center gap-2 border-b border-line pb-0 overflow-x-auto" aria-label="Editor Tabs">
                  {[
                    { key: "general", label: "Tab 1: General & Text", badge: missingEn },
                    { key: "packages", label: `Tab 2: Packages (${selectedRow.packages.length})` },
                    { key: "media", label: `Tab 3: Media (${selectedRow.media?.length ?? 0})` },
                    { key: "channels", label: "Tab 4: Season & Channels" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`text-xs font-semibold px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                        activeTab === tab.key
                          ? "border-primary text-primary font-bold"
                          : "border-transparent text-muted hover:text-ink hover:border-line"
                      }`}
                      onClick={() => setActiveTab(tab.key as ActiveTab)}
                    >
                      {tab.label}
                      {tab.badge && <span className="text-amber-500 font-bold">●</span>}
                    </button>
                  ))}
                </nav>
              </div>

              {/* TAB 1: GENERAL & CONTENT */}
              {activeTab === "general" && (
                <div className="flex flex-col gap-4">
                  {/* HARVEST SEASON TIMELINE TRACKER */}
                  <SeasonTracker
                    availableFrom={availableFrom}
                    availableThrough={availableThrough}
                    active={active}
                    onUpdateDates={handleExtendSeason}
                  />

                  {/* SYNCHRONIZED BILINGUAL EDITOR */}
                  <BilingualEditor
                    nameFi={nameFi}
                    setNameFi={setNameFi}
                    nameEn={nameEn}
                    setNameEn={setNameEn}
                    descFi={descFi}
                    setDescFi={setDescFi}
                    descEn={descEn}
                    setDescEn={setDescEn}
                  />
                </div>
              )}

              {/* TAB 2: PACKAGES & PRICING MATRIX */}
              {activeTab === "packages" && (
                <PricingLadder
                  productId={selectedRow.product.id}
                  packagesList={selectedRow.packages}
                  canEdit={canManageProducts}
                  onRefresh={refreshCurrentProduct}
                />
              )}

              {/* TAB 3: MEDIA ASSETS GALLERY */}
              {activeTab === "media" && (
                <MediaGalleryTab
                  productId={selectedRow.product.id}
                  mediaList={selectedRow.media ?? []}
                  canMedia={canManageProducts}
                  onRefresh={refreshCurrentProduct}
                />
              )}

              {/* TAB 4: SEASON & CHANNELS (SEO & DATA SAFETY) */}
              {activeTab === "channels" && (
                <div className="flex flex-col gap-4">
                  <div className="card p-4 md:p-5 grid gap-5">
                    <div className="border-b border-line pb-3">
                      <span className="eyebrow">STOREFRONT CHANNELS &amp; SEO</span>
                      <h3 className="text-base font-bold text-ink">Publishing Channels &amp; Identifiers</h3>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="field">
                        <span>Product Code</span>
                        <input
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                          required
                          className="uppercase font-medium"
                        />
                      </label>

                      <label className="field">
                        <span>URL Slug</span>
                        <input
                          value={slug}
                          onChange={(e) => setSlug(e.target.value.toLowerCase())}
                          required
                          className="font-medium"
                        />
                      </label>

                      <label className="field">
                        <span>Available From</span>
                        <input
                          type="date"
                          value={availableFrom}
                          onChange={(e) => setAvailableFrom(e.target.value)}
                          required
                        />
                      </label>

                      <label className="field">
                        <span>Available Through</span>
                        <input
                          type="date"
                          value={availableThrough}
                          onChange={(e) => setAvailableThrough(e.target.value)}
                          required
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 p-3.5 bg-surface-muted rounded-xl border border-line">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={(e) => setActive(e.target.checked)}
                        />
                        <span>Product Active</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={showOnHomepage}
                          onChange={(e) => setShowOnHomepage(e.target.checked)}
                        />
                        <span>🌐 Show on Storefront Homepage</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={showOnReserve}
                          onChange={(e) => setShowOnReserve(e.target.checked)}
                        />
                        <span>📝 Show on Reservation Form</span>
                      </label>
                    </div>

                    {/* SMART DELETE GUARD & NON-DESTRUCTIVE ARCHIVING */}
                    {canManageProducts && (
                      <div className="border-t border-line pt-4 flex items-center justify-between">
                        <div>
                          <strong className="text-xs font-bold uppercase text-danger block">Danger Zone</strong>
                          <span className="text-xs muted">
                            Deleting permanent product records is protected if historical orders exist.
                          </span>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary text-xs text-danger py-1.5 px-3"
                          onClick={() => void handleDeleteOrArchive()}
                          disabled={deleting}
                        >
                          {deleting ? "Processing…" : "🗑️ Delete / Archive Product"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <AdminEmptyState title="Select a product" description="Choose a product from the left sidebar to edit." />
          )}
        </main>
      </div>

      {/* LIVE MOBILE STOREFRONT PREVIEW DRAWER */}
      {showPreviewDrawer && selectedRow && (
        <PreviewDrawer row={selectedRow} onClose={() => setShowPreviewDrawer(false)} />
      )}
    </section>
  );
}
