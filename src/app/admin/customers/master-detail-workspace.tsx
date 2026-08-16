"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminEmptyState, AdminNotice, AdminStatusBadge, formatAdminMoney } from "../presentation";
import { CustomerModal } from "./customer-modal";
import { MergeModal } from "./merge-modal";

type CustomerRow = {
  id: string;
  name: string;
  mobile: string;
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

type ProfileData = {
  customer: CustomerRow;
  orders: OrderItem[];
  timelineByYear: Record<string, OrderItem[]>;
  audit: Array<{ id: string; action: string; actor: string; createdAt: string }>;
  metrics: NonNullable<CustomerRow["metrics"]>;
  identityConflicts: Array<{ id: string; name: string; mobile: string; email?: string | null }>;
};

function formatLitres(ml: number) {
  return `${(ml / 1000).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} L`;
}

function cleanPhoneForWhatsApp(mobile: string) {
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
  initialCustomers: CustomerRow[];
  canEdit: boolean;
  canAnonymize: boolean;
}) {
  const [customersList, setCustomersList] = useState(initialCustomers);
  const [selectedId, setSelectedId] = useState<string>(initialCustomers[0]?.id ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterChip, setFilterChip] = useState<"all" | "vip" | "conflicts" | "consent">("all");

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);
  const [mergingDuplicate, setMergingDuplicate] = useState<{ id: string; name: string; mobile: string; email?: string | null } | null>(null);
  const [showAnonymizeConfirm, setShowAnonymizeConfirm] = useState(false);

  const [editingNoteText, setEditingNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const selectedRow = useMemo(() => {
    return customersList.find((c) => c.id === selectedId) ?? customersList[0];
  }, [customersList, selectedId]);

  async function loadProfile(id: string) {
    setSelectedId(id);
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
        setCustomersList(body.data);
        const targetId = currentIdToSelect ?? selectedId;
        if (targetId) void loadProfile(targetId);
      }
    } catch {
      /* ignore */
    }
  }

  // Load first profile on mount
  useMemo(() => {
    if (initialCustomers[0]?.id && !profile) {
      void loadProfile(initialCustomers[0].id);
    }
  }, []);

  // Filter Master Customer List
  const filteredCustomers = useMemo(() => {
    return customersList.filter((c) => {
      const text = `${c.name} ${c.mobile} ${c.email ?? ""} ${c.facebookProfile ?? ""} ${c.notes ?? ""}`.toLowerCase();
      const matchesSearch = !searchQuery || text.includes(searchQuery.toLowerCase());

      let matchesChip = true;
      if (filterChip === "vip") matchesChip = Boolean(c.metrics?.isVip);
      else if (filterChip === "conflicts") matchesChip = c.matchStatus === "CONFLICT_REVIEW";
      else if (filterChip === "consent") matchesChip = c.marketingConsent;

      return matchesSearch && matchesChip;
    });
  }, [customersList, searchQuery, filterChip]);

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
    const volumeLitres = formatLitres(profile.metrics.lifetimeLitres);

    const msg =
      templateKind === "READY"
        ? `Hei ${firstName}! Marjaeräsi on pakattu ja valmiina noudettavaksi tänään Toriparkista. Tervetuloa! 🫐`
        : `Hei ${firstName}! Kiitos varauksestasi Metsänilolla. Vahvistamme marjavarauksesi. 🫐`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

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
              <span className="eyebrow">CUSTOMER CONTEXT</span>
              <h2 className="text-base font-bold text-ink">Customers ({filteredCustomers.length})</h2>
            </div>

            {canEdit && (
              <button type="button" className="btn text-xs py-1 px-2.5" onClick={() => setShowCreateModal(true)}>
                ＋ New Customer
              </button>
            )}
          </div>

          {/* Search & Filter Chips */}
          <div className="flex flex-col gap-2">
            <input
              placeholder="Search by name, phone, email, notes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs py-1.5 px-3 rounded-lg border border-line bg-surface"
            />

            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              {[
                { key: "all", label: "All" },
                { key: "vip", label: "⭐ VIP Buyers" },
                { key: "conflicts", label: "⚠️ Conflicts" },
                { key: "consent", label: "✉️ Marketing" },
              ].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition-colors ${
                    filterChip === chip.key
                      ? "bg-primary text-on-primary"
                      : "bg-surface-muted text-ink/70 hover:bg-surface-muted/80"
                  }`}
                  onClick={() => setFilterChip(chip.key as typeof filterChip)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Master Items List */}
          <div className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1">
            {filteredCustomers.map((customer) => {
              const isSelected = customer.id === selectedId;
              const litresStr = formatLitres(customer.metrics?.lifetimeLitres ?? 0);
              const spendStr = formatAdminMoney(customer.metrics?.totalSpendCents ?? 0);

              return (
                <button
                  key={customer.id}
                  type="button"
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                      : "border-line bg-surface hover:border-muted"
                  }`}
                  onClick={() => void loadProfile(customer.id)}
                >
                  {/* Avatar Initials */}
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

                    <span className="text-xs muted font-mono truncate">{customer.mobile}</span>

                    <div className="flex items-center gap-2 mt-1 text-[11px] muted font-medium">
                      <span>{litresStr}</span>
                      <span>•</span>
                      <span>{spendStr}</span>
                      <span>•</span>
                      <span>{customer.metrics?.totalOrders ?? 0} orders</span>
                    </div>

                    {customer.matchStatus === "CONFLICT_REVIEW" && (
                      <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                        ⚠️ Phone Conflict Review
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {filteredCustomers.length === 0 && (
              <AdminEmptyState title="No customers found" description="Adjust search query or filter chips." />
            )}
          </div>
        </aside>

        {/* RIGHT DETAIL WORKSPACE PANE (8 Cols) */}
        <main className="lg:col-span-8 flex flex-col gap-4">
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
                          <span className="text-xs uppercase font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            ⭐ VIP High-Volume Buyer
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs muted font-medium">
                        <span className="font-mono text-ink font-semibold">📞 {profile.customer.mobile}</span>
                        {profile.customer.email && <span>✉️ {profile.customer.email}</span>}
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
                    </div>
                  </div>

                  {/* Action Edit Button */}
                  {canEdit && (
                    <button
                      type="button"
                      className="btn btn-secondary text-xs py-1.5 px-3"
                      onClick={() => setEditingCustomer(profile.customer)}
                    >
                      ✏️ Edit Profile
                    </button>
                  )}
                </div>

                {/* OMNICHANNEL FAST-COMMUNICATION TOOLBAR */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-surface-muted rounded-xl border border-line">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">1-Tap Fast Contact:</span>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* WhatsApp Presets */}
                    <button
                      type="button"
                      className="btn text-xs py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-on-primary font-bold flex items-center gap-1 shadow-sm"
                      onClick={() => triggerWhatsApp("READY")}
                      title="Open WhatsApp with pre-filled Ready for Pickup notification"
                    >
                      💬 WhatsApp: Ready
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                      onClick={() => triggerWhatsApp("CONFIRMED")}
                      title="Open WhatsApp with pre-filled Order Confirmed notification"
                    >
                      💬 WhatsApp: Confirm
                    </button>

                    {/* Call & SMS triggers */}
                    <a
                      className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                      href={`tel:${profile.customer.mobile}`}
                    >
                      📞 Call
                    </a>
                    <a
                      className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                      href={`sms:${profile.customer.mobile}`}
                    >
                      ✉️ SMS
                    </a>

                    {profile.customer.facebookProfile && (
                      <a
                        className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 text-blue-700 font-semibold"
                        href={profile.customer.facebookProfile.startsWith("http") ? profile.customer.facebookProfile : `https://facebook.com/${profile.customer.facebookProfile.replace(/^@/, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        📘 Facebook Profile
                      </a>
                    )}

                    {/* New Order shortcut */}
                    <a className="btn text-xs py-1.5 px-3 font-semibold" href="/admin/manual-orders">
                      ➕ New Order
                    </a>
                  </div>
                </div>
              </div>

              {/* KEY METRICS & RELIABILITY SCORE CARD */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
