"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Edit3, Phone, MessageSquare, Share2, ExternalLink, PlusCircle, GitMerge, Trash2, UserPlus, Search } from "lucide-react";
import { AdminEmptyState, AdminNotice, AdminStatusBadge, formatAdminMoney } from "../presentation";
import { AdminPagination, AdminSidebarInfiniteFooter } from "../ui/admin-pagination";
import { AdminRowActionMenu, IconCopy, IconDocument, IconEye } from "../ui/admin-row-action-menu";
import { CustomerModal } from "./customer-modal";
import { MergeModal } from "./merge-modal";

type CustomerRow = {
  id: string;
  name: string;
  mobile: string | null;
  email?: string | null;
  matchStatus: string;
  marketingConsent: boolean;
  marketingConsentStatus: string;
  marketingConsentAt?: string | null;
  marketingConsentSource?: string | null;
  marketingConsentUpdatedBy?: string | null;
  notes?: string | null;
  facebookProfile?: string | null;
  updatedAt: string;
  metrics?: {
    totalOrders: number;
    completedOrders: number;
    noShowCount: number;
    reliabilityRatePercent: number;
    lifetimeLitres: number;
    totalSpendCents: number;
    lastFulfillmentDate: string | null;
    isVip: boolean;
    preferredMethod: "PICKUP" | "DELIVERY";
    reviewCount?: number;
    averageRating?: number | null;
    primaryAddress?: string | null;
  };
};

type OrderItem = {
  id: string;
  publicReference: string;
  productId?: string;
  productNameFi: string;
  packageLabelFi: string;
  status: string;
  fulfillmentDate: string;
  fulfillmentMethod: "PICKUP" | "DELIVERY";
  volumeMl: number;
  finalTotalCents?: number | null;
  itemSubtotalCents?: number;
  createdAt: string;
};

type ReviewItem = {
  id: string;
  rating: number;
  originalText: string;
  displayText?: string | null;
  status: string;
  featured: boolean;
  verifiedBuyer: boolean;
  orderId?: string | null;
  sellerReplyText?: string | null;
  sellerRepliedAt?: string | null;
  createdAt: string;
};

type ProfileData = {
  customer: CustomerRow;
  orders: OrderItem[];
  reviews?: ReviewItem[];
  timelineByYear: Record<string, OrderItem[]>;
  audit: Array<{ id: string; action: string; actor: string; createdAt: string }>;
  metrics: NonNullable<CustomerRow["metrics"]>;
  identityConflicts: Array<{ id: string; name: string; mobile: string | null; email?: string | null }>;
};

function formatLitres(ml: number) {
  return `${(ml / 1000).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} L`;
}

function cleanPhoneForWhatsApp(mobile?: string | null) {
  if (!mobile) return "";
  const digits = mobile.replace(/\D/g, "");
  if (digits.startsWith("358")) return digits;
  if (digits.startsWith("0")) return `358${digits.slice(1)}`;
  return digits;
}

export function MasterDetailCustomerWorkspace({
  initialCustomers,
  canEdit,
  canAnonymize,
}: {
  initialCustomers: CustomerRow[] | { items: CustomerRow[]; summary?: { totalCustomers: number; vipCount: number; totalLitres: number; consentCount: number } };
  canEdit: boolean;
  canAnonymize: boolean;
}) {
  const rawList = Array.isArray(initialCustomers) ? initialCustomers : (initialCustomers?.items ?? []);
  const [customersList, setCustomersList] = useState<CustomerRow[]>(rawList);
  const [selectedId, setSelectedId] = useState<string>(rawList[0]?.id ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterChip, setFilterChip] = useState<"all" | "vip" | "conflicts" | "consent">("all");
  const [sortMode, setSortMode] = useState<"recent" | "spend_desc" | "litres_desc" | "name_asc">("recent");
  const [workspaceView, setWorkspaceView] = useState<"table" | "split">("table");
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const [tableSortField, setTableSortField] = useState<"name" | "volume" | "spend" | "status">("name");
  const [tableSortDirection, setTableSortDirection] = useState<"asc" | "desc">("asc");

  function handleHeaderSort(field: "name" | "volume" | "spend" | "status") {
    if (tableSortField === field) {
      setTableSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setTableSortField(field);
      setTableSortDirection(field === "name" ? "asc" : "desc");
    }
  }

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);
  const [mergingDuplicate, setMergingDuplicate] = useState<{ id: string; name: string; mobile: string | null; email?: string | null } | null>(null);
  const [showAnonymizeConfirm, setShowAnonymizeConfirm] = useState(false);

  const [editingNoteText, setEditingNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const selectedRow = useMemo(() => {
    return customersList.find((c) => c.id === selectedId) ?? customersList[0];
  }, [customersList, selectedId]);

  async function loadProfile(id: string) {
    setSelectedId(id);
    setMobileView("detail");
    setLoadingProfile(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/customers/${id}`);
      const body = await response.json();
      setLoadingProfile(false);
      if (response.ok && body.data) {
        setProfile(body.data);
        setEditingNoteText(body.data.customer.notes ?? "");
      } else {
        setError(body.message ?? "Could not load customer profile.");
      }
    } catch {
      setLoadingProfile(false);
      setError("Network error while loading profile.");
    }
  }

  // Reload customer list & current profile
  async function refreshList(currentIdToSelect?: string) {
    try {
      const response = await fetch("/api/admin/customers");
      const body = await response.json();
      if (response.ok && body.data) {
        const list = Array.isArray(body.data) ? body.data : (body.data.items ?? []);
        setCustomersList(list);
        const targetId = currentIdToSelect ?? selectedId;
        if (targetId) void loadProfile(targetId);
      }
    } catch {
      /* ignore */
    }
  }

  // Load first profile on mount
  useMemo(() => {
    if (rawList[0]?.id && !profile) {
      void loadProfile(rawList[0].id);
    }
  }, []);

  // Calculate Summary KPI Metrics
  const summaryMetrics = useMemo(() => {
    const totalLitres = customersList.reduce((acc, c) => acc + (c.metrics?.lifetimeLitres ?? 0), 0);
    const vipCount = customersList.filter((c) => c.metrics?.isVip).length;
    const consentCount = customersList.filter((c) => c.marketingConsent).length;
    return {
      totalCustomers: customersList.length,
      vipCount,
      totalLitres,
      consentCount,
    };
  }, [customersList]);

  // Filter & Sort Customer Master List
  const filteredCustomers = useMemo(() => {
    const list = customersList.filter((c) => {
      const text = `${c.name} ${c.mobile ?? ""} ${c.email ?? ""} ${c.facebookProfile ?? ""} ${c.notes ?? ""}`.toLowerCase();
      const matchesSearch = !searchQuery || text.includes(searchQuery.toLowerCase());

      let matchesChip = true;
      if (filterChip === "vip") matchesChip = Boolean(c.metrics?.isVip);
      else if (filterChip === "conflicts") matchesChip = c.matchStatus === "CONFLICT_REVIEW";
      else if (filterChip === "consent") matchesChip = c.marketingConsent;

      return matchesSearch && matchesChip;
    });

    if (sortMode === "spend_desc") {
      list.sort((a, b) => (b.metrics?.totalSpendCents ?? 0) - (a.metrics?.totalSpendCents ?? 0));
    } else if (sortMode === "litres_desc") {
      list.sort((a, b) => (b.metrics?.lifetimeLitres ?? 0) - (a.metrics?.lifetimeLitres ?? 0));
    } else if (sortMode === "name_asc") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    return list;
  }, [customersList, searchQuery, filterChip, sortMode]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
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

  const paginatedCustomers = useMemo(() => {
    const list = [...filteredCustomers];
    list.sort((a, b) => {
      let cmp = 0;
      if (tableSortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (tableSortField === "volume") {
        cmp = (a.metrics?.lifetimeLitres ?? 0) - (b.metrics?.lifetimeLitres ?? 0);
      } else if (tableSortField === "spend") {
        cmp = (a.metrics?.totalSpendCents ?? 0) - (b.metrics?.totalSpendCents ?? 0);
      } else if (tableSortField === "status") {
        cmp = (a.metrics?.isVip ? 1 : 0) - (b.metrics?.isVip ? 1 : 0);
      }
      return tableSortDirection === "asc" ? cmp : -cmp;
    });
    const start = (page - 1) * limit;
    return list.slice(start, start + limit);
  }, [filteredCustomers, tableSortField, tableSortDirection, page, limit]);

  const sidebarDisplayedCustomers = useMemo(() => {
    return filteredCustomers.slice(0, splitLimit);
  }, [filteredCustomers, splitLimit]);

  useEffect(() => {
    setPage(1);
    setSplitLimit(20);
  }, [searchQuery, filterChip, sortMode]);

  // Save Pinned Note
  async function handleSaveNote() {
    if (!profile) return;
    setSavingNote(true);
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/customers/${profile.customer.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "notes", notes: editingNoteText }),
    });

    const body = await response.json();
    setSavingNote(false);

    if (!response.ok) return setError(body.message ?? "Could not save note.");
    setMessage("Pinned staff note saved.");
    void refreshList(profile.customer.id);
  }

  // Anonymize Customer (GDPR Right to be Forgotten)
  async function handleAnonymize() {
    if (!profile) return;
    setShowAnonymizeConfirm(false);
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/customers/${profile.customer.id}`, { method: "POST" });
    const body = await response.json();

    if (!response.ok) return setError(body.message ?? "Anonymization failed.");
    setMessage("Customer personal contact data anonymized. Order ledger totals preserved for accounting.");
    void refreshList();
  }

  // WhatsApp Pre-filled Triggers
  function triggerWhatsApp(templateKind: "READY" | "CONFIRMED") {
    if (!profile) return;
    const cleanPhone = cleanPhoneForWhatsApp(profile.customer.mobile);
    const firstName = profile.customer.name.split(" ")[0] ?? profile.customer.name;

    const msg =
      templateKind === "READY"
        ? `Hei ${firstName}! Marjaeräsi on pakattu ja valmiina noudettavaksi tänään Toriparkista. Tervetuloa! 🫐`
        : `Hei ${firstName}! Kiitos varauksestasi Metsänilolla. Vahvistamme marjavarauksesi. 🫐`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  return (
    <section className="shell pb-10 flex flex-col gap-4">
      {message && <AdminNotice tone="success" live>{message}</AdminNotice>}
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      {/* TOP KPI SUMMARY METRICS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3 flex flex-col gap-1 border-line bg-surface">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <span>👥</span> Total Customers
          </span>
          <strong className="text-xl font-extrabold text-ink">{summaryMetrics.totalCustomers}</strong>
        </div>

        <div className="card p-3 flex flex-col gap-1 border-amber-200 bg-amber-50/40">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
            <span>⭐</span> VIP Buyers (20L+)
          </span>
          <strong className="text-xl font-extrabold text-amber-900">{summaryMetrics.vipCount}</strong>
        </div>

        <div className="card p-3 flex flex-col gap-1 border-emerald-200 bg-emerald-50/40">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
            <span>🫐</span> Berry Volume Sold
          </span>
          <strong className="text-xl font-extrabold text-emerald-900">{formatLitres(summaryMetrics.totalLitres)}</strong>
        </div>

        <div className="card p-3 flex flex-col gap-1 border-line bg-surface">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <span>✉️</span> Marketing Consent
          </span>
          <strong className="text-xl font-extrabold text-ink">{summaryMetrics.consentCount}</strong>
        </div>
      </div>

      {/* WORKSPACE TOOLBAR: SEARCH, SORT, VIEW SWITCHER & NEW CUSTOMER */}
      <div className="card p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <input
              placeholder="Search by name, phone, email, notes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs py-2 px-3 pl-8 rounded-lg border border-line bg-surface"
            />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted pointer-events-none" />
          </div>

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
            className="text-xs py-2 px-2.5 rounded-lg border border-line bg-surface font-medium"
          >
            <option value="recent">🕒 Most Recent Activity</option>
            <option value="spend_desc">💶 Highest Spend (€)</option>
            <option value="litres_desc">🫐 Highest Volume (L)</option>
            <option value="name_asc">🔤 Name (A–Z)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 justify-between sm:justify-end">
          <div className="flex items-center gap-1 bg-surface-muted p-1 rounded-lg border border-line">
            <button
              type="button"
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                workspaceView === "table" ? "bg-surface text-ink shadow-xs" : "text-muted hover:text-ink"
              }`}
              onClick={() => setWorkspaceView("table")}
            >
              📋 Table View
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                workspaceView === "split" ? "bg-surface text-ink shadow-xs" : "text-muted hover:text-ink"
              }`}
              onClick={() => setWorkspaceView("split")}
            >
              🔍 Split View
            </button>
          </div>

          {canEdit && (
            <button type="button" className="btn text-xs py-1.5 px-3 flex items-center gap-1 shrink-0" onClick={() => setShowCreateModal(true)}>
              <PlusCircle className="w-3.5 h-3.5" /> New Customer
            </button>
          )}
        </div>
      </div>

      {/* FILTER CHIPS BAR */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { key: "all", label: `All Customers (${filteredCustomers.length})` },
          { key: "vip", label: "⭐ VIP Buyers" },
          { key: "conflicts", label: "⚠️ Conflicts" },
          { key: "consent", label: "✉️ Marketing" },
        ].map((chip) => (
          <button
            key={chip.key}
            type="button"
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              filterChip === chip.key
                ? "bg-primary text-on-primary shadow-xs"
                : "bg-surface-muted text-ink/70 hover:bg-surface-muted/80"
            }`}
            onClick={() => setFilterChip(chip.key as typeof filterChip)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* MOBILE STICKY NAVIGATION HEADER (Visible when inspecting a customer on mobile screens) */}
      {mobileView === "detail" && workspaceView === "split" && (
        <div className="lg:hidden sticky top-2 z-20 bg-surface border border-line p-3 flex items-center justify-between shadow-sm rounded-xl">
          <button
            type="button"
            className="btn btn-secondary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5"
            onClick={() => setMobileView("list")}
          >
            ← Back to Customer List
          </button>
          <span className="text-xs font-bold text-ink truncate max-w-[160px]">{profile?.customer.name}</span>
        </div>
      )}

      {/* SCALABLE FULL-WIDTH DATA TABLE VIEW */}
      {workspaceView === "table" ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-muted border-b border-line text-muted font-bold uppercase text-[10px] tracking-wider">
                  {[
                    { key: "name", label: "Customer" },
                    { key: "contact", label: "Contact" },
                    { key: "volume", label: "Lifetime Volume" },
                    { key: "spend", label: "Total Spend" },
                    { key: "orders", label: "Orders" },
                    { key: "status", label: "Status / Tags" },
                  ].map((col) => {
                    const isSortable = ["name", "volume", "spend", "status"].includes(col.key);
                    return (
                      <th
                        key={col.key}
                        className={`p-3 ${isSortable ? "cursor-pointer select-none hover:bg-slate-200/60 transition-colors" : ""}`}
                        onClick={() => {
                          if (isSortable) handleHeaderSort(col.key as any);
                        }}
                      >
                        <div className="inline-flex items-center gap-1">
                          <span>{col.label}</span>
                          {isSortable && (
                            <span className={`text-[10px] font-bold ${tableSortField === col.key ? "text-primary opacity-100" : "text-slate-400 opacity-40"}`}>
                              {tableSortField === col.key ? (tableSortDirection === "asc" ? "▲" : "▼") : "↕"}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {paginatedCustomers.map((c) => (
                  <tr
                    key={c.id}
                    className={`hover:bg-primary/5 transition-colors cursor-pointer ${
                      c.id === selectedId ? "bg-primary/5 font-medium" : ""
                    }`}
                    onClick={() => {
                      void loadProfile(c.id);
                      setWorkspaceView("split");
                      setMobileView("detail");
                    }}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                          {c.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <strong className="text-ink text-xs font-bold truncate">{c.name}</strong>
                            {c.metrics?.isVip && (
                              <span className="text-xs cursor-help select-none" title="VIP High-Volume Buyer (20L+)">
                                👑
                              </span>
                            )}
                          </div>
                          {c.facebookProfile && <span className="text-[10px] text-muted truncate block">{c.facebookProfile}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      <div className="flex items-center gap-1">
                        <span>{c.mobile || "—"}</span>
                        {c.mobile && (
                          <button
                            type="button"
                            className="p-0.5 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              void navigator.clipboard.writeText(c.mobile!);
                              setMessage(`Copied ${c.mobile} to clipboard.`);
                            }}
                            title="Copy Mobile Phone"
                          >
                            <IconCopy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] text-muted">{c.email || ""}</div>
                    </td>
                    <td className="p-3 font-bold text-forest">
                      {formatLitres(c.metrics?.lifetimeLitres ?? 0)}
                    </td>
                    <td className="p-3 font-bold text-ink">
                      {formatAdminMoney(c.metrics?.totalSpendCents ?? 0)}
                    </td>
                    <td className="p-3">
                      {c.metrics?.completedOrders ?? 0} finished
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {Boolean(c.metrics?.averageRating) && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300">
                            ⭐ {c.metrics?.averageRating} ({c.metrics?.reviewCount})
                          </span>
                        )}
                        {c.matchStatus === "CONFLICT_REVIEW" && (
                          <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">
                            ⚠️ Conflict
                          </span>
                        )}
                        {c.marketingConsent && (
                          <span className="text-[10px] font-bold text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded">
                            ✉️ Consent
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <AdminRowActionMenu
                        items={[
                          {
                            id: "view-profile",
                            label: "View Profile & Orders",
                            icon: <IconEye />,
                            onClick: () => {
                              void loadProfile(c.id);
                              setWorkspaceView("split");
                              setMobileView("detail");
                            },
                          },
                          ...(c.matchStatus === "CONFLICT_REVIEW"
                            ? [
                                {
                                  id: "resolve-conflict",
                                  label: "Resolve Conflict",
                                  icon: <span className="text-amber-600 font-bold">⚠️</span>,
                                  onClick: () => {
                                    void loadProfile(c.id);
                                    setWorkspaceView("split");
                                    setMobileView("detail");
                                  },
                                },
                              ]
                            : []),
                          {
                            id: "view-notes",
                            label: "View Pinned Notes",
                            icon: <IconDocument />,
                            onClick: () => {
                              void loadProfile(c.id);
                              setWorkspaceView("split");
                              setMobileView("detail");
                            },
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}

                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center">
                      <AdminEmptyState title="No customers found" description="Adjust search query or filter chips." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <AdminPagination
            page={page}
            limit={limit}
            total={filteredCustomers.length}
            onPageChange={setPage}
            onLimitChange={(newLimit) => setLimit(newLimit)}
            itemLabel="customers"
          />
        </div>
      ) : (
        /* MASTER-DETAIL SPLIT WORKSPACE GRID */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT MASTER SIDEBAR (4 Cols) */}
          <aside className={`lg:col-span-4 card p-4 flex flex-col gap-3 max-h-[85vh] sticky top-4 ${mobileView === "detail" ? "hidden lg:flex" : "flex"}`}>
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div>
                <span className="eyebrow">CUSTOMER LIST</span>
                <h2 className="text-base font-bold text-ink">Customers ({filteredCustomers.length})</h2>
              </div>
            </div>

            {/* Customer Master Items List */}
            <div
              className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1"
              onScroll={(e) => {
                const target = e.currentTarget;
                if (target.scrollTop + target.clientHeight >= target.scrollHeight - 40) {
                  if (splitLimit < filteredCustomers.length) {
                    setSplitLimit((prev) => Math.min(prev + 20, filteredCustomers.length));
                  }
                }
              }}
            >
              {sidebarDisplayedCustomers.map((customer) => {
                const isSelected = customer.id === selectedId;
                const litresStr = formatLitres(customer.metrics?.lifetimeLitres ?? 0);
                const spendStr = formatAdminMoney(customer.metrics?.totalSpendCents ?? 0);

                return (
                  <div
                    key={customer.id}
                    className={`flex flex-col gap-2 p-3 rounded-xl border text-left transition-all cursor-pointer min-h-fit h-auto overflow-hidden customer-card-item ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                        : "border-line bg-surface hover:border-muted"
                    }`}
                    onClick={() => void loadProfile(customer.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 shrink-0 flex items-center justify-center font-bold text-primary text-sm">
                        {customer.name.slice(0, 1).toUpperCase()}
                      </div>

                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <strong className="text-sm font-bold text-ink truncate">{customer.name}</strong>
                          {customer.metrics?.isVip && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                              ⭐ VIP
                            </span>
                          )}
                        </div>

                        <span className="text-xs text-muted font-mono truncate">{customer.mobile || "No phone"}</span>

                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-muted font-medium">
                          <span className="font-bold text-forest">{litresStr}</span>
                          <span>•</span>
                          <span className="font-bold text-ink">{spendStr}</span>
                          <span>•</span>
                          <span>{customer.metrics?.totalOrders ?? 0} orders</span>
                          {Boolean(customer.metrics?.averageRating) && (
                            <>
                              <span>•</span>
                              <span className="font-bold text-amber-700">⭐ {customer.metrics?.averageRating}</span>
                            </>
                          )}
                        </div>

                        {customer.matchStatus === "CONFLICT_REVIEW" && (
                          <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded mt-1 inline-block w-fit">
                            ⚠️ Phone Conflict Review
                          </span>
                        )}
                      </div>
                    </div>

                    {/* MOBILE QUICK ACTION SHORTCUTS (CALL & WHATSAPP) */}
                    {customer.mobile && (
                      <div className="flex items-center gap-2 pt-2 border-t border-line/40 text-xs">
                        <a
                          href={`tel:${customer.mobile}`}
                          className="btn btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 text-emerald-800 border-emerald-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="w-3 h-3" /> Call
                        </a>
                        <a
                          href={`https://wa.me/${cleanPhoneForWhatsApp(customer.mobile)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn text-[11px] py-1 px-2.5 flex items-center gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessageSquare className="w-3 h-3" /> WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredCustomers.length === 0 && (
                <AdminEmptyState title="No customers found" description="Adjust search query or filter chips." />
              )}
            </div>

            <AdminSidebarInfiniteFooter
              displayed={sidebarDisplayedCustomers.length}
              total={filteredCustomers.length}
              onLoadMore={() => setSplitLimit((prev) => Math.min(prev + 20, filteredCustomers.length))}
              itemLabel="customers"
            />
          </aside>

          {/* RIGHT DETAIL WORKSPACE PANE (8 Cols) */}
          <main className={`lg:col-span-8 flex flex-col gap-4 ${mobileView === "list" ? "hidden lg:flex" : "flex"}`}>
          {profile ? (
            <div className="flex flex-col gap-4">
              {/* PROFILE HEADER CARD & OMNICHANNEL FAST-COMMUNICATION BAR */}
              <div className="card p-4 md:p-5 flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary text-on-primary flex items-center justify-center text-2xl font-bold shadow-md shrink-0">
                      {profile.customer.name.slice(0, 1).toUpperCase()}
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight text-ink">{profile.customer.name}</h1>
                        {profile.metrics.isVip && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            👑 VIP High-Volume Buyer (20L+)
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs muted font-medium">
                        <span className="font-mono text-ink font-semibold flex items-center gap-1">
                          📞 {profile.customer.mobile}
                          {profile.customer.mobile && (
                            <button
                              type="button"
                              className="p-0.5 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer"
                              onClick={() => {
                                void navigator.clipboard.writeText(profile.customer.mobile!);
                                setMessage(`Copied phone ${profile.customer.mobile} to clipboard.`);
                              }}
                              title="Copy Phone Number"
                            >
                              <IconCopy className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                        {profile.customer.email && (
                          <span className="flex items-center gap-1">
                            ✉️ {profile.customer.email}
                            <button
                              type="button"
                              className="p-0.5 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer"
                              onClick={() => {
                                void navigator.clipboard.writeText(profile.customer.email!);
                                setMessage(`Copied email ${profile.customer.email} to clipboard.`);
                              }}
                              title="Copy Email"
                            >
                              <IconCopy className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {profile.customer.facebookProfile && (
                          <a
                            href={profile.customer.facebookProfile.startsWith("http") ? profile.customer.facebookProfile : `https://facebook.com/${profile.customer.facebookProfile.replace(/^@/, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 hover:underline font-semibold flex items-center gap-1"
                          >
                            📘 {profile.customer.facebookProfile}
                          </a>
                        )}
                        <span>📍 Preferred: <strong>{profile.metrics.preferredMethod === "DELIVERY" ? "Home Delivery" : "Pickup"}</strong></span>
                      </div>

                      {/* CUSTOMER PRIMARY DELIVERY ADDRESS CARD */}
                      {profile.metrics.primaryAddress && (
                        <div className="flex items-center justify-between p-2.5 bg-surface-muted/80 rounded-xl border border-line text-xs mt-2">
                          <span className="font-semibold text-ink flex items-center gap-1.5">
                            <span>📍</span> Delivery Address: <strong className="text-ink">{profile.metrics.primaryAddress}</strong>
                          </span>
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            onClick={() => {
                              void navigator.clipboard.writeText(profile.metrics.primaryAddress!);
                              setMessage("Copied delivery address to clipboard.");
                            }}
                            title="Copy Delivery Address"
                          >
                            <IconCopy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Edit Button */}
                  {canEdit && (
                    <button
                      type="button"
                      className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold"
                      onClick={() => setEditingCustomer(profile.customer)}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Profile</span>
                    </button>
                  )}
                </div>

                {/* OMNICHANNEL FAST-COMMUNICATION TOOLBAR */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-surface-muted rounded-xl border border-line">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">1-Tap Fast Contact:</span>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* WhatsApp Action Pills */}
                    {profile.customer.mobile && (
                      <>
                        <button
                          type="button"
                          className="btn text-xs py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-on-primary font-bold flex items-center gap-1.5 shadow-sm rounded-lg"
                          onClick={() => triggerWhatsApp("READY")}
                          title="Open WhatsApp with pre-filled Ready for Pickup notification"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>💬 Valmis (Ready)</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary text-xs py-1.5 px-3 font-semibold flex items-center gap-1.5 rounded-lg"
                          onClick={() => triggerWhatsApp("CONFIRMED")}
                          title="Open WhatsApp with pre-filled Order Confirmed notification"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>💬 Vahvistus (Confirm)</span>
                        </button>

                        <a
                          className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-lg"
                          href={`tel:${profile.customer.mobile}`}
                          title={`Call ${profile.customer.mobile}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>📞 Call</span>
                        </a>
                        <a
                          className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-lg"
                          href={`sms:${profile.customer.mobile}`}
                          title={`SMS ${profile.customer.mobile}`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>✉️ SMS</span>
                        </a>
                      </>
                    )}

                    {profile.customer.facebookProfile && (
                      <a
                        className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-blue-700 font-semibold rounded-lg"
                        href={profile.customer.facebookProfile.startsWith("http") ? profile.customer.facebookProfile : `https://facebook.com/${profile.customer.facebookProfile.replace(/^@/, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>📘 Facebook</span>
                      </a>
                    )}

                    {/* New Order shortcut */}
                    <a className="btn text-xs py-1.5 px-3 font-semibold flex items-center gap-1.5 rounded-lg" href="/admin/manual-orders">
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>New Order</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* KEY METRICS & RELIABILITY SCORE CARD */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="card p-3 flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider muted">Total Volume</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-2xl font-bold text-ink ops-tabular">
                      {formatLitres(profile.metrics.lifetimeLitres)}
                    </span>
                    <span className="text-xs text-muted">harvested</span>
                  </div>
                </div>

                <div className="card p-3 flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Lifetime Spend</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-2xl font-bold text-primary ops-tabular">
                      {formatAdminMoney(profile.metrics.totalSpendCents)}
                    </span>
                    <span className="text-xs text-primary/70 font-semibold">Euros</span>
                  </div>
                </div>

                <div className="card p-3 flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Customer Sentiment</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-2xl font-bold text-amber-800 ops-tabular flex items-center gap-1">
                      {profile.metrics.averageRating ? `⭐ ${profile.metrics.averageRating}` : "—"}
                    </span>
                    <span className="text-xs text-amber-900 font-semibold">
                      {profile.metrics.reviewCount ? `${profile.metrics.reviewCount} review(s)` : "No reviews"}
                    </span>
                  </div>
                </div>

                <div className="card p-3 flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Reliability Rate</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-2xl font-bold text-emerald-700 ops-tabular">
                      {profile.metrics.reliabilityRatePercent}%
                    </span>
                    <span className="text-xs text-emerald-600 font-semibold">
                      {profile.metrics.completedOrders} of {profile.metrics.completedOrders + profile.metrics.noShowCount} OK
                    </span>
                  </div>
                </div>

                <div className="card p-3 flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-700">No-Show Risk</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className={`text-2xl font-bold ops-tabular ${profile.metrics.noShowCount > 0 ? "text-danger" : "text-slate-600"}`}>
                      {profile.metrics.noShowCount}
                    </span>
                    <span className="text-xs muted font-semibold">
                      {profile.metrics.noShowCount > 0 ? "⚠️ Past No-Show" : "0 No-Shows"}
                    </span>
                  </div>
                </div>
              </div>

              {/* IDENTITY CONFLICT WARNING BANNER */}
              {profile.identityConflicts.length > 0 && (
                <div className="card p-4 bg-amber-50 border border-amber-300 rounded-xl flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <strong className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                      ⚠️ Identity Conflict Detected
                    </strong>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Found {profile.identityConflicts.length} duplicate record(s) matching phone number {profile.customer.mobile}.
                    </p>
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      className="btn text-xs py-1.5 px-3 bg-amber-800 hover:bg-amber-900 text-on-primary font-bold shadow"
                      onClick={() => setMergingDuplicate(profile.identityConflicts[0])}
                    >
                      🔗 Merge Profiles
                    </button>
                  )}
                </div>
              )}

              {/* PINNED STAFF NOTES CARD */}
              <div className="card p-4 md:p-5 flex flex-col gap-3 bg-amber-50/40 border border-amber-200">
                <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    📌 PINNED STAFF NOTES &amp; HANDLING INSTRUCTIONS
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      className="btn btn-secondary text-xs py-1 px-2.5"
                      onClick={() => void handleSaveNote()}
                      disabled={savingNote}
                    >
                      {savingNote ? "Saving…" : "💾 Save Note"}
                    </button>
                  )}
                </div>

                {canEdit ? (
                  <textarea
                    value={editingNoteText}
                    onChange={(e) => setEditingNoteText(e.target.value)}
                    rows={3}
                    placeholder="Add operational notes (e.g. Prefers berries for freezing, call daughter if no answer, delivery gate code)…"
                    className="w-full text-xs p-3 rounded-xl border border-amber-300 bg-surface focus:ring-2 focus:ring-amber-400"
                  />
                ) : (
                  <p className="text-xs text-amber-950 font-medium whitespace-pre-wrap">
                    {profile.customer.notes || "No special handling instructions added yet."}
                  </p>
                )}
              </div>

              {/* REVIEWS & SENTIMENT FEEDBACK CARD */}
              <div className="card p-4 md:p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div>
                    <span className="eyebrow">CUSTOMER SENTIMENT &amp; FEEDBACK</span>
                    <h3 className="text-base font-bold text-ink flex items-center gap-2">
                      ⭐ Customer Reviews &amp; Testimonials
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                        {profile.reviews?.length ?? 0}
                      </span>
                    </h3>
                  </div>
                  <Link className="btn btn-secondary text-xs py-1.5 px-3 font-semibold" href="/admin/reviews">
                    Manage All Reviews ↗
                  </Link>
                </div>

                <div className="flex flex-col gap-3">
                  {profile.reviews?.map((rev) => (
                    <div key={rev.id} className="p-4 rounded-xl border border-line bg-surface flex flex-col gap-2 text-xs shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/50 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-500 font-bold text-sm tracking-wider">
                            {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
                          </span>
                          <strong className="font-bold text-ink text-sm">{rev.rating}.0 / 5.0</strong>
                          {rev.verifiedBuyer && (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                              ✓ Verified Buyer
                            </span>
                          )}
                          {rev.featured && (
                            <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded border border-purple-300">
                              ✨ Featured
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            rev.status === "APPROVED"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : rev.status === "REJECTED"
                              ? "bg-rose-50 text-rose-800 border-rose-200"
                              : "bg-amber-50 text-amber-900 border-amber-200"
                          }`}>
                            {rev.status}
                          </span>
                          <span className="muted text-[11px] font-mono">{rev.createdAt.slice(0, 10)}</span>
                        </div>
                      </div>

                      <p className="text-ink font-medium text-xs whitespace-pre-wrap leading-relaxed">
                        "{rev.displayText || rev.originalText}"
                      </p>

                      {rev.orderId && (
                        <div className="text-[11px] muted flex items-center gap-1 mt-0.5">
                          <span>Linked Order:</span>
                          <Link className="text-primary hover:underline font-bold font-mono" href={`/admin/orders/${rev.orderId}`}>
                            View Order ↗
                          </Link>
                        </div>
                      )}

                      {rev.sellerReplyText && (
                        <div className="mt-1 p-2.5 bg-surface-muted rounded-lg border-l-4 border-primary text-xs space-y-1">
                          <strong className="text-primary font-bold block text-[11px] uppercase tracking-wider">
                            💬 Official Store Reply ({rev.sellerRepliedAt?.slice(0, 10)})
                          </strong>
                          <p className="text-ink font-medium leading-relaxed">{rev.sellerReplyText}</p>
                        </div>
                      )}
                    </div>
                  ))}

                  {(!profile.reviews || profile.reviews.length === 0) && (
                    <AdminEmptyState
                      title="No reviews submitted yet"
                      description="This customer has not submitted any public reviews or ratings."
                    />
                  )}
                </div>
              </div>

              {/* YEAR-OVER-YEAR SEASONAL BUYING TIMELINE */}
              <div className="card p-4 md:p-5 flex flex-col gap-4">
                <div className="border-b border-line pb-3">
                  <span className="eyebrow">SEASONAL BUYING TIMELINE</span>
                  <h3 className="text-base font-bold text-ink">Order History Grouped by Harvest Season</h3>
                </div>

                <div className="flex flex-col gap-5">
                  {Object.entries(profile.timelineByYear).map(([seasonLabel, seasonOrders]) => (
                    <div key={seasonLabel} className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between bg-surface-muted/60 px-3 py-1.5 rounded-lg border border-line">
                        <strong className="text-xs font-bold text-primary uppercase">{seasonLabel} Harvest</strong>
                        <span className="text-xs muted font-semibold">
                          {seasonOrders.length} order(s) · {formatLitres(seasonOrders.reduce((s, o) => s + o.volumeMl, 0))}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2">
                        {seasonOrders.map((order) => (
                          <div
                            key={order.id}
                            className="p-3 rounded-xl border border-line bg-surface flex flex-wrap items-center justify-between gap-3 text-xs hover:border-muted transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Link
                                className="font-bold text-primary hover:underline ops-tabular"
                                href={`/admin/orders/${order.id}`}
                              >
                                {order.publicReference}
                              </Link>
                              <AdminStatusBadge status={order.status} />
                              <span className="font-bold text-ink">{order.productNameFi}</span>
                              <span className="muted">({order.packageLabelFi})</span>
                            </div>

                            <div className="flex items-center gap-4 text-xs">
                              <span className="muted">{order.fulfillmentDate}</span>
                              <span className="font-bold text-ink ops-tabular">
                                {formatLitres(order.volumeMl)}
                              </span>
                              <strong className="text-primary ops-tabular font-bold">
                                {formatAdminMoney(order.finalTotalCents ?? order.itemSubtotalCents ?? 0)}
                              </strong>
                              <Link className="text-[11px] font-semibold text-primary hover:underline" href={`/admin/orders/${order.id}`}>
                                View ↗
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {profile.orders.length === 0 && (
                    <AdminEmptyState title="No orders yet" description="This customer has not placed any pre-orders." />
                  )}
                </div>
              </div>

              {/* GDPR COMPLIANCE & SAFE ANONYMIZATION CARD */}
              <div className="card p-4 md:p-5 flex flex-wrap items-center justify-between gap-4 bg-surface-muted/30">
                <div className="flex flex-col gap-1 text-xs">
                  <strong className="font-bold text-ink uppercase tracking-wider text-[11px]">
                    🛡️ GDPR Compliance &amp; Consent Governance
                  </strong>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[11px] border ${
                        profile.customer.marketingConsent
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-surface-muted text-muted border-line"
                      }`}
                    >
                      {profile.customer.marketingConsent ? "Marketing Consented" : "Do Not Send Marketing"}
                    </span>
                    {profile.customer.marketingConsentSource && (
                      <span className="muted text-[11px]">
                        Source: {profile.customer.marketingConsentSource} ({profile.customer.marketingConsentAt?.slice(0, 10)})
                      </span>
                    )}
                  </div>
                </div>

                {canAnonymize && (
                  <button
                    type="button"
                    className="btn btn-secondary text-xs text-danger py-1.5 px-3"
                    onClick={() => setShowAnonymizeConfirm(true)}
                  >
                    🛡️ Anonymize Customer (Right to be Forgotten)
                  </button>
                )}
              </div>
            </div>
          ) : loadingProfile ? (
            <AdminEmptyState title="Loading profile…" description="Fetching Customer 360 context." />
          ) : (
            <AdminEmptyState title="Select a customer" description="Choose a customer from the left master list." />
          )}
        </main>
      </div>
      )}

      {/* CREATE / EDIT CUSTOMER MODAL */}
      {(showCreateModal || editingCustomer) && (
        <CustomerModal
          editingCustomer={editingCustomer}
          onClose={() => {
            setShowCreateModal(false);
            setEditingCustomer(null);
          }}
          onSaved={() => void refreshList()}
        />
      )}

      {/* IDENTITY MERGE MODAL */}
      {mergingDuplicate && profile && (
        <MergeModal
          primaryCustomer={profile.customer}
          duplicateCustomer={mergingDuplicate}
          onClose={() => setMergingDuplicate(null)}
          onMerged={() => {
            setMergingDuplicate(null);
            setMessage("Profiles merged successfully.");
            void refreshList(profile.customer.id);
          }}
        />
      )}

      {/* ANONYMIZE CONFIRMATION DIALOG */}
      {showAnonymizeConfirm && profile && (
        <div className="admin-dialog-backdrop">
          <div className="admin-dialog card max-w-sm w-full p-5 flex flex-col gap-3">
            <p className="eyebrow text-danger">GDPR RIGHT TO BE FORGOTTEN</p>
            <h3 className="text-lg font-bold text-ink">Anonymize {profile.customer.name}?</h3>
            <p className="text-xs muted leading-relaxed">
              This will permanently erase the customer&apos;s name, phone, and email, replacing them with &quot;Anonymized customer&quot;. Financial ledger totals and litres sold will remain in your reports for accounting compliance.
            </p>
            <div className="profile-actions justify-end gap-2 mt-2">
              <button className="btn btn-secondary text-xs" type="button" onClick={() => setShowAnonymizeConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-danger text-xs font-bold" type="button" onClick={() => void handleAnonymize()}>
                Confirm Anonymization
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
