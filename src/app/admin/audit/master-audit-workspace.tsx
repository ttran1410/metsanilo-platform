"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Calendar,
  ChevronRight,
  CreditCard,
  Download,
  ExternalLink,
  FileDown,
  KeyRound,
  Lock,
  PlusCircle,
  ReceiptText,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import type { AuditCategory, AuditSeverity, FormattedAuditItem } from "@/domain/audit";
import { AdminEmptyState, AdminNotice } from "../presentation";
import { AdminPagination } from "../ui/admin-pagination";
import { AdminRowActionMenu, IconCopy, IconEye, IconLink } from "../ui/admin-row-action-menu";
import { DiffInspectorDrawer } from "./diff-inspector-drawer";
import { parseAuditUrlState, serializeAuditUrlState } from "../audit-url-state";

function ActionTypeIcon({ name }: { name: string }) {
  const props = { className: "w-3.5 h-3.5 stroke-[1.8] shrink-0" };
  switch (name) {
    case "CreditCard":
      return <CreditCard {...props} />;
    case "RefreshCw":
      return <RefreshCw {...props} />;
    case "Tag":
      return <Tag {...props} />;
    case "ReceiptRefund":
    case "ReceiptText":
      return <ReceiptText {...props} />;
    case "PlusCircle":
      return <PlusCircle {...props} />;
    case "KeyRound":
      return <KeyRound {...props} />;
    case "Lock":
      return <Lock {...props} />;
    case "UserCheck":
      return <UserCheck {...props} />;
    case "Calendar":
      return <Calendar {...props} />;
    case "Trash2":
      return <Trash2 {...props} />;
    default:
      return <Activity {...props} />;
  }
}

export function MasterAuditWorkspace({
  initialData,
  canExportAudit = true,
  loadInitialFromApi = false,
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
  loadInitialFromApi?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const initialUrlState = parseAuditUrlState(searchParams);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(initialUrlState.selectedAuditId);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState(initialUrlState.searchQuery);
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | "ALL">(initialUrlState.severityFilter);
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory | "ALL">(initialUrlState.categoryFilter);
  const [actorFilter, setActorFilter] = useState<string>(initialUrlState.actorFilter);
  const [dateRange, setDateRange] = useState<"24h" | "7d" | "30d" | "all">(initialUrlState.dateRange);
  const [currentPage, setCurrentPage] = useState(initialUrlState.currentPage);
  const [limitState, setLimitState] = useState(initialData.limit || 20);

  const selectedItem = useMemo(() => data.items.find((item) => item.id === selectedAuditId) ?? null, [data.items, selectedAuditId]);

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
        q: search,
        severity,
        category,
        actor,
        dateRange: range,
      });

      const response = await fetch(`/api/admin/audit?${params.toString()}`, { cache: "no-store", headers: { "x-admin-request-scope": "audit-list" } });
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

  useEffect(() => {
    if (loadInitialFromApi) {
      queueMicrotask(() => void fetchFilteredAudit());
    }
    // Initial JSON load intentionally runs once for the URL-derived state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadInitialFromApi]);

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

  function handleResetFilters() {
    setSearchQuery("");
    setSeverityFilter("ALL");
    setCategoryFilter("ALL");
    setActorFilter("ALL");
    setDateRange("7d");
    setCurrentPage(1);
    void fetchFilteredAudit(1, limitState, "", "ALL", "ALL", "ALL", "7d");
  }

  const hasActiveCustomFilters = searchQuery !== "" || severityFilter !== "ALL" || categoryFilter !== "ALL" || actorFilter !== "ALL" || dateRange !== "7d";

  useEffect(() => {
    const next = serializeAuditUrlState(searchParams, { searchQuery, severityFilter, categoryFilter, actorFilter, dateRange, currentPage, selectedAuditId });
    if (next.toString() !== searchParams.toString()) router.replace(`?${next.toString()}`, { scroll: false });
  }, [actorFilter, categoryFilter, currentPage, dateRange, router, searchParams, searchQuery, selectedAuditId, severityFilter]);

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

  function copyEventId(id: string) {
    void navigator.clipboard.writeText(id);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <section className="admin-audit-workspace shell pb-12 flex flex-col gap-4">
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      {/* HEADER & EXPORT TOOLBAR */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow text-primary">AUDIT TRAIL &amp; FORENSICS</span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-500" />
              Append-only &amp; immutable
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink mt-0.5">Security &amp; audit</h1>
        </div>

        {canExportAudit && (
          <div className="flex items-center gap-2">
            <a
              href={exportUrl.csv}
              download
              className="btn btn-secondary text-xs py-1.5 px-3 font-semibold flex items-center gap-1.5"
              title="Export filtered records as CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export CSV</span>
            </a>
            <a
              href={exportUrl.json}
              download
              className="btn btn-secondary text-xs py-1.5 px-3 font-semibold flex items-center gap-1.5"
              title="Export filtered records as JSON"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-600" />
              <span>Export JSON</span>
            </a>
          </div>
        )}
      </div>

      {/* 1. ACTIONABLE RISK FILTER STRIP (Past 7 Days summary) */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-surface-muted/60 rounded-xl border border-line text-xs">
        <span className="text-[11px] font-bold text-slate-500 px-2 uppercase tracking-wider">
          Quick filters (7d):
        </span>

        <button
          type="button"
          onClick={() => handleFilterChange({ severity: severityFilter === "HIGH" ? "ALL" : "HIGH" })}
          className={`px-2.5 py-1 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
            severityFilter === "HIGH"
              ? "bg-rose-100 text-rose-900 border-rose-300 ring-2 ring-rose-500/20"
              : "bg-surface hover:bg-rose-50/50 text-rose-800 border-rose-200/70"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
          <span>High risk</span>
          <span className="px-1.5 py-0.2 rounded-full bg-rose-200/70 text-rose-950 font-bold text-[10px]">
            {data.metrics.highRisk}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleFilterChange({ severity: severityFilter === "MEDIUM" ? "ALL" : "MEDIUM" })}
          className={`px-2.5 py-1 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
            severityFilter === "MEDIUM"
              ? "bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-500/20"
              : "bg-surface hover:bg-amber-50/50 text-amber-800 border-amber-200/70"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>Sensitive edits</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-200/70 text-amber-950 font-bold text-[10px]">
            {data.metrics.sensitiveEdits}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleFilterChange({ severity: severityFilter === "STANDARD" ? "ALL" : "STANDARD" })}
          className={`px-2.5 py-1 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
            severityFilter === "STANDARD"
              ? "bg-slate-200 text-slate-900 border-slate-400 ring-2 ring-slate-500/20"
              : "bg-surface hover:bg-slate-100 text-slate-700 border-slate-200"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
          <span>Ops actions</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-800 font-bold text-[10px]">
            {data.metrics.opsActions}
          </span>
        </button>

        <div className="ml-auto hidden sm:flex items-center gap-2 text-[11px] text-slate-500 px-2 font-mono">
          <span>{data.metrics.total7Days} events logged past 7d</span>
        </div>
      </div>

      {/* 2. FORENSIC MULTI-PARAMETER FILTER ENGINE */}
      <div className="card p-3 sm:p-4 flex flex-col gap-2.5 border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <input
              placeholder="Search keyword, actor, entity ID, action…"
              value={searchQuery}
              onChange={(e) => handleFilterChange({ search: e.target.value })}
              className="w-full text-xs py-1.5 px-3 pl-8 rounded-lg border border-line bg-surface placeholder:text-muted"
            />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted pointer-events-none" />
          </div>

          <select
            aria-label="Filter by Risk Level"
            value={severityFilter}
            onChange={(e) => handleFilterChange({ severity: e.target.value as AuditSeverity | "ALL" })}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-line bg-surface font-semibold"
          >
            <option value="ALL">All risk levels</option>
            <option value="HIGH">High risk only</option>
            <option value="MEDIUM">Medium risk (Financial)</option>
            <option value="STANDARD">Standard operational</option>
          </select>

          <select
            aria-label="Filter by Category"
            value={categoryFilter}
            onChange={(e) => handleFilterChange({ category: e.target.value as AuditCategory | "ALL" })}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-line bg-surface font-semibold"
          >
            <option value="ALL">All categories</option>
            <option value="ORDERS">Orders &amp; payments</option>
            <option value="USERS">Users &amp; permissions</option>
            <option value="CUSTOMERS">Customers &amp; CRM</option>
            <option value="AVAILABILITY">Products &amp; availability</option>
            <option value="SYSTEM">System &amp; authentication</option>
          </select>

          <select
            aria-label="Filter by Actor"
            value={actorFilter}
            onChange={(e) => handleFilterChange({ actor: e.target.value })}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-line bg-surface font-semibold max-w-[180px]"
          >
            <option value="ALL">All actors</option>
            {data.actors.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Date Range"
            value={dateRange}
            onChange={(e) => handleFilterChange({ dateRange: e.target.value as "24h" | "7d" | "30d" | "all" })}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-line bg-surface font-semibold"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>

          {hasActiveCustomFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-rose-700 hover:text-rose-900 font-semibold px-2 py-1 hover:bg-rose-50 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* 3. AUDIT EVENT STREAM MASTER TABLE (Desktop) & CARD LIST (Mobile) */}
      <div className="card p-3 sm:p-4 overflow-x-auto border border-line flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-line pb-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ink">
              Audit event stream
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-muted border border-line text-ink">
              {data.total} {data.total === 1 ? "record" : "records"}
            </span>
            {loading && <span className="text-xs muted italic animate-pulse">Updating…</span>}
          </div>

          <span className="text-xs muted font-mono">
            Page {data.page} of {data.totalPages}
          </span>
        </div>

        {/* MOBILE CARD VIEW (hidden on sm+) */}
        <div className="flex flex-col gap-2.5 sm:hidden">
          {data.items.map((item) => {
            const targetLabel = item.targetInfo?.label ?? `${item.entityType}: ${item.entityId.slice(0, 8)}`;

            return (
              <div
                key={item.id}
                onClick={() => setSelectedAuditId(item.id)}
                className="p-3 bg-surface hover:bg-surface-muted/50 border border-line rounded-xl flex flex-col gap-2 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        item.severity === "HIGH"
                          ? "bg-rose-50 text-rose-800 border-rose-200"
                          : item.severity === "MEDIUM"
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      {item.severity === "HIGH" ? "High risk" : item.severity === "MEDIUM" ? "Sensitive" : "Ops"}
                    </span>
                    <span className="text-xs font-bold text-ink truncate">
                      {item.actionTitle ?? item.action}
                    </span>
                  </div>

                  <span className="font-mono text-[10px] muted whitespace-nowrap">
                    {item.createdAt.slice(0, 16).replace("T", " ")}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-ink">
                  <span className="font-medium truncate">
                    Actor: {item.actorInfo?.name ?? item.actorDisplayName ?? item.actor}
                  </span>
                  <span className="font-mono text-[11px] text-primary font-semibold truncate">
                    {targetLabel}
                  </span>
                </div>

                <p className="text-xs muted line-clamp-2 leading-relaxed">
                  {item.diff.summary}
                  {item.diff.reason && ` — "${item.diff.reason}"`}
                </p>

                <div className="flex items-center justify-end text-[11px] text-primary font-semibold pt-1 border-t border-line/60">
                  <span className="inline-flex items-center gap-0.5">
                    View details <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}

          {data.items.length === 0 && (
            <AdminEmptyState
              title="No audit events found"
              description="No security audit records match the selected forensic filters."
            />
          )}
        </div>

        {/* DESKTOP TABLE VIEW (hidden on mobile) */}
        <table className="hidden sm:table w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-line text-muted font-bold uppercase text-[10px] tracking-wider">
              <th className="pb-3 pt-1 px-3">Timestamp</th>
              <th className="pb-3 pt-1 px-3">Actor</th>
              <th className="pb-3 pt-1 px-3">Action &amp; risk</th>
              <th className="pb-3 pt-1 px-3">Target entity</th>
              <th className="pb-3 pt-1 px-3">Summary / Reason</th>
              <th className="pb-3 pt-1 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.items.map((item) => {
              const actorType = item.actorInfo?.type ?? "STAFF";
              const targetLabel = item.targetInfo?.label ?? `${item.entityType}: ${item.entityId.slice(0, 8)}`;
              const targetHref = item.targetInfo?.href;

              return (
                <tr
                  key={item.id}
                  className="hover:bg-surface-muted/60 transition-colors cursor-pointer group"
                  onClick={() => setSelectedAuditId(item.id)}
                >
                  <td className="py-3 px-3 font-mono text-[11px] muted whitespace-nowrap">
                    {item.createdAt.slice(0, 16).replace("T", " ")}
                  </td>

                  <td className="py-3 px-3">
                    {actorType === "SYSTEM" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                        <Activity className="w-3 h-3 text-slate-500" />
                        System / Webhook
                      </span>
                    ) : actorType === "PUBLIC" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                        <Users className="w-3 h-3 text-purple-600" />
                        Online customer
                      </span>
                    ) : (
                      <div>
                        <strong className="text-ink font-bold block text-xs">
                          {item.actorInfo?.name ?? item.actorDisplayName ?? item.actor}
                        </strong>
                        {(item.actorInfo?.subtitle || item.actorEmail) && (
                          <span className="muted text-[11px] block truncate max-w-[160px]">
                            {item.actorInfo?.subtitle ?? item.actorEmail}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 inline-flex items-center gap-1 ${
                          item.severity === "HIGH"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : item.severity === "MEDIUM"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        {item.severity === "HIGH" ? (
                          <ShieldAlert className="w-3 h-3 text-rose-600" />
                        ) : item.severity === "MEDIUM" ? (
                          <Shield className="w-3 h-3 text-amber-600" />
                        ) : (
                          <ShieldCheck className="w-3 h-3 text-slate-500" />
                        )}
                        {item.severity === "HIGH" ? "High risk" : item.severity === "MEDIUM" ? "Sensitive" : "Ops"}
                      </span>

                      <div className="flex items-center gap-1 min-w-0">
                        <ActionTypeIcon name={item.actionIcon} />
                        <span className="text-xs font-semibold text-ink truncate">
                          {item.actionTitle ?? item.action}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3 font-semibold text-xs text-primary">
                    {targetHref ? (
                      <Link
                        href={targetHref}
                        className="hover:underline font-bold text-primary inline-flex items-center gap-1 truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>{targetLabel}</span>
                        <ExternalLink className="w-3 h-3 text-primary/70 shrink-0" />
                      </Link>
                    ) : (
                      <span className="text-ink/80 truncate font-mono text-[11px]">{targetLabel}</span>
                    )}
                  </td>

                  <td className="py-3 px-3 max-w-xs truncate">
                    <span className="text-ink font-medium">{item.diff.summary}</span>
                    {item.diff.reason && (
                      <span className="block text-[11px] text-amber-900 italic truncate mt-0.5">
                        &ldquo;{item.diff.reason}&rdquo;
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                      <AdminRowActionMenu
                        items={[
                          {
                            id: "view-diff",
                            label: "View details",
                            icon: <IconEye />,
                            onClick: () => setSelectedAuditId(item.id),
                          },
                          {
                            id: "copy-id",
                            label: copiedId === item.id ? "ID Copied!" : "Copy event ID",
                            icon: <IconCopy />,
                            onClick: () => copyEventId(item.id),
                          },
                          ...(targetHref
                            ? [
                                {
                                  id: "jump-entity",
                                  label: "Jump to entity",
                                  icon: <IconLink />,
                                  onClick: () => {
                                    window.location.href = targetHref;
                                  },
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}

            {data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center">
                  <AdminEmptyState
                    title="No audit events found"
                    description="No security audit records match the selected forensic filters."
                  />
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
          onClose={() => setSelectedAuditId(null)}
        />
      )}
    </section>
  );
}
