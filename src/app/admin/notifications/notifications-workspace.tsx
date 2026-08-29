"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Bell, CheckCheck, Circle, CircleCheck, Clock3, ExternalLink, Inbox, Info, Search } from "lucide-react";
import type { NotificationFilters, NotificationSeverity, NotificationStateFilter } from "@/domain/notifications";
import { AdminConfirmDialog, AdminNotice, AdminPageHeader } from "../presentation";
import { serializeNotificationsUrlState } from "./url-state";

type NotificationItem = {
  id: string;
  category: string;
  title: string;
  body: string;
  orderId: string | null;
  readAt: string | null;
  createdAt: string;
  severity: NotificationSeverity;
  deepLink: string | null;
};

type InboxData = {
  items: NotificationItem[];
  page: number;
  pageSize: number;
  total: number;
  unreadCount: number;
  matchingUnreadCount: number;
  categories: string[];
};

type InboxFilters = NotificationFilters & { state: NotificationStateFilter };

function labelCategory(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function labelSeverity(value: NotificationSeverity) {
  return value.toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function timeGroup(value: string) {
  const created = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime();
  if (day === today) return "Today";
  if (day === today - 86_400_000) return "Yesterday";
  return "Earlier";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-FI", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Helsinki",
  }).format(new Date(value));
}

function SeverityIcon({ severity }: { severity: NotificationSeverity }) {
  if (severity === "HIGH") return <AlertTriangle aria-hidden="true" />;
  if (severity === "STANDARD") return <Bell aria-hidden="true" />;
  return <Info aria-hidden="true" />;
}

export function NotificationsWorkspace({
  initialData,
  initialFilters,
  permissions,
  loadInitialFromApi = false,
}: {
  initialData: InboxData;
  initialFilters: InboxFilters;
  permissions: { canReadOrders: boolean; canReadAvailability: boolean; canReadReviews: boolean };
  loadInitialFromApi?: boolean;
}) {
  const [confirmMarkAll, setConfirmMarkAll] = useState(false);
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [filters, setFilters] = useState<InboxFilters>(initialFilters);
  const [queryInput, setQueryInput] = useState(initialFilters.query ?? "");
  const [selectedId, setSelectedId] = useState(initialData.items[0]?.id ?? null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error">("success");

  useEffect(() => {
    if (loadInitialFromApi) queueMicrotask(() => void load(initialFilters, initialData.page));
    // Initial JSON load intentionally runs once for the URL-derived state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadInitialFromApi]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("metsanilo:notifications-updated", { detail: data.unreadCount }));
  }, [data.unreadCount]);

  const selected = useMemo(
    () => data.items.find((item) => item.id === selectedId) ?? data.items[0] ?? null,
    [data.items, selectedId],
  );

  function canOpenLink(href: string | null) {
    if (!href) return false;
    if (href.startsWith("/admin/orders")) return permissions.canReadOrders;
    if (href.startsWith("/admin/availability")) return permissions.canReadAvailability;
    if (href.startsWith("/admin/reviews")) return permissions.canReadReviews;
    return false;
  }

  function queryString(next: InboxFilters, page = 1) {
    return serializeNotificationsUrlState({ state: next.state, category: next.category, severity: next.severity, query: next.query, page });
  }

  async function load(next: InboxFilters, page = 1) {
    setLoading(true);
    setMessage("");
    try {
      const params = queryString(next, page);
      const response = await fetch(`/api/admin/notifications?${params}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? body.code ?? "Notifications unavailable");
      setData(body.data);
      setFilters(next);
      setSelectedId(body.data.items[0]?.id ?? null);
      setDetailOpen(false);
      router.replace(`/admin/notifications?${params}`, { scroll: false });
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Notifications unavailable");
    } finally {
      setLoading(false);
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    void load({ ...filters, query: queryInput.trim() || undefined });
  }

  async function setReadState(item: NotificationItem, read: boolean) {
    const previous = data;
    setData((current) => ({
      ...current,
      unreadCount: Math.max(0, current.unreadCount + (read ? -1 : 1)),
      matchingUnreadCount: Math.max(0, current.matchingUnreadCount + (read ? -1 : 1)),
      items: current.items.map((row) => row.id === item.id ? { ...row, readAt: read ? new Date().toISOString() : null } : row),
    }));
    try {
      const response = await fetch(`/api/admin/notifications/${item.id}/${read ? "read" : "unread"}`, {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? body.code ?? "Notification update failed");
      setTone("success");
      setMessage(read ? "Notification marked read." : "Notification marked unread.");
      if ((filters.state === "UNREAD" && read) || (filters.state === "READ" && !read)) await load(filters, data.page);
    } catch (error) {
      setData(previous);
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Notification update failed");
    }
  }

  async function markFilteredRead() {
    setConfirmMarkAll(false);
    setLoading(true);
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "mark-filtered-read", filters }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? body.code ?? "Could not update the filtered notifications");
      setTone("success");
      setMessage(`${body.data.count} notification${body.data.count === 1 ? "" : "s"} marked read.`);
      await load(filters);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not update the filtered notifications");
    } finally {
      setLoading(false);
    }
  }

  const hasActiveFilters = Boolean(filters.query || filters.category || filters.severity);
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <>
    <main className="shell notification-inbox-shell">
      <AdminPageHeader
        eyebrow="Operations inbox"
        title="Notifications"
        description="Review operational events, preserve history, and move directly to the work that needs attention."
        meta={<span>{data.unreadCount} unread</span>}
      />
      {message && <AdminNotice tone={tone} live>{message}</AdminNotice>}

      <section className="notification-filter-bar" aria-label="Notification filters">
        <div className="notification-state-tabs" role="tablist" aria-label="Read state">
          {(["UNREAD", "ALL", "READ"] as const).map((state) => (
            <button key={state} type="button" role="tab" aria-selected={filters.state === state} className={filters.state === state ? "is-active" : ""} onClick={() => void load({ ...filters, state })}>
              {state === "UNREAD" ? `Unread (${data.unreadCount})` : state === "ALL" ? "All" : "Read"}
            </button>
          ))}
        </div>
        <form className="notification-search" onSubmit={submitSearch}>
          <Search aria-hidden="true" />
          <input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Search notification history" aria-label="Search notification history" />
        </form>
        <label><span>Category</span><select value={filters.category ?? "ALL"} onChange={(event) => void load({ ...filters, category: event.target.value === "ALL" ? undefined : event.target.value })}><option value="ALL">All categories</option>{data.categories.map((category) => <option value={category} key={category}>{labelCategory(category)}</option>)}</select></label>
        <label><span>Severity</span><select value={filters.severity ?? ""} onChange={(event) => void load({ ...filters, severity: event.target.value ? event.target.value as NotificationSeverity : undefined })}><option value="">All severities</option><option value="HIGH">High</option><option value="STANDARD">Standard</option><option value="INFO">Info</option></select></label>
        {data.matchingUnreadCount > 0 && <button type="button" className="btn btn-secondary notification-mark-filtered" disabled={loading} onClick={() => setConfirmMarkAll(true)}><CheckCheck aria-hidden="true" />Mark filtered read ({data.matchingUnreadCount})</button>}
      </section>

      <div className={`notification-workspace${detailOpen ? " is-detail-open" : ""}`} aria-busy={loading}>
        <section className="notification-list-panel" aria-label="Notification history">
          <div className="notification-list-summary"><span>{data.total} matching event{data.total === 1 ? "" : "s"}</span>{loading && <span role="status">Updating…</span>}</div>
          {data.items.length ? (
            <div className="notification-event-list">
              {data.items.map((item, index) => {
                const group = timeGroup(item.createdAt);
                const showGroup = index === 0 || timeGroup(data.items[index - 1].createdAt) !== group;
                return (
                  <div key={item.id}>
                    {showGroup && <h2>{group}</h2>}
                    <button type="button" className={`notification-event${selected?.id === item.id ? " is-selected" : ""}${item.readAt ? " is-read" : " is-unread"}`} onClick={() => { setSelectedId(item.id); setDetailOpen(true); }}>
                      <span className={`notification-severity is-${item.severity.toLowerCase()}`}><SeverityIcon severity={item.severity} /></span>
                      <span className="notification-event-copy"><strong>{item.title}</strong><span>{item.body}</span><small>{labelCategory(item.category)} · {formatTime(item.createdAt)}</small></span>
                      <span className="notification-read-indicator" aria-label={item.readAt ? "Read" : "Unread"}>{item.readAt ? <CircleCheck /> : <Circle />}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="notification-empty-state"><Inbox aria-hidden="true" /><strong>{filters.state === "UNREAD" && !hasActiveFilters ? "No unread notifications" : "No notifications match these filters"}</strong><span>{filters.state === "UNREAD" && !hasActiveFilters ? "New operational events will appear here." : "Reset the filters or search the complete history."}</span>{hasActiveFilters && <button type="button" className="btn btn-secondary" onClick={() => { setQueryInput(""); void load({ state: "ALL" }); }}>Reset filters</button>}</div>
          )}
          {data.total > data.pageSize && <nav className="notification-pagination" aria-label="Notification history pages"><button type="button" className="btn btn-secondary" disabled={data.page <= 1 || loading} onClick={() => void load(filters, data.page - 1)}>Previous</button><span>Page {data.page} of {pageCount}</span><button type="button" className="btn btn-secondary" disabled={data.page >= pageCount || loading} onClick={() => void load(filters, data.page + 1)}>Next</button></nav>}
        </section>

        <aside className="notification-detail-panel" aria-label="Notification detail">
          {selected ? (
            <>
              <button type="button" className="notification-mobile-back" onClick={() => setDetailOpen(false)}><ArrowLeft aria-hidden="true" />Back to notifications</button>
              <header><div className={`notification-detail-icon is-${selected.severity.toLowerCase()}`}><SeverityIcon severity={selected.severity} /></div><div><span>{labelSeverity(selected.severity)} priority</span><h2>{selected.title}</h2></div></header>
              <p className="notification-detail-body">{selected.body}</p>
              <dl><div><dt>Category</dt><dd>{labelCategory(selected.category)}</dd></div><div><dt>Received</dt><dd><Clock3 aria-hidden="true" />{formatTime(selected.createdAt)}</dd></div><div><dt>State</dt><dd>{selected.readAt ? "Read" : "Unread"}</dd></div></dl>
              <div className="notification-detail-actions">
                <button type="button" className="btn btn-secondary" onClick={() => void setReadState(selected, !selected.readAt)}>{selected.readAt ? <Circle aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}{selected.readAt ? "Mark unread" : "Mark read"}</button>
                {selected.deepLink && canOpenLink(selected.deepLink) && <Link className="btn" href={selected.deepLink}>Open related record <ExternalLink aria-hidden="true" /></Link>}
              </div>
              {selected.deepLink && !canOpenLink(selected.deepLink) && <AdminNotice>You can read this notification, but the related workspace requires additional access.</AdminNotice>}
            </>
          ) : (
            <div className="notification-detail-empty"><Bell aria-hidden="true" /><strong>Select a notification</strong><span>Details and the permitted next action will appear here.</span></div>
          )}
        </aside>
      </div>
      </main>
      <AdminConfirmDialog open={confirmMarkAll} title="Mark filtered notifications as read?" description={`Mark ${data.matchingUnreadCount} matching unread notification${data.matchingUnreadCount === 1 ? "" : "s"} as read?`} confirmLabel="Mark as read" onCancel={() => setConfirmMarkAll(false)} onConfirm={markFilteredRead} />
    </>
  );
}
