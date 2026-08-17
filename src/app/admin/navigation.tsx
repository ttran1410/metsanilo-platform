"use client";

import type { Role } from "@/domain/access";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
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
} from "lucide-react";
import { SignOutButton } from "./sign-out-button";

type NavItem = { id: string; label: string; group: string; href?: string; enabled: boolean };
type OrderResult = { id: string; publicReference: string; customerName: string; mobile: string; status: string };

function NavIcon({ id }: { id: string }) {
  const props = { className: "w-4 h-4 stroke-[1.8]" };
  switch (id) {
    case "dashboard": return <LayoutDashboard {...props} />;
    case "triage": return <AlertCircle {...props} />;
    case "orders": return <ShoppingBag {...props} />;
    case "availability": return <Calendar {...props} />;
    case "manual-orders": return <PlusCircle {...props} />;
    case "customers": return <Users {...props} />;
    case "products": return <Package {...props} />;
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
  const [triageActive, setTriageActive] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      setTriageActive(pathname === "/admin/orders" && new URLSearchParams(window.location.search).get("view")?.toLowerCase() === "triage");
      try { setCollapsed(window.localStorage.getItem("metsanilo-admin-rail") === "collapsed"); } catch { /* Preference is optional. */ }
    }, 0);
    return () => window.clearTimeout(initial);
  }, [pathname]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(true); }
      if (event.key === "?" && !isTyping(event.target)) { event.preventDefault(); setHelpOpen(true); }
      if (event.key === "Escape") { setPaletteOpen(false); setHelpOpen(false); }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  useEffect(() => { if (paletteOpen) window.setTimeout(() => searchRef.current?.focus(), 0); }, [paletteOpen]);

  useEffect(() => {
    async function refreshBadges() {
      try {
        const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json();
        setTriageCount(body.data.attentionCount ?? body.data.overdueNew?.length ?? 0);
        setUnreadCount(body.data.unreadNotifications ?? 0);
      } catch { /* Badges are supplementary. */ }
    }
    void refreshBadges();
    const interval = window.setInterval(() => { if (!document.hidden) void refreshBadges(); }, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!paletteOpen || orders.length) return;
    const initial = window.setTimeout(() => void fetch("/api/admin/orders", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const body = await response.json();
      setOrders(body.data);
    }).catch(() => undefined), 0);
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

  return <header className={`admin-shell-header${collapsed ? " rail-collapsed" : ""}`}>
    <div className="admin-shell-brand">
      <Link className="admin-brand" href="/admin" aria-label="Metsänilo operations home"><span className="admin-brand-mark" aria-hidden="true"><i /><i /><i /></span><span><strong>METSÄNILO</strong><small>Operations</small></span></Link>
      <div className="admin-header-actions">
        <div className="admin-quick-tools" aria-label="Operations shortcuts">
          <button className="admin-quick-tool" type="button" onClick={() => setPaletteOpen(true)} aria-label="Open command search">
            <Search className="w-3.5 h-3.5" />
            <span>Quick search</span>
            <kbd>⌘K</kbd>
          </button>
          <button className="admin-quick-tool" type="button" onClick={() => setHelpOpen(true)}>
            <Keyboard className="w-3.5 h-3.5" />
            <span>Shortcuts</span>
          </button>
          <Link className="admin-quick-tool" href="/admin/orders?view=triage" aria-label={`${triageCount} action required, ${unreadCount} unread notifications`}>
            <Bell className="w-3.5 h-3.5" />
            <span>Alerts</span>
            {triageCount > 0 && <b className="admin-header-badge">{triageCount}</b>}
          </Link>
        </div>
        <span className="admin-user-state"><i aria-hidden="true" />{role}</span>
        <AdminUserMenu displayName={displayName} email={email} role={role} />
      </div>
      <button className="admin-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen((open) => !open)}><span className="admin-menu-icon" aria-hidden="true"><i /><i /><i /></span><span>{menuOpen ? "Close" : "Menu"}</span></button>
    </div>
    <aside id="admin-navigation" className={`admin-sidebar${menuOpen ? " open" : ""}${collapsed ? " collapsed" : ""}`}>
      {/* SLEEK EDGE ARROW COLLAPSE TOGGLE ALIGNED WITH OVERVIEW */}
      <button
        className="admin-rail-edge-toggle"
        type="button"
        onClick={toggleRail}
        aria-label={collapsed ? "Expand sidebar navigation" : "Collapse sidebar navigation"}
        title={collapsed ? "Expand sidebar navigation" : "Collapse sidebar navigation"}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5 stroke-[2]" /> : <ChevronLeft className="w-3.5 h-3.5 stroke-[2]" />}
      </button>

      <nav aria-label="Admin modules" className="admin-nav">
        {Array.from(new Set(items.filter((item) => item.enabled).map((item) => item.group))).map((group) => (
          <div className="admin-nav-group" key={group}>
            <span className="admin-nav-group-label">{group}</span>
            {items.filter((item) => item.enabled && item.group === group).map((item) => {
              const href = item.href ?? (item.id === "dashboard" ? "/admin" : `/admin/${item.id}`);
              const active = item.id === "triage" ? triageActive : item.id === "dashboard" ? pathname === "/admin" : item.id === "orders" ? pathname === "/admin/orders" && !triageActive : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  className={active ? "active" : ""}
                  aria-current={active ? "page" : undefined}
                  href={href}
                  onClick={() => {
                    setMenuOpen(false);
                    if (item.id === "triage") setTriageActive(true);
                    if (item.id === "orders") setTriageActive(false);
                  }}
                  key={item.id}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="admin-nav-icon" aria-hidden="true"><NavIcon id={item.id} /></span>
                  <span className="admin-nav-label">{item.label}</span>
                  {item.id === "triage" && triageCount > 0 && <b className="admin-nav-badge">{triageCount}</b>}
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

    {paletteOpen && <div className="admin-command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}><section className="admin-command-palette" role="dialog" aria-modal="true" aria-labelledby="admin-command-title"><h2 id="admin-command-title" className="sr-only">Command search</h2><label><span aria-hidden="true"><Search className="w-4 h-4 text-slate-400" /></span><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && commands[0]) { event.preventDefault(); setPaletteOpen(false); router.push(commands[0].href); } }} placeholder="Search orders or go to a module…" /></label><div className="admin-command-results">{commands.map((command) => <Link href={command.href} key={command.id} onClick={() => setPaletteOpen(false)}><span><strong>{command.label}</strong><small>{command.detail}</small></span><kbd>↵</kbd></Link>)}{commands.length === 0 && <p>No matching commands.</p>}</div><footer><span>Type to search · Enter opens first result</span><span><kbd>Esc</kbd> close</span></footer></section></div>}
    {helpOpen && <div className="admin-command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}><section className="admin-shortcut-help" role="dialog" aria-modal="true" aria-labelledby="shortcut-help-title"><div className="section-inline-heading"><div><p className="eyebrow">OPERATIONS</p><h2 id="shortcut-help-title">Keyboard shortcuts</h2></div><button type="button" onClick={() => setHelpOpen(false)} aria-label="Close shortcuts">×</button></div><dl><div><dt><kbd>⌘/Ctrl K</kbd></dt><dd>Search orders and modules</dd></div><div><dt><kbd>J / K</kbd></dt><dd>Move through the order queue</dd></div><div><dt><kbd>Enter</kbd></dt><dd>View the focused order</dd></div><div><dt><kbd>E</kbd></dt><dd>Prepare the next order action</dd></div><div><dt><kbd>Esc</kbd></dt><dd>Close the active panel</dd></div><div><dt><kbd>?</kbd></dt><dd>Show this shortcut list</dd></div></dl></section></div>}
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
