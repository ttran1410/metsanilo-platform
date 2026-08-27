"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CircleCheck, Edit3, ExternalLink, GitMerge, Info, LayoutList, Mail, MapPin, MessageSquare, PanelLeft, Phone, Pin, Plus, PlusCircle, Save, Search, ShieldAlert, ShieldCheck, Star } from "lucide-react";
import { AdminEmptyState, AdminNotice, AdminPageHeader, AdminStatusBadge, formatAdminMoney } from "../presentation";
import { AdminPagination, AdminSidebarInfiniteFooter } from "../ui/admin-pagination";
import { AdminRowActionMenu, IconCopy, IconDocument, IconEye } from "../ui/admin-row-action-menu";
import { CustomerModal } from "./customer-modal";
import { MergeModal } from "./merge-modal";

export type CustomerRow = {
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
  contactConfirmationExpiresAt?: string | null;
  retentionHoldUntil?: string | null;
  retentionHoldReason?: string | null;
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

type CustomerTableSortField = "name" | "volume" | "spend" | "status";

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

function maskPhone(mobile?: string | null) {
  if (!mobile) return "No phone";
  const compact = mobile.replace(/\s/g, "");
  if (compact.length <= 6) return compact;
  return `${compact.slice(0, 4)} ••• ${compact.slice(-4)}`;
}

export function MasterDetailCustomerWorkspace({
  initialCustomers,
  canEdit,
  canAnonymize,
  canRetention,
}: {
  initialCustomers: CustomerRow[] | { items: CustomerRow[]; summary?: { totalCustomers: number; vipCount: number; totalLitres: number; consentCount: number } };
  canEdit: boolean;
  canAnonymize: boolean;
  canRetention: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawList = Array.isArray(initialCustomers) ? initialCustomers : (initialCustomers?.items ?? []);
  const [customersList, setCustomersList] = useState<CustomerRow[]>(rawList);
  const [selectedId, setSelectedId] = useState<string>(searchParams.get("customer") ?? rawList[0]?.id ?? "");
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") ?? "");
  const [filterChip, setFilterChip] = useState<"all" | "vip" | "conflicts" | "consent">(() => searchParams.get("filter") as "all" | "vip" | "conflicts" | "consent" || "all");
  const [sortMode, setSortMode] = useState<"recent" | "spend_desc" | "litres_desc" | "name_asc">(() => searchParams.get("sort") as "recent" | "spend_desc" | "litres_desc" | "name_asc" || "recent");
  const [workspaceView, setWorkspaceView] = useState<"table" | "split">(() => searchParams.get("view") === "table" ? "table" : "split");
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
  const [confirmationChannel, setConfirmationChannel] = useState<"WHATSAPP" | "SMS" | "PHONE" | "OTHER">("PHONE");
  const [retentionBusy, setRetentionBusy] = useState(false);
  const [holdUntil, setHoldUntil] = useState("");
  const [holdReason, setHoldReason] = useState("");

  const [editingNoteText, setEditingNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  async function loadProfile(id: string, showDetail = true) {
    setSelectedId(id);
    if (showDetail) setMobileView("detail");
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

  // Load the first profile once the client workspace mounts.
  useEffect(() => {
    if (selectedId && !profile) {
      // This initial fetch hydrates profile state from the server-provided list.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadProfile(selectedId, false);
    }
    // The initial profile is intentionally loaded once from the server-provided list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const emptyListTitle = "No customers found";
  const emptyListDescription = "Adjust search query or filter chips.";

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [splitLimit, setSplitLimit] = useState(20);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (selectedId) next.set("customer", selectedId); else next.delete("customer");
    if (searchQuery) next.set("q", searchQuery); else next.delete("q");
    if (filterChip !== "all") next.set("filter", filterChip); else next.delete("filter");
    if (sortMode !== "recent") next.set("sort", sortMode); else next.delete("sort");
    if (workspaceView !== "split") next.set("view", workspaceView); else next.delete("view");
    if (page > 1) next.set("page", String(page)); else next.delete("page");
    if (next.toString() !== searchParams.toString()) router.replace(`?${next.toString()}`, { scroll: false });
  }, [filterChip, page, router, searchParams, searchQuery, selectedId, sortMode, workspaceView]);

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
    if (filteredCustomers.length === 0) return;
    if (selectedId && filteredCustomers.some((customer) => customer.id === selectedId)) return;
    const first = filteredCustomers[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(first.id);
    void loadProfile(first.id, false);
  }, [filteredCustomers, selectedId]);

  useEffect(() => {
    // Return to the first page when the visible customer set changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  async function handleConfirmContact() {
    if (!profile || retentionBusy) return;
    setRetentionBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/customers/${profile.customer.id}/contact-confirmation`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: confirmationChannel }) });
      const body = await response.json();
      if (!response.ok) return setError(body.message ?? "Could not confirm customer contact.");
      setMessage(`Contact confirmation saved through ${confirmationChannel.toLowerCase()}.`);
      await refreshList(profile.customer.id);
    } finally { setRetentionBusy(false); }
  }

  async function handleRetentionHold() {
    if (!profile || retentionBusy || !holdUntil || holdReason.trim().length < 3) return;
    setRetentionBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/customers/${profile.customer.id}/retention-hold`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ until: new Date(`${holdUntil}T23:59:59Z`).toISOString(), reason: holdReason }) });
      const body = await response.json();
      if (!response.ok) return setError(body.message ?? "Could not create retention hold.");
      setMessage("Retention hold saved."); setHoldReason(""); await refreshList(profile.customer.id);
    } finally { setRetentionBusy(false); }
  }

  async function clearRetentionHold() {
    if (!profile || retentionBusy) return;
    setRetentionBusy(true); setError("");
    try { const response = await fetch(`/api/admin/customers/${profile.customer.id}/retention-hold`, { method: "DELETE" }); const body = await response.json(); if (!response.ok) return setError(body.message ?? "Could not release retention hold."); setMessage("Retention hold released."); await refreshList(profile.customer.id); } finally { setRetentionBusy(false); }
  }

  return (
    <section className="admin-customers-workspace shell pb-10 flex flex-col gap-4">
      {message && <AdminNotice tone="success" live>{message}</AdminNotice>}
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      <div className="customers-page-heading">
        <AdminPageHeader
          eyebrow="Relationships"
          title="Customers"
          description={`${customersList.length} customer${customersList.length === 1 ? "" : "s"} · Search safely, inspect the relationship, then take the next action.`}
        />
        {canEdit && <button type="button" className="btn" onClick={() => setShowCreateModal(true)}><Plus aria-hidden="true" />New customer</button>}
      </div>

      {/* WORKSPACE TOOLBAR: SEARCH, SORT, VIEW SWITCHER & NEW CUSTOMER */}
      <div className="card customers-toolbar">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <input
              placeholder="Search customers by name, phone, email, or notes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs py-2 px-3 pl-9 rounded-lg border border-line bg-surface"
            />
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted pointer-events-none" />
          </div>

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
            className="text-xs py-2 px-2.5 rounded-lg border border-line bg-surface font-medium"
          >
            <option value="recent">Most recent activity</option>
            <option value="spend_desc">Highest spend (€)</option>
            <option value="litres_desc">Highest volume (L)</option>
            <option value="name_asc">Name (A–Z)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 justify-between sm:justify-end">
          <div className="customers-view-switch" role="tablist" aria-label="Customer workspace view">
            <button
              type="button"
              role="tab"
              aria-selected={workspaceView === "split"}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                workspaceView === "split" ? "bg-surface text-ink shadow-xs" : "text-muted hover:text-ink"
              }`}
              onClick={() => setWorkspaceView("split")}
            >
              <PanelLeft aria-hidden="true" />Profiles
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workspaceView === "table"}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                workspaceView === "table" ? "bg-surface text-ink shadow-xs" : "text-muted hover:text-ink"
              }`}
              onClick={() => setWorkspaceView("table")}
            >
              <LayoutList aria-hidden="true" />Table
            </button>
          </div>
        </div>
      </div>

      {/* FILTER CHIPS BAR */}
      <div className="customers-saved-views" role="tablist" aria-label="Customer saved views">
        {[
          { key: "all", label: "All", count: customersList.length },
          { key: "vip", label: "High value", count: customersList.filter((customer) => customer.metrics?.isVip).length },
          { key: "conflicts", label: "Identity conflicts", count: customersList.filter((customer) => customer.matchStatus === "CONFLICT_REVIEW").length },
          { key: "consent", label: "Marketing consent", count: customersList.filter((customer) => customer.marketingConsent).length },
        ].map((chip) => (
          <button
            key={chip.key}
            type="button"
            role="tab"
            aria-selected={filterChip === chip.key}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              filterChip === chip.key
                ? "bg-primary text-on-primary shadow-xs"
                : "bg-surface-muted text-ink/70 hover:bg-surface-muted/80"
            }`}
            onClick={() => {
              setFilterChip(chip.key as typeof filterChip);
              setSelectedId("");
              setProfile(null);
              setMobileView("list");
            }}
          >
            <span>{chip.label}</span><b>{chip.count}</b>
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
            <ArrowLeft aria-hidden="true" />Back to customers
          </button>
          <span className="text-xs font-bold text-ink truncate max-w-[160px]">{profile?.customer.name}</span>
        </div>
      )}

      {/* SCALABLE FULL-WIDTH DATA TABLE VIEW */}
      {workspaceView === "table" ? (
        <div className="card overflow-hidden customer-table-card">
          <div className="customer-table-wrap">
            <table className="customer-table w-full text-left border-collapse text-xs">
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
                          if (isSortable) handleHeaderSort(col.key as CustomerTableSortField);
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
                    <td data-label="Customer" className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                          {c.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <strong className="text-ink text-xs font-bold truncate">{c.name}</strong>
                            {c.metrics?.isVip && (
                              <Star className="customer-vip-icon" aria-label="High-value customer" />
                            )}
                          </div>
                          {c.facebookProfile && <span className="text-[10px] text-muted truncate block">{c.facebookProfile}</span>}
                        </div>
                      </div>
                    </td>
                    <td data-label="Contact" className="p-3 font-mono text-[11px]">
                      <div className="flex items-center gap-1">
                        <span>{maskPhone(c.mobile)}</span>
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
                    </td>
                    <td data-label="Lifetime volume" className="p-3 font-bold text-forest">
                      {formatLitres(c.metrics?.lifetimeLitres ?? 0)}
                    </td>
                    <td data-label="Lifetime value" className="p-3 font-bold text-ink">
                      {formatAdminMoney(c.metrics?.totalSpendCents ?? 0)}
                    </td>
                    <td data-label="Orders" className="p-3">
                      {c.metrics?.completedOrders ?? 0} finished
                    </td>
                    <td data-label="Attention" className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {Boolean(c.metrics?.averageRating) && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300">
                            <Star aria-hidden="true" />{c.metrics?.averageRating} ({c.metrics?.reviewCount})
                          </span>
                        )}
                        {c.matchStatus === "CONFLICT_REVIEW" && (
                          <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">
                            <ShieldAlert aria-hidden="true" />Conflict
                          </span>
                        )}
                        {c.marketingConsent && (
                          <span className="text-[10px] font-bold text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded">
                            <Mail aria-hidden="true" />Consent
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Actions" className="p-3 text-right">
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
                                  icon: <ShieldAlert className="text-amber-600" aria-hidden="true" />,
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
                      <AdminEmptyState title={emptyListTitle} description={emptyListDescription} />
                      {filterChip !== "all" && <button type="button" className="btn btn-secondary text-xs mt-3" onClick={() => setFilterChip("all")}>Clear filter</button>}
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
                              <Star aria-hidden="true" />High value
                            </span>
                          )}
                        </div>

                        <span className="text-xs text-muted font-mono truncate">{maskPhone(customer.mobile)}</span>

                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-muted font-medium">
                          <span className="font-bold text-forest">{litresStr}</span>
                          <span>•</span>
                          <span className="font-bold text-ink">{spendStr}</span>
                          <span>•</span>
                          <span>{customer.metrics?.totalOrders ?? 0} orders</span>
                          {Boolean(customer.metrics?.averageRating) && (
                            <>
                              <span>•</span>
                              <span className="font-bold text-amber-700 inline-flex items-center gap-1"><Star aria-hidden="true" />{customer.metrics?.averageRating}</span>
                            </>
                          )}
                        </div>

                        {customer.matchStatus === "CONFLICT_REVIEW" && (
                          <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded mt-1 inline-block w-fit">
                            <ShieldAlert aria-hidden="true" />Identity conflict
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
                <>
                  <AdminEmptyState title={emptyListTitle} description={emptyListDescription} />
                  {filterChip !== "all" && <button type="button" className="btn btn-secondary text-xs mt-3" onClick={() => setFilterChip("all")}>Clear filter</button>}
                </>
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
                            <Star aria-hidden="true" />High-value customer
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs muted font-medium">
                        <span className="font-mono text-ink font-semibold flex items-center gap-1">
                          <Phone aria-hidden="true" />{profile.customer.mobile}
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
                            <Mail aria-hidden="true" />{profile.customer.email}
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
                            <ExternalLink aria-hidden="true" />{profile.customer.facebookProfile}
                          </a>
                        )}
                        <span className="inline-flex items-center gap-1"><MapPin aria-hidden="true" />Preferred: <strong>{profile.metrics.preferredMethod === "DELIVERY" ? "Home delivery" : "Pickup"}</strong></span>
                      </div>

                      {/* CUSTOMER PRIMARY DELIVERY ADDRESS CARD */}
                      {profile.metrics.primaryAddress && (
                        <div className="flex items-center justify-between p-2.5 bg-surface-muted/80 rounded-xl border border-line text-xs mt-2">
                          <span className="font-semibold text-ink flex items-center gap-1.5">
                            <MapPin aria-hidden="true" />Delivery address: <strong className="text-ink">{profile.metrics.primaryAddress}</strong>
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
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Contact actions</span>

                  <div className="flex flex-wrap items-center gap-2">
                    {profile.customer.mobile && (
                      <>
                        <a
                          className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-lg"
                          href={`tel:${profile.customer.mobile}`}
                          title={`Call ${profile.customer.mobile}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call</span>
                        </a>
                        <a
                          className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-lg"
                          href={`sms:${profile.customer.mobile}`}
                          title={`SMS ${profile.customer.mobile}`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>SMS</span>
                        </a>
                        <a
                          className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-lg"
                          href={`https://wa.me/${cleanPhoneForWhatsApp(profile.customer.mobile)}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Open WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
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
                        <span>Facebook</span>
                      </a>
                    )}

                    {/* New Order shortcut */}
                    <Link className="btn text-xs py-1.5 px-3 font-semibold flex items-center gap-1.5 rounded-lg" href="/admin/manual-orders">
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>New Order</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* KEY METRICS & RELIABILITY SCORE CARD */}
              <div className="customer-relationship-summary card">
                <div className="customer-summary-fact">
                  <span className="text-xs font-bold uppercase tracking-wider muted">Total Volume</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-2xl font-bold text-ink ops-tabular">
                      {formatLitres(profile.metrics.lifetimeLitres)}
                    </span>
                    <span className="text-xs text-muted">harvested</span>
                  </div>
                </div>

                <div className="customer-summary-fact">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Lifetime Spend</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-2xl font-bold text-primary ops-tabular">
                      {formatAdminMoney(profile.metrics.totalSpendCents)}
                    </span>
                    <span className="text-xs text-primary/70 font-semibold">Euros</span>
                  </div>
                </div>

                <div className="customer-summary-fact">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Customer Sentiment</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-2xl font-bold text-amber-800 ops-tabular flex items-center gap-1">
                      {profile.metrics.averageRating ? <><Star aria-hidden="true" />{profile.metrics.averageRating}</> : "—"}
                    </span>
                    <span className="text-xs text-amber-900 font-semibold">
                      {profile.metrics.reviewCount ? `${profile.metrics.reviewCount} review(s)` : "No reviews"}
                    </span>
                  </div>
                </div>

                <div className="customer-summary-fact">
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

                <div className="customer-summary-fact">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-700">No-Show Risk</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className={`text-2xl font-bold ops-tabular ${profile.metrics.noShowCount > 0 ? "text-danger" : "text-slate-600"}`}>
                      {profile.metrics.noShowCount}
                    </span>
                    <span className="text-xs muted font-semibold">
                      {profile.metrics.noShowCount > 0 ? "Past no-show" : "No no-shows"}
                    </span>
                  </div>
                </div>
              </div>

              {/* IDENTITY CONFLICT WARNING BANNER */}
              {profile.identityConflicts.length > 0 && (
                <div className="card p-4 bg-amber-50 border border-amber-300 rounded-xl flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <strong className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                      <ShieldAlert aria-hidden="true" />Identity conflict detected
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
                      <GitMerge aria-hidden="true" />Review merge
                    </button>
                  )}
                </div>
              )}

              {/* PINNED STAFF NOTES CARD */}
              <div className="card p-4 md:p-5 flex flex-col gap-3 bg-amber-50/40 border border-amber-200">
                <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <Pin aria-hidden="true" />Staff note and handling instructions
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      className="btn btn-secondary text-xs py-1 px-2.5"
                      onClick={() => void handleSaveNote()}
                      disabled={savingNote}
                    >
                      {savingNote ? "Saving…" : <><Save aria-hidden="true" />Save note</>}
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
                      <Star aria-hidden="true" />Customer reviews
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                        {profile.reviews?.length ?? 0}
                      </span>
                    </h3>
                  </div>
                  <Link className="btn btn-secondary text-xs py-1.5 px-3 font-semibold" href="/admin/reviews">
                    Manage reviews<ExternalLink aria-hidden="true" />
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
                              <CircleCheck aria-hidden="true" />Verified buyer
                            </span>
                          )}
                          {rev.featured && (
                            <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded border border-purple-300">
                              <Star aria-hidden="true" />Featured
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
                         &quot;{rev.displayText || rev.originalText}&quot;
                      </p>

                      {rev.orderId && (
                        <div className="text-[11px] muted flex items-center gap-1 mt-0.5">
                          <span>Linked Order:</span>
                          <Link className="text-primary hover:underline font-bold font-mono" href={`/admin/orders/${rev.orderId}`}>
                            View order<ExternalLink aria-hidden="true" />
                          </Link>
                        </div>
                      )}

                      {rev.sellerReplyText && (
                        <div className="mt-1 p-2.5 bg-surface-muted rounded-lg border-l-4 border-primary text-xs space-y-1">
                          <strong className="text-primary font-bold block text-[11px] uppercase tracking-wider">
                            Store reply ({rev.sellerRepliedAt?.slice(0, 10)})
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
                                View<ExternalLink aria-hidden="true" />
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
              <div className="card p-4 md:p-5 flex flex-col gap-5 bg-surface-muted/30">
                <div className="flex flex-col gap-2 text-xs">
                  <strong className="font-bold text-ink uppercase tracking-wider text-[11px]">
                    <ShieldCheck aria-hidden="true" />Privacy and consent
                  </strong>
                  <span className="eyebrow customer-section-label">Marketing consent <span className="customer-info-hint" data-tooltip="Marketing consent controls promotional messages. It does not affect retention or anonymization eligibility." role="img" tabIndex={0} aria-label="Marketing consent controls promotional messages. It does not affect retention or anonymization eligibility."><Info aria-hidden="true" /></span></span>
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
                {canRetention && (
                  <div className="flex flex-col gap-2 text-xs">
                    <span className="eyebrow customer-section-label">Contact confirmation <span className="customer-info-hint" data-tooltip="After speaking with the customer by phone, SMS or WhatsApp, choose the channel and confirm. The confirmation is valid for 12 months." role="img" tabIndex={0} aria-label="Contact confirmation is recorded after speaking with the customer and is valid for 12 months."><Info aria-hidden="true" /></span></span>
                    {profile.customer.contactConfirmationExpiresAt && <span className="text-emerald-800">Confirmed until {profile.customer.contactConfirmationExpiresAt.slice(0, 10)}</span>}
                    <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor="contact-confirmation-channel">Confirmation channel</label>
                    <select id="contact-confirmation-channel" className="input text-xs" value={confirmationChannel} onChange={(event) => setConfirmationChannel(event.target.value as typeof confirmationChannel)} disabled={retentionBusy}>
                      <option value="PHONE">Phone</option><option value="WHATSAPP">WhatsApp</option><option value="SMS">SMS</option><option value="OTHER">Other</option>
                    </select>
                    <button type="button" className="btn btn-secondary text-xs" onClick={() => void handleConfirmContact()} disabled={retentionBusy}><ShieldCheck aria-hidden="true" />{retentionBusy ? "Saving…" : "Confirm contact"}</button>
                    </div>
                  </div>
                )}
                {canRetention && (
                  <div className="flex flex-wrap items-center gap-2 text-xs w-full">
                    <span className="eyebrow w-full customer-section-label">Retention hold <span className="customer-info-hint" data-tooltip="Use only for an active legal, accounting or dispute reason. Enter an expiry date and a clear reason; the retention job will skip this customer until then." role="img" tabIndex={0} aria-label="Retention hold is for active legal, accounting or dispute reasons and requires an expiry date and reason."><Info aria-hidden="true" /></span></span>
                    {profile.customer.retentionHoldUntil ? (
                      <><span className="text-amber-800">Retention hold until {profile.customer.retentionHoldUntil.slice(0, 10)}</span><button type="button" className="btn btn-secondary text-xs" onClick={() => void clearRetentionHold()} disabled={retentionBusy}>Release hold</button></>
                    ) : (
                      <><label className="sr-only" htmlFor="retention-hold-until">Hold until</label><input id="retention-hold-until" type="date" className="input text-xs" value={holdUntil} onChange={(event) => setHoldUntil(event.target.value)} disabled={retentionBusy} /><label className="sr-only" htmlFor="retention-hold-reason">Hold reason</label><input id="retention-hold-reason" className="input text-xs min-w-[12rem]" placeholder="Legal/accounting hold reason" value={holdReason} onChange={(event) => setHoldReason(event.target.value)} disabled={retentionBusy} /><button type="button" className="btn btn-secondary text-xs" onClick={() => void handleRetentionHold()} disabled={retentionBusy || !holdUntil || holdReason.trim().length < 3}>Add retention hold</button></>
                    )}
                  </div>
                )}
                {canAnonymize && <div className="border-t border-line pt-4 flex items-center justify-between gap-3"><div><span className="eyebrow text-danger customer-section-label">Danger zone <span className="customer-info-hint" data-tooltip="Clicking Start anonymization opens a confirmation step. Personal contact data is removed only after you confirm. Order totals and audit records are preserved." role="img" tabIndex={0} aria-label="Start anonymization opens a confirmation step. Personal contact data is removed only after confirmation; order totals and audit records are preserved."><Info aria-hidden="true" /></span></span><p className="muted text-xs">Anonymize personal data when retention rules allow it.</p></div><button type="button" className="btn btn-secondary text-xs text-danger py-1.5 px-3" onClick={() => setShowAnonymizeConfirm(true)}><ShieldAlert aria-hidden="true" />Start anonymization</button></div>}
              </div>
            </div>
          ) : loadingProfile ? (
            <AdminEmptyState title="Loading profile…" description="Fetching Customer 360 context." />
          ) : (
            <AdminEmptyState
              title={filteredCustomers.length === 0 ? emptyListTitle : "Select a customer"}
              description={filteredCustomers.length === 0 ? emptyListDescription : "Choose a customer from the left master list."}
            />
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
              <button className="btn bg-rose-700 text-white hover:bg-rose-800 text-xs font-bold" type="button" onClick={() => void handleAnonymize()}>
                Confirm Anonymization
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
