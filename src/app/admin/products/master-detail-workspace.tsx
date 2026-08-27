"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { packages, products } from "@/db/schema";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ClipboardList,
  Eye,
  FileText,
  Globe2,
  Home,
  Image as ImageIcon,
  Package,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { AdminEmptyState, AdminNotice, AdminPageHeader, AdminStatusBadge } from "../presentation";
import { AdminPagination, AdminSidebarInfiniteFooter } from "../ui/admin-pagination";
import { AdminRowActionMenu, IconEye, IconLink } from "../ui/admin-row-action-menu";
import { AdminSearchField } from "../ui/admin-search-field";

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
  const searchParams = useSearchParams();
  const [productsList, setProductsList] = useState(initialProducts);
  const [selectedId, setSelectedId] = useState<string>(searchParams.get("product") ?? initialProducts[0]?.product.id ?? "");
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") ?? "");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(() => searchParams.get("status") as FilterStatus || "all");
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => searchParams.get("tab") as ActiveTab || "general");
  const [viewMode, setViewMode] = useState<"split" | "table">(() => searchParams.get("view") === "table" ? "table" : "split");
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showUnarchiveConfirm, setShowUnarchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (selectedId) next.set("product", selectedId); else next.delete("product");
    if (searchQuery) next.set("q", searchQuery); else next.delete("q");
    if (filterStatus !== "all") next.set("status", filterStatus); else next.delete("status");
    if (activeTab !== "general") next.set("tab", activeTab); else next.delete("tab");
    if (viewMode !== "split") next.set("view", viewMode); else next.delete("view");
    if (currentPage > 1) next.set("page", String(currentPage)); else next.delete("page");
    if (next.toString() !== searchParams.toString()) router.replace(`?${next.toString()}`, { scroll: false });
  }, [activeTab, currentPage, filterStatus, router, searchParams, searchQuery, selectedId, viewMode]);

  const today = todayStr();

  const metrics = useMemo(() => {
    const total = productsList.length;
    const inSeason = productsList.filter((row) => {
      const isPreSeason = today < row.product.availableFrom;
      const isPostSeason = today > row.product.availableThrough;
      return row.product.active && !isPreSeason && !isPostSeason;
    }).length;
    const upcoming = productsList.filter((row) => row.product.active && today < row.product.availableFrom).length;
    const archived = productsList.filter((row) => !row.product.active || today > row.product.availableThrough).length;

    return { total, inSeason, upcoming, archived };
  }, [productsList, today]);

  const selectedRow = useMemo(() => {
    return productsList.find((p) => p.product.id === selectedId) ?? productsList[0];
  }, [productsList, selectedId]);

  // Reorder Products
  async function handleMoveProduct(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= productsList.length) return;
    const next = [...productsList];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setProductsList(next);

    const orderedIds = next.map((item) => item.product.id);
    const response = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reorder", productIds: orderedIds }),
    });
    if (!response.ok) {
      setError("Could not save product order.");
    } else {
      setMessage("Product display order updated.");
    }
  }

  // Toggle Active (Archive / Un-archive)
  async function handleToggleActive(targetActive: boolean) {
    if (!selectedRow) return;
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/products/${selectedRow.product.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "active", active: targetActive }),
    });

    const body = await response.json();
    if (!response.ok) {
      return setError(body.message ?? "Could not update product active status.");
    }

    setActive(targetActive);
    setProductsList((current) =>
      current.map((item) => (item.product.id === selectedRow.product.id ? body.data : item))
    );
    setMessage(targetActive ? `${selectedRow.product.nameFi} is now active.` : `${selectedRow.product.nameFi} has been archived.`);
  }

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
    setMobileView("detail");
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

  const paginatedMasterList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMasterList.slice(start, start + pageSize);
  }, [filteredMasterList, currentPage, pageSize]);

  const [splitLimit, setSplitLimit] = useState(20);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (activeMenuId && !(event.target as HTMLElement).closest(".row-action-menu")) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activeMenuId]);
  const sidebarDisplayedProducts = useMemo(() => {
    return filteredMasterList.slice(0, splitLimit);
  }, [filteredMasterList, splitLimit]);

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
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/products/${selectedRow.product.id}`, {
      method: "DELETE",
    });
    const body = await response.json();
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
  const filterOptions: Array<{ key: FilterStatus; label: string; count: number; tone: string }> = [
    { key: "all", label: "All", count: metrics.total, tone: "neutral" },
    { key: "in_season", label: "In season", count: metrics.inSeason, tone: "success" },
    { key: "upcoming", label: "Upcoming", count: metrics.upcoming, tone: "warning" },
    { key: "archived", label: "Archived", count: metrics.archived, tone: "neutral" },
  ];

  return (
    <section className="admin-catalog-workspace shell pb-10 flex flex-col gap-3">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Products"
        description="Find a product, check whether it is ready to sell, and make a focused change."
        actions={
          <>
            <label className="admin-catalog-view-picker">
              <span>View</span>
              <select value={viewMode} onChange={(event) => setViewMode(event.target.value as "split" | "table")}>
                <option value="split">List and editor</option>
                <option value="table">Comparison table</option>
              </select>
            </label>
            {canManageProducts && (
              <Link className="btn admin-catalog-create" href="/admin/products/new">
                <Plus aria-hidden="true" />
                <span>New product</span>
              </Link>
            )}
          </>
        }
      />

      {message && <AdminNotice tone="success" live>{message}</AdminNotice>}
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      {/* WORKSPACE CONTENT AREA */}
      {viewMode === "table" ? (
        /* TABLE MATRIX VIEW */
        <div className="card p-4 overflow-x-auto border border-line flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 max-w-lg">
              <AdminSearchField wrapperClassName="flex-1"
                  placeholder="Search by name or code…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs py-1.5 px-3 rounded-lg border border-line bg-surface"
              />

              <div className="admin-catalog-filters text-[11px]">
                {filterOptions.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition-colors ${
                      filterStatus === tab.key
                        ? "bg-primary text-on-primary"
                        : "bg-surface-muted text-ink/70 hover:bg-surface-muted/80"
                    }`}
                    onClick={() => {
                        setFilterStatus(tab.key);
                        setCurrentPage(1);
                      }}
                  >
                    <span className={`admin-status-dot is-${tab.tone}`} aria-hidden="true" />
                    {tab.label} <span className="admin-filter-count">{tab.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs muted font-semibold">Showing {filteredMasterList.length} products</span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line text-muted font-bold uppercase text-[10px] tracking-wider">
                <th className="pb-3 pt-1 px-3">Product Variety</th>
                <th className="pb-3 pt-1 px-3">Code / Slug</th>
                <th className="pb-3 pt-1 px-3">Harvest Season Window</th>
                <th className="pb-3 pt-1 px-3">Active Packages</th>
                <th className="pb-3 pt-1 px-3">Storefront Channels</th>
                <th className="pb-3 pt-1 px-3">Status</th>
                <th className="pb-3 pt-1 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paginatedMasterList.map((row) => {
                const primaryImg = row.media?.find((m) => m.isPrimary) ?? row.media?.[0];
                const isPreSeason = today < row.product.availableFrom;
                const isPostSeason = today > row.product.availableThrough;
                const isInSeason = row.product.active && !isPreSeason && !isPostSeason;
                const activePkgs = row.packages.filter((pkg) => pkg.active);

                return (
                  <tr key={row.product.id} className="hover:bg-surface-muted/60 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-muted border border-line shrink-0 flex items-center justify-center">
                          {primaryImg ? (
                            <img src={primaryImg.url} alt={row.product.nameFi} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="admin-placeholder-icon" aria-hidden="true" />
                          )}
                        </div>
                        <div>
                          <strong className="text-ink font-bold block">{row.product.nameFi}</strong>
                          <span className="muted text-[11px]">{row.product.nameEn}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-ink bg-surface-muted px-2 py-0.5 rounded border border-line text-[11px]">
                        {row.product.code}
                      </span>
                      <span className="block text-[10px] muted truncate mt-0.5">/{row.product.slug}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] muted">
                      {row.product.availableFrom} → {row.product.availableThrough}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {activePkgs.map((pkg) => (
                          <span key={pkg.id} className="bg-blue-50 text-blue-900 border border-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {pkg.labelFi} ({(pkg.priceCents / 100).toFixed(2)}€)
                          </span>
                        ))}
                        {activePkgs.length === 0 && <span className="text-muted text-[11px]">No packages</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 text-[10px] font-semibold">
                        {row.product.showOnHomepage && (
                          <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300 inline-flex items-center gap-1">
                            <Home aria-hidden="true" /> Homepage
                          </span>
                        )}
                        {row.product.showOnReserve && (
                          <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300 inline-flex items-center gap-1">
                            <ClipboardList aria-hidden="true" /> Reservation form
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          isInSeason
                            ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                            : isPreSeason
                            ? "bg-amber-100 text-amber-900 border-amber-300"
                            : "bg-surface-muted text-ink/70 border-line"
                        }`}
                      >
                        <span className={`admin-status-dot ${isInSeason ? "is-success" : isPreSeason ? "is-warning" : "is-neutral"}`} aria-hidden="true" />
                        {isInSeason ? "In season" : isPreSeason ? "Upcoming" : "Archived"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <AdminRowActionMenu
                        items={[
                          {
                            id: "edit-product",
                            label: "View & Edit Product",
                            icon: <IconEye />,
                            onClick: () => {
                              selectProduct(row);
                              setViewMode("split");
                            },
                          },
                          {
                            id: "preview-storefront",
                            label: "Preview Storefront",
                            icon: <IconLink />,
                            onClick: () => {
                              window.open(`/products/${row.product.slug}`, "_blank");
                            },
                          },
                          {
                            id: "packages-pricing",
                            label: "Packages & Pricing",
                            icon: <Package aria-hidden="true" />,
                            onClick: () => {
                              selectProduct(row);
                              setViewMode("split");
                            },
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}

              {filteredMasterList.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center muted italic">
                    No products match the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <AdminPagination
            page={currentPage}
            limit={pageSize}
            total={filteredMasterList.length}
            onPageChange={setCurrentPage}
            onLimitChange={setPageSize}
            itemLabel="products"
          />
        </div>
      ) : (
        /* MASTER-DETAIL SPLIT WORKSPACE GRID */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT MASTER SIDEBAR (4 Cols) */}
          <aside className={`lg:col-span-4 card p-4 flex flex-col gap-3 max-h-[85vh] sticky top-4 ${
            mobileView === "detail" ? "hidden lg:flex" : "flex"
          }`}>
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div>
                <span className="eyebrow">Catalog list</span>
                <h2 className="text-base font-bold text-ink">{filteredMasterList.length} products</h2>
              </div>
            </div>

            {/* Search & Filter Controls */}
            <div className="flex flex-col gap-2">
              <AdminSearchField wrapperClassName="w-full"
                  placeholder="Search by name or code…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs py-1.5 px-3 rounded-lg border border-line bg-surface"
              />

              <div className="admin-catalog-filters text-[11px]">
                {filterOptions.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition-colors ${
                      filterStatus === tab.key
                        ? "bg-primary text-on-primary"
                        : "bg-surface-muted text-ink/70 hover:bg-surface-muted/80"
                    }`}
                    onClick={() => {
                        setFilterStatus(tab.key);
                        setCurrentPage(1);
                      }}
                  >
                    <span className={`admin-status-dot is-${tab.tone}`} aria-hidden="true" />
                    {tab.label} <span className="admin-filter-count">{tab.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Product Master Items List */}
            <div
              className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1"
              onScroll={(e) => {
                const target = e.currentTarget;
                if (target.scrollTop + target.clientHeight >= target.scrollHeight - 40) {
                  if (splitLimit < filteredMasterList.length) {
                    setSplitLimit((prev) => Math.min(prev + 20, filteredMasterList.length));
                  }
                }
              }}
            >
              {sidebarDisplayedProducts.map((row, index) => {
                const isSelected = row.product.id === selectedId;
                const primaryImg = row.media?.find((m) => m.isPrimary) ?? row.media?.[0];
                const isPreSeason = today < row.product.availableFrom;
                const isPostSeason = today > row.product.availableThrough;
                const isInSeason = row.product.active && !isPreSeason && !isPostSeason;
                const activePkgs = row.packages.filter((pkg) => pkg.active);

                return (
                  <div
                    key={row.product.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                        : "border-line bg-surface hover:border-muted"
                    }`}
                    onClick={() => selectProduct(row)}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Thumbnail Avatar */}
                      <div className="w-11 h-11 rounded-lg overflow-hidden bg-surface-muted border border-line shrink-0 flex items-center justify-center">
                        {primaryImg ? (
                          <img src={primaryImg.url} alt={row.product.nameFi} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="admin-placeholder-icon" aria-hidden="true" />
                        )}
                      </div>

                      {/* Text Details */}
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <strong className="text-sm font-bold text-ink truncate">{row.product.nameFi}</strong>
                        </div>

                        <span className="text-xs muted truncate">{row.product.nameEn}</span>
                        <span className="admin-product-code">{row.product.code}</span>

                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                            isInSeason
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : isPreSeason
                              ? "bg-amber-50 text-amber-900 border-amber-200"
                              : "bg-surface-muted text-muted border-line"
                          }`}>
                            <span className={`admin-status-dot ${isInSeason ? "is-success" : isPreSeason ? "is-warning" : "is-neutral"}`} aria-hidden="true" />
                            {isInSeason ? "In season" : isPreSeason ? "Upcoming" : "Ended"}
                          </span>

                          <span className="text-[10px] muted font-medium">
                            {activePkgs.length} pkg{activePkgs.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Re-order Up / Down Controls */}
                    {canManageProducts && (
                      <div className="flex flex-col gap-1 shrink-0 border-l border-line/60 pl-1.5 ml-1">
                        <button
                          type="button"
                          title="Move product position up on storefront"
                          aria-label={`Move ${row.product.nameFi} up`}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-surface-muted disabled:opacity-20 text-[10px] font-bold leading-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleMoveProduct(index, "up");
                          }}
                        >
                          <ArrowUp aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title="Move product position down on storefront"
                          aria-label={`Move ${row.product.nameFi} down`}
                          disabled={index === filteredMasterList.length - 1}
                          className="p-1 rounded hover:bg-surface-muted disabled:opacity-20 text-[10px] font-bold leading-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleMoveProduct(index, "down");
                          }}
                        >
                          <ArrowDown aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredMasterList.length === 0 && (
                <AdminEmptyState title="No products found" description="Adjust search term or filter tab." />
              )}
            </div>

            <AdminSidebarInfiniteFooter
              displayed={sidebarDisplayedProducts.length}
              total={filteredMasterList.length}
              onLoadMore={() => setSplitLimit((prev) => Math.min(prev + 20, filteredMasterList.length))}
              itemLabel="products"
            />
          </aside>

          {/* RIGHT DETAIL WORKSPACE EDITOR (8 Cols) */}
          <main className={`lg:col-span-8 flex flex-col gap-4 ${
            mobileView === "list" ? "hidden lg:flex" : "flex"
          }`}>
            {/* STICKY MOBILE BACK TO ROSTER BUTTON */}
            <div className="lg:hidden">
              <button
                type="button"
                className="btn btn-secondary text-xs px-3.5 py-2 font-bold flex items-center gap-1.5 w-full justify-center"
                onClick={() => setMobileView("list")}
              >
                <ArrowLeft aria-hidden="true" /> Back to products
              </button>
            </div>
          {selectedRow ? (
            <div className="flex flex-col gap-4">
              {/* DETAIL EDITOR HEADER */}
              <div className="card p-4 md:p-5 flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                  <div>
                    <span className="eyebrow">Product editor</span>
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
                      <Eye aria-hidden="true" /> Preview
                    </button>

                    {canManageProducts && (
                      <button
                        type="button"
                        className="btn text-xs py-1.5 px-4 font-bold shadow-sm"
                        onClick={() => void handleSaveChanges()}
                        disabled={saving}
                      >
                        <Save aria-hidden="true" /> {saving ? "Saving…" : "Save changes"}
                      </button>
                    )}
                  </div>
                </div>

                {/* 4 WORKSPACE TABS */}
                <nav className="flex items-center gap-2 border-b border-line pb-0 overflow-x-auto" aria-label="Editor Tabs">
                  {[
                    { key: "general", label: "General and copy", icon: FileText, badge: missingEn },
                    { key: "packages", label: `Packages (${selectedRow.packages.length})`, icon: Package },
                    { key: "media", label: `Media (${selectedRow.media?.length ?? 0})`, icon: ImageIcon },
                    { key: "channels", label: "Publishing", icon: Globe2 },
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
                      <tab.icon aria-hidden="true" />
                      {tab.label}
                      {tab.badge && <span className="text-amber-500 font-bold">●</span>}
                    </button>
                  ))}
                </nav>
              </div>

              {/* TAB 1: GENERAL & CONTENT */}
              {activeTab === "general" && (
                <div className="flex flex-col gap-4">
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
                  {/* HARVEST SEASON TIMELINE & FULFILLED LITRE GOAL */}
                  <SeasonTracker
                    key={selectedRow.product.id}
                    productId={selectedRow.product.id}
                    availableFrom={availableFrom}
                    availableThrough={availableThrough}
                    active={active}
                    onUpdateDates={handleExtendSeason}
                  />

                  <div className="card p-4 md:p-5 grid gap-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                      <div>
                        <span className="eyebrow">STOREFRONT CHANNELS &amp; SEO</span>
                        <h3 className="text-base font-bold text-ink">Publishing Channels &amp; Identifiers</h3>
                      </div>

                      {canManageProducts && (
                        <div className="flex items-center gap-2">
                          {active ? (
                            <button
                              type="button"
                              className="btn btn-secondary text-xs text-amber-900 border-amber-300 bg-amber-50 hover:bg-amber-100 py-1.5 px-3 flex items-center gap-1.5 font-medium"
                              onClick={() => setShowArchiveConfirm(true)}
                            >
                              <Archive aria-hidden="true" /> Archive product
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn text-xs bg-emerald-700 hover:bg-emerald-800 text-white py-1.5 px-3 flex items-center gap-1.5 font-bold shadow-sm"
                              onClick={() => setShowUnarchiveConfirm(true)}
                            >
                              <ArchiveRestore aria-hidden="true" /> Restore product
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-secondary text-xs text-danger border-rose-200 bg-rose-50/50 hover:bg-rose-100 py-1.5 px-3 flex items-center gap-1.5 font-medium"
                            onClick={() => setShowDeleteConfirm(true)}
                          >
                            <Trash2 aria-hidden="true" /> Delete product
                          </button>
                        </div>
                      )}
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
                          onClick={(e) => e.currentTarget.showPicker?.()}
                          required
                        />
                      </label>

                      <label className="field">
                        <span>Available Through</span>
                        <input
                          type="date"
                          value={availableThrough}
                          onChange={(e) => setAvailableThrough(e.target.value)}
                          onClick={(e) => e.currentTarget.showPicker?.()}
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
                        <span className="inline-flex items-center gap-1.5"><Home aria-hidden="true" /> Show on storefront homepage</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={showOnReserve}
                          onChange={(e) => setShowOnReserve(e.target.checked)}
                        />
                        <span className="inline-flex items-center gap-1.5"><ClipboardList aria-hidden="true" /> Show on reservation form</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <AdminEmptyState title="Select a product" description="Choose a product from the left sidebar to edit." />
          )}
        </main>
      </div>
    )}

      {/* LIVE MOBILE STOREFRONT PREVIEW DRAWER */}
      {showPreviewDrawer && selectedRow && (
        <PreviewDrawer row={selectedRow} onClose={() => setShowPreviewDrawer(false)} />
      )}

      {/* ARCHIVE CONFIRMATION MODAL */}
      {showArchiveConfirm && selectedRow && (
        <div className="admin-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowArchiveConfirm(false)}>
          <div className="admin-dialog card max-w-md w-full p-5 flex flex-col gap-3 shadow-2xl rounded-2xl">
            <p className="eyebrow text-amber-900">Confirm archive</p>
            <h3 className="text-lg font-bold text-ink">Archive {selectedRow.product.nameFi}?</h3>
            <p className="text-xs muted leading-relaxed">
              Archiving hides this product from the customer storefront and reservation portal. Historical order records and audit receipts will be preserved intact.
            </p>
            <div className="profile-actions justify-end gap-2 mt-2 pt-3 border-t border-line">
              <button className="btn btn-secondary text-xs" type="button" onClick={() => setShowArchiveConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 shadow-md"
                type="button"
                onClick={() => {
                  setShowArchiveConfirm(false);
                  void handleToggleActive(false);
                }}
              >
                <Archive aria-hidden="true" /> Archive product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UN-ARCHIVE CONFIRMATION MODAL */}
      {showUnarchiveConfirm && selectedRow && (
        <div className="admin-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowUnarchiveConfirm(false)}>
          <div className="admin-dialog card max-w-md w-full p-5 flex flex-col gap-3 shadow-2xl rounded-2xl">
            <p className="eyebrow text-emerald-800">Confirm restore</p>
            <h3 className="text-lg font-bold text-ink">Un-archive {selectedRow.product.nameFi}?</h3>
            <p className="text-xs muted leading-relaxed">
              Un-archiving restores this product to active status in your product catalog. Check availability dates to ensure storefront ordering is ready.
            </p>
            <div className="profile-actions justify-end gap-2 mt-2 pt-3 border-t border-line">
              <button className="btn btn-secondary text-xs" type="button" onClick={() => setShowUnarchiveConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-4 shadow-md"
                type="button"
                onClick={() => {
                  setShowUnarchiveConfirm(false);
                  void handleToggleActive(true);
                }}
              >
                <ArchiveRestore aria-hidden="true" /> Restore product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && selectedRow && (
        <div className="admin-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowDeleteConfirm(false)}>
          <div className="admin-dialog card max-w-md w-full p-5 flex flex-col gap-3 shadow-2xl rounded-2xl">
            <p className="eyebrow text-danger">Confirm permanent delete</p>
            <h3 className="text-lg font-bold text-ink">Delete {selectedRow.product.nameFi}?</h3>
            <p className="text-xs muted leading-relaxed">
              Permanently delete this product from the database? This action cannot be undone. If historical orders exist, deletion will be blocked and the product will be archived instead.
            </p>
            <div className="profile-actions justify-end gap-2 mt-2 pt-3 border-t border-line">
              <button className="btn btn-secondary text-xs" type="button" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger text-xs font-bold py-2 px-4 shadow-md"
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  void handleDeleteOrArchive();
                }}
              >
                <Trash2 aria-hidden="true" /> Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
