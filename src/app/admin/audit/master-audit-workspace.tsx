"use client";

import { useMemo, useState } from "react";
import type { AuditCategory, AuditSeverity, FormattedAuditItem } from "@/domain/audit";
import { AdminNotice } from "../presentation";
import { AdminPagination } from "../ui/admin-pagination";
import { DiffInspectorDrawer } from "./diff-inspector-drawer";

export function MasterAuditWorkspace({
  initialData,
  canExportAudit = true,
}: {
  initialData: {
    items: FormattedAuditItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    actors: string[];
    metrics: {
      highRisk: number;
      sensitiveEdits: number;
      opsActions: number;
      failedLogins: number;
      total7Days: number;
    };
  };
  canExportAudit?: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory | "ALL">("ALL");
  const [actorFilter, setActorFilter] = useState<string>("ALL");
  const [dateRange, setDateRange] = useState<"24h" | "7d" | "30d" | "all">("7d");
  const [currentPage, setCurrentPage] = useState(1);
  const [limitState, setLimitState] = useState(initialData.limit || 20);
  const [selectedItem, setSelectedItem] = useState<FormattedAuditItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchFilteredAudit(
    page = currentPage,
    limit = limitState,
    search = searchQuery,
    severity = severityFilter,
    category = categoryFilter,
    actor = actorFilter,
    range = dateRange
  ) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
        severity,
        category,
        actor,
        dateRange: range,
      });

      const response = await fetch(`/api/admin/audit?${params.toString()}`);
      const body = await response.json();
      setLoading(false);

      if (!response.ok) {
        return setError(body.message ?? "Could not fetch audit records.");
      }

      if (body.data) {
        setData(body.data);
      }
    } catch {
      setLoading(false);
      setError("Network error fetching audit entries.");
    }
  }

  function handleFilterChange(updates: {
    limit?: number;
    search?: string;
    severity?: AuditSeverity | "ALL";
    category?: AuditCategory | "ALL";
    actor?: string;
    dateRange?: "24h" | "7d" | "30d" | "all";
  }) {
    const nextLimit = updates.limit ?? limitState;
    const nextSearch = updates.search ?? searchQuery;
    const nextSev = updates.severity ?? severityFilter;
    const nextCat = updates.category ?? categoryFilter;
    const nextActor = updates.actor ?? actorFilter;
    const nextRange = updates.dateRange ?? dateRange;

    if (updates.limit !== undefined) setLimitState(nextLimit);
    if (updates.search !== undefined) setSearchQuery(nextSearch);
    if (updates.severity !== undefined) setSeverityFilter(nextSev);
    if (updates.category !== undefined) setCategoryFilter(nextCat);
    if (updates.actor !== undefined) setActorFilter(nextActor);
    if (updates.dateRange !== undefined) setDateRange(nextRange);

    setCurrentPage(1);
    void fetchFilteredAudit(1, nextLimit, nextSearch, nextSev, nextCat, nextActor, nextRange);
  }

  function handlePageChange(newPage: number) {
    setCurrentPage(newPage);
    void fetchFilteredAudit(newPage);
  }

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams({
      search: searchQuery,
      severity: severityFilter,
      category: categoryFilter,
      actor: actorFilter,
      dateRange,
    });
    return {
      csv: `/api/admin/audit/export?format=csv&${params.toString()}`,
      json: `/api/admin/audit/export?format=json&${params.toString()}`,
    };
  }, [searchQuery, severityFilter, categoryFilter, actorFilter, dateRange]);

  return (
    <section className="shell pb-10 flex flex-col gap-4">
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      {/* HEADER & EXPORT TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <span className="eyebrow text-primary">IMMUTABLE APPEND LEDGER</span>
          <h1 className="text-2xl font-bold tracking-tight text-ink">🛡️ Security &amp; Audit Trail</h1>
        </div>

        {canExportAudit && (
          <div className="flex items-center gap-2">
            <a
              href={exportUrl.csv}
              download
              className="btn btn-secondary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5"
            >
              📥 Export CSV
            </a>
            <a
              href={exportUrl.json}
              download
              className="btn btn-secondary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5"
            >
              📜 Export JSON
            </a>
          </div>
        )}
      </div>

      {/* 1. SECURITY & ANOMALY SIGNALS (Past 7 Days) */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <div className="card p-3.5 flex flex-col justify-between border border-line bg-surface">
          <span className="eyebrow text-rose-900 text-[10px] font-bold">🔴 HIGH-RISK EVENTS</span>
          <p className="text-2xl font-black text-rose-950 mt-1">
            {data.metrics.highRisk} <span className="text-xs font-normal text-rose-800">events</span>
          </p>
          <span className="text-[11px] text-rose-700 font-semibold mt-1">Permissions &amp; GDPR</span>
        </div>

        <div className="card p-3.5 flex flex-col justify-between border border-line bg-surface">
          <span className="eyebrow text-amber-900 text-[10px] font-bold">🟡 SENSITIVE EDITS</span>
          <p className="text-2xl font-black text-amber-950 mt-1">
            {data.metrics.sensitiveEdits} <span className="text-xs font-normal text-amber-800">edits</span>
          </p>
          <span className="text-[11px] text-amber-700 font-semibold mt-1">Price Overrides &amp; Refunds</span>
        </div>

        <div className="card p-3.5 flex flex-col justify-between border border-line bg-surface">
          <span className="eyebrow text-muted text-[10px] font-bold">⚪ OPS ACTIONS</span>
          <p className="text-2xl font-black text-ink mt-1">
            {data.metrics.opsActions} <span className="text-xs font-normal muted">actions</span>
          </p>
          <span className="text-[11px] text-primary font-semibold mt-1">Order Status &amp; Notes</span>
        </div>

        <div className="card p-3.5 flex flex-col justify-between border border-line bg-surface">
          <span className="eyebrow text-blue-900 text-[10px] font-bold">🔑 FAILED LOGINS</span>
          <p className="text-2xl font-black text-blue-950 mt-1">
            {data.metrics.failedLogins} <span className="text-xs font-normal text-blue-800">fails</span>
          </p>
          <span className="text-[11px] text-blue-700 font-semibold mt-1">Clean Auth Status</span>
        </div>
      </div>

      {/* 2. FORENSIC MULTI-PARAMETER FILTER BAR */}
      <div className="card p-4 flex flex-col gap-3 border border-line">
        <span className="eyebrow text-[10px] muted">FORENSIC AUDIT FILTER ENGINE</span>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            placeholder="Search keywords, entity ID (e.g. R-9102), actor..."
            value={searchQuery}
            onChange={(e) => handleFilterChange({ search: e.target.value })}
            className="flex-1 min-w-[220px] text-xs py-1.5 px-3 rounded-lg border border-line bg-surface"
          />

          <select
            aria-label="Risk Level"
            value={severityFilter}
            onChange={(e) => handleFilterChange({ severity: e.target.value as any })}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-line bg-surface font-semibold"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="HIGH">🔴 High Risk Only</option>
            <option value="MEDIUM">🟡 Medium Risk (Financial)</option>
            <option value="STANDARD">⚪ Standard Operational</option>
          </select>

          <select
            aria-label="Category"
            value={categoryFilter}
            onChange={(e) => handleFilterChange({ category: e.target.value as any })}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-line bg-surface font-semibold"
          >
            <option value="ALL">All Categories</option>
            <option value="ORDERS">Orders &amp; Payments</option>
            <option value="USERS">Users &amp; Permissions</option>
            <option value="CUSTOMERS">Customers &amp; CRM</option>
            <option value="AVAILABILITY">Products &amp; Inventory</option>
            <option value="SYSTEM">System &amp; Auth</option>
          </select>

          <select
            aria-label="Actor"
            value={actorFilter}
            onChange={(e) => handleFilterChange({ actor: e.target.value })}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-line bg-surface font-semibold"
          >
            <option value="ALL">All Actors</option>
            {data.actors.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>

          <select
            aria-label="Date Range"
            value={dateRange}
            onChange={(e) => handleFilterChange({ dateRange: e.target.value as any })}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-line bg-surface font-semibold"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* 3. AUDIT EVENT STREAM MASTER TABLE */}
      <div className="card p-4 overflow-x-auto border border-line flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-line pb-2.5">
          <h2 className="text-base font-bold text-ink">
            Audit Event Stream ({data.total}) {loading && <span className="text-xs muted italic animate-pulse">Updating...</span>}
          </h2>
          <span className="text-xs muted font-semibold">
            Showing Page {data.page} of {data.totalPages}
          </span>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-line text-muted font-bold uppercase text-[10px] tracking-wider">
              <th className="pb-3 pt-1 px-3">Timestamp</th>
              <th className="pb-3 pt-1 px-3">Actor</th>
              <th className="pb-3 pt-1 px-3">Severity &amp; Action</th>
              <th className="pb-3 pt-1 px-3">Target Entity</th>
              <th className="pb-3 pt-1 px-3">Summary / Reason</th>
              <th className="pb-3 pt-1 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-surface-muted/60 transition-colors cursor-pointer"
                onClick={() => setSelectedItem(item)}
              >
                <td className="py-3 px-3 font-mono text-[11px] muted whitespace-nowrap">
                  {item.createdAt?.slice(0, 16).replace("T", " ")}
                </td>
                <td className="py-3 px-3">
                  <strong className="text-ink font-bold block">{item.actorDisplayName ?? item.actor}</strong>
                  {item.actorEmail && <span className="muted text-[11px]">{item.actorEmail}</span>}
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        item.severity === "HIGH"
                          ? "bg-rose-100 text-rose-900 border-rose-300"
                          : item.severity === "MEDIUM"
                          ? "bg-amber-100 text-amber-900 border-amber-300"
                          : "bg-surface-muted text-ink/70 border-line"
                      }`}
                    >
                      {item.severity === "HIGH" ? "🔴 High Risk" : item.severity === "MEDIUM" ? "🟡 Sensitive" : "⚪ Ops"}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-ink">{item.action}</span>
                  </div>
                </td>
                <td className="py-3 px-3 font-mono text-[11px] text-primary font-bold">
                  {item.entityType}: {item.entityId}
                </td>
                <td className="py-3 px-3 max-w-xs truncate">
                  <span className="text-ink font-medium">{item.diff.summary}</span>
                  {item.diff.reason && (
                    <span className="block text-[11px] text-amber-900 italic truncate">
                      &quot;{item.diff.reason}&quot;
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    className="btn btn-secondary text-xs py-1 px-2.5 font-bold"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItem(item);
                    }}
                  >
                    View Diff 🔍
                  </button>
                </td>
              </tr>
            ))}

            {data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center muted italic">
                  No security audit events match the selected forensic filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* PAGINATION CONTROLS */}
        <AdminPagination
          page={data.page}
          limit={data.limit}
          total={data.total}
          onPageChange={handlePageChange}
          onLimitChange={(newLimit) => handleFilterChange({ limit: newLimit })}
          itemLabel="audit events"
        />
      </div>

      {/* EVENT INSPECTOR SIDE DRAWER */}
      {selectedItem && (
        <DiffInspectorDrawer
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </section>
  );
}
