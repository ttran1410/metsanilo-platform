"use client";

import type { Role } from "@/domain/access";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  BarChart3,
  AlertCircle,
  ShoppingBag,
  Calendar,
  PlusCircle,
  Users,
  Package,
  Settings,
  Search,
  Keyboard,
  Bell,
  ChevronLeft,
  ChevronRight,
  User,
  KeyRound,
  Store,
  ChevronDown,
  Shield,
  MessageSquareQuote,
  UserCog,
  X,
} from "lucide-react";
import { useAdminDialogFocus } from "./presentation";
import { SignOutButton } from "./sign-out-button";

type NavItem = { id: string; label: string; group: string; href?: string; enabled: boolean };
type OrderResult = { id: string; publicReference: string; customerName: string; mobile: string; status: string };
type TeamAlert = { id: string; title: string; body: string; createdAt: string; orderId: string | null };

function formatAlertCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

let navigationSummaryPromise: Promise<{ triageCount: number; unreadCount: number } | null> | null = null;
let navigationSummaryFetchedAt = 0;
let navigationOrderSearchPromise: Promise<OrderResult[]> | null = null;

type NavigationSummaryCache = {
  promise: Promise<{ triageCount: number; unreadCount: number } | null>;
  fetchedAt: number;
};

function fetchNavigationSummary() {
  const now = Date.now();
  const browserCache = typeof window !== "undefined"
    ? (window as Window & { __metsaniloNavigationSummary?: NavigationSummaryCache }).__metsaniloNavigationSummary
    : undefined;
  if (browserCache && now - browserCache.fetchedAt < 15_000) return browserCache.promise;
  if (navigationSummaryPromise && now - navigationSummaryFetchedAt < 15_000) return navigationSummaryPromise;
  navigationSummaryFetchedAt = now;
  navigationSummaryPromise = fetch("/api/admin/navigation-summary", { cache: "no-store", headers: { "x-admin-request-scope": "navigation-summary" } })
    .then(async (response) => {
      if (!response.ok) return null;
      const body = await response.json();
      return { triageCount: body.data?.triageCount ?? 0, unreadCount: body.data?.unreadCount ?? 0 };
    })
    .catch(() => null);
  if (typeof window !== "undefined") {
    (window as Window & { __metsaniloNavigationSummary?: NavigationSummaryCache }).__metsaniloNavigationSummary = { promise: navigationSummaryPromise, fetchedAt: now };
  }
  return navigationSummaryPromise;
}

function fetchNavigationOrderSearch() {
  if (navigationOrderSearchPromise) return navigationOrderSearchPromise;
  navigationOrderSearchPromise = fetch("/api/admin/orders", { cache: "no-store", headers: { "x-admin-request-scope": "navigation-command-search" } })
    .then(async (response) => {
      if (!response.ok) return [];
      const body = await response.json();
      return Array.isArray(body.data) ? body.data as OrderResult[] : [];
    })
    .catch(() => []);
  return navigationOrderSearchPromise;
}

function NavIcon({ id }: { id: string }) {
  const props = { className: "w-4 h-4 stroke-[1.8]" };
  switch (id) {
    case "dashboard": return <LayoutDashboard {...props} />;
    case "notifications": return <Bell {...props} />;
    case "reports": return <BarChart3 {...props} />;
    case "triage": return <AlertCircle {...props} />;
    case "orders": return <ShoppingBag {...props} />;
    case "availability": return <Calendar {...props} />;
    case "manual-orders": return <PlusCircle {...props} />;
    case "customers": return <Users {...props} />;
    case "reviews": return <MessageSquareQuote {...props} />;
    case "products": return <Package {...props} />;
    case "users": return <UserCog {...props} />;
    case "settings": return <Settings {...props} />;
    case "audit": return <Shield {...props} />;
    default: return <Shield {...props} />;
  }
}

export function AdminNavigation({ role, displayName, email, items }: { role: Role; displayName: string; email: string | null; items: NavItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<OrderResult[]>([]);
  const [triageCount, setTriageCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<TeamAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const alertsDialogRef = useAdminDialogFocus(alertsOpen, () => setAlertsOpen(false));
  const paletteDialogRef = useAdminDialogFocus(paletteOpen, () => setPaletteOpen(false));
  const helpDialogRef = useAdminDialogFocus(helpOpen, () => setHelpOpen(false));
  const searchRef = useRef<HTMLInputElement>(null);
  const canReadNotifications = items.some((item) => item.id === "notifications" && item.enabled);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      try { setCollapsed(window.localStorage.getItem("metsanilo-admin-rail") === "collapsed"); } catch { /* Preference is optional. */ }
    }, 0);
    return () => window.clearTimeout(initial);
  }, [pathname]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(true); }
      if (event.key === "?" && !isTyping(event.target)) { event.preventDefault(); setHelpOpen(true); }
      if (event.key === "Escape") { setPaletteOpen(false); setHelpOpen(false); setAlertsOpen(false); }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  async function openAlerts() {
    setAlertsOpen(true);
    setAlertsLoading(true);
    try {
      const response = await fetch("/api/admin/notifications?view=recent&state=UNREAD", { cache: "no-store", headers: { "x-admin-request-scope": "navigation-alerts" } });
      const body = await response.json();
      if (response.ok) setAlerts(body.data ?? []);
    } finally {
      setAlertsLoading(false);
    }
  }

  async function markAlertsRead(id?: string) {
    await fetch(id ? `/api/admin/notifications/${id}/read` : "/api/admin/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(id
        ? { action: "read", id }
        : { action: "mark-filtered-read", filters: { state: "UNREAD" } }),
    });
    if (id) setAlerts((current) => current.filter((alert) => alert.id !== id));
    else setAlerts([]);
    setUnreadCount((count) => id ? Math.max(0, count - 1) : 0);
  }

  useEffect(() => { if (paletteOpen) window.setTimeout(() => searchRef.current?.focus(), 0); }, [paletteOpen]);

  useEffect(() => {
    async function refreshBadges() {
      try {
        const summary = await fetchNavigationSummary();
        if (!summary) return;
        setTriageCount(summary.triageCount);
        setUnreadCount(summary.unreadCount);
      } catch { /* Badges are supplementary. */ }
    }
    void refreshBadges();
    const syncNotifications = (event: Event) => setUnreadCount((event as CustomEvent<number>).detail);
    window.addEventListener("metsanilo:notifications-updated", syncNotifications);
    const interval = window.setInterval(() => { if (!document.hidden) void refreshBadges(); }, 30_000);
    return () => { window.clearInterval(interval); window.removeEventListener("metsanilo:notifications-updated", syncNotifications); };
  }, []);

  useEffect(() => {
    if (!paletteOpen || orders.length) return;
    const initial = window.setTimeout(() => void fetchNavigationOrderSearch().then(setOrders), 0);
    return () => window.clearTimeout(initial);
  }, [orders.length, paletteOpen]);

  const commands = useMemo(() => {
    const value = query.trim().toLowerCase();
    const routes = items.filter(({ enabled }) => enabled).map((item) => ({ id: `route-${item.id}`, label: item.label, detail: "Go to module", href: item.href ?? (item.id === "dashboard" ? "/admin" : `/admin/${item.id}`) }));
    const orderCommands = orders.map((order) => ({ id: `order-${order.id}`, label: `${order.publicReference} · ${order.customerName}`, detail: `${order.status.replaceAll("_", " ")} · ${order.mobile}`, href: `/admin/orders/${order.id}` }));
    return [...routes, ...orderCommands].filter((command) => !value || `${command.label} ${command.detail}`.toLowerCase().includes(value)).slice(0, 10);
  }, [items, orders, query]);

  function toggleRail() {
    const next = !collapsed;
    setCollapsed(next);
    try { window.localStorage.setItem("metsanilo-admin-rail", next ? "collapsed" : "expanded"); } catch { /* Preference is optional. */ }
  }

  return <header className={`admin-shell-header${collapsed ? " rail-collapsed" : ""}`} data-collapsed={collapsed || undefined}>
    <div className="admin-shell-brand">
      <Link className="admin-brand" href="/admin" aria-label="Metsänilo operations home"><span className="admin-brand-mark" aria-hidden="true"><i /><i /><i /></span><span><strong>Metsänilo</strong><small>Operations</small></span></Link>
      <div className="admin-header-actions">
        <div className="admin-quick-tools" aria-label="Operations shortcuts">
          <button className="admin-quick-tool" type="button" onClick={() => setPaletteOpen(true)} aria-label="Open command search">
            <Search className="w-3.5 h-3.5" />
            <span>Quick search</span>
            <kbd>⌘K</kbd>
          </button>
          <button className="admin-quick-tool admin-icon-button" type="button" onClick={() => setHelpOpen(true)} aria-label="Open keyboard shortcuts" title="Keyboard shortcuts">
            <Keyboard className="w-3.5 h-3.5" />
          </button>
          {canReadNotifications && <button className="admin-quick-tool admin-icon-button" type="button" onClick={() => void openAlerts()} aria-label={`${unreadCount} unread team alerts`} title="Team alerts">
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && <b className="admin-header-badge" aria-label={`${unreadCount} unread alerts`}>{formatAlertCount(unreadCount)}</b>}
          </button>}
          <Link className={`admin-quick-tool admin-icon-button${triageCount > 0 ? " is-attention" : ""}`} href="/admin/orders?view=triage" aria-label={`${triageCount} orders needing attention`} title="Orders needing attention">
            <AlertCircle className="w-3.5 h-3.5" />
            {triageCount > 0 && <b className="admin-header-badge" aria-label={`${triageCount} orders needing attention`}>{formatAlertCount(triageCount)}</b>}
          </Link>
        </div>
        <AdminUserMenu displayName={displayName} email={email} role={role} />
      </div>
      <button className="admin-menu-toggle" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen((open) => !open)}><span className="admin-menu-icon" aria-hidden="true"><i /><i /><i /></span><span>{menuOpen ? "Close" : "Menu"}</span></button>
    </div>
    <aside id="admin-navigation" className={`admin-sidebar${menuOpen ? " open" : ""}${collapsed ? " collapsed" : ""}`} data-open={menuOpen || undefined} data-collapsed={collapsed || undefined}>
      <button
        className="admin-rail-edge-toggle"
        type="button"
        onClick={toggleRail}
        aria-label={collapsed ? "Expand sidebar navigation" : "Collapse sidebar navigation"}
        title={collapsed ? "Expand sidebar navigation" : "Collapse sidebar navigation"}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5 stroke-[2]" /> : <ChevronLeft className="w-3.5 h-3.5 stroke-[2]" />}
      </button>

      <nav aria-label="Operations modules" className="admin-nav">
        {Array.from(new Set(items.filter((item) => item.enabled).map((item) => item.group))).map((group) => (
          <div className="admin-nav-group" key={group}>
            <span className="admin-nav-group-label">{group}</span>
            {items.filter((item) => item.enabled && item.group === group).map((item) => {
              const href = item.href ?? (item.id === "dashboard" ? "/admin" : `/admin/${item.id}`);
              const active = item.id === "dashboard" ? pathname === "/admin" : item.id === "orders" ? pathname === "/admin/orders" : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  className={`admin-nav-link${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  href={href}
                  onClick={() => {
                    setMenuOpen(false);
                  }}
                  key={item.id}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="admin-nav-icon" aria-hidden="true"><NavIcon id={item.id} /></span>
                  <span className="admin-nav-label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        {!collapsed && <span>Need help?</span>}
        {!collapsed && <a href="mailto:tranthanhtuan1410@gmail.com">Contact support</a>}
      </div>
    </aside>

    {alertsOpen && <div className="admin-command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAlertsOpen(false); }}><section ref={alertsDialogRef} className="admin-shortcut-help admin-alerts-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-alerts-title"><div className="section-inline-heading"><div><p className="eyebrow">Operations inbox</p><h2 id="admin-alerts-title">Recent unread</h2></div><button type="button" onClick={() => setAlertsOpen(false)} aria-label="Close team alerts"><X aria-hidden="true" /></button></div>{alertsLoading ? <p className="muted">Loading alerts…</p> : alerts.length === 0 ? <p className="muted">You’re all caught up.</p> : <div className="admin-alerts-list">{alerts.map((alert) => <article key={alert.id}><div><strong>{alert.title}</strong><p>{alert.body}</p><small>{new Date(alert.createdAt).toLocaleString("en-FI")}</small></div><div className="admin-alert-actions">{alert.orderId && <Link href={`/admin/orders/${alert.orderId}`} onClick={() => setAlertsOpen(false)}>View order</Link>}<button type="button" onClick={() => void markAlertsRead(alert.id)}>Mark read</button></div></article>)}</div>}<div className="admin-alerts-footer">{alerts.length > 0 && <button className="btn btn-secondary" type="button" onClick={() => void markAlertsRead()}>Mark all as read</button>}<Link className="btn" href="/admin/notifications" onClick={() => setAlertsOpen(false)}>Open inbox</Link></div></section></div>}
    {paletteOpen && <div className="admin-command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}><section ref={paletteDialogRef} className="admin-command-palette" role="dialog" aria-modal="true" aria-labelledby="admin-command-title"><h2 id="admin-command-title" className="sr-only">Command search</h2><label><span aria-hidden="true"><Search className="w-4 h-4 text-slate-400" /></span><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && commands[0]) { event.preventDefault(); setPaletteOpen(false); router.push(commands[0].href); } }} placeholder="Search orders or go to a module…" /></label><div className="admin-command-results">{commands.map((command) => <Link href={command.href} key={command.id} onClick={() => setPaletteOpen(false)}><span><strong>{command.label}</strong><small>{command.detail}</small></span><kbd>↵</kbd></Link>)}{commands.length === 0 && <p>No matching commands.</p>}</div><footer><span>Type to search · Enter opens first result</span><span><kbd>Esc</kbd> close</span></footer></section></div>}
    {helpOpen && <div className="admin-command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}><section ref={helpDialogRef} className="admin-shortcut-help" role="dialog" aria-modal="true" aria-labelledby="shortcut-help-title"><div className="section-inline-heading"><div><p className="eyebrow">Operations</p><h2 id="shortcut-help-title">Keyboard shortcuts</h2></div><button type="button" onClick={() => setHelpOpen(false)} aria-label="Close shortcuts"><X aria-hidden="true" /></button></div><dl><div><dt><kbd>⌘/Ctrl K</kbd></dt><dd>Search orders and modules</dd></div><div><dt><kbd>J / K</kbd></dt><dd>Move through the order queue</dd></div><div><dt><kbd>Enter</kbd></dt><dd>View the focused order</dd></div><div><dt><kbd>E</kbd></dt><dd>Prepare the next order action</dd></div><div><dt><kbd>Esc</kbd></dt><dd>Close the active panel</dd></div><div><dt><kbd>?</kbd></dt><dd>Show this shortcut list</dd></div></dl></section></div>}
  </header>;
}

function isTyping(target: EventTarget | null) { return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable); }

function AdminUserMenu({ displayName, email, role }: { displayName: string; email: string | null; role: Role }) {
  return (
    <details className="admin-user-menu">
      <summary>
        <span className="admin-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>
        <span className="admin-user-copy"><strong>{displayName}</strong><small>{email ?? role}</small></span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </summary>
      <div className="admin-user-dropdown">
        <Link href="/admin/profile" className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-slate-500" />
          <span>My profile</span>
        </Link>
        <Link href="/admin/change-password" className="flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5 text-slate-500" />
          <span>Change password</span>
        </Link>
        <Link href="/fi" className="flex items-center gap-2">
          <Store className="w-3.5 h-3.5 text-slate-500" />
          <span>View storefront</span>
        </Link>
        <div className="admin-user-divider" />
        <SignOutButton />
      </div>
    </details>
  );
}
