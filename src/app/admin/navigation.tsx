"use client";

import type { Role } from "@/domain/access";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignOutButton } from "./sign-out-button";

type NavItem = { id: string; label: string; group: string; enabled: boolean };

export function AdminNavigation({ role, displayName, email, items }: { role: Role; displayName: string; email: string | null; items: NavItem[] }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className="admin-shell-header">
    <div className="admin-shell-brand">
      <Link className="admin-brand" href="/admin" aria-label="Metsänilo operations home">
        <span className="admin-brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span><strong>METSÄNILO</strong><small>Operations</small></span>
      </Link>
      <div className="admin-header-actions"><span className="admin-user-state"><i aria-hidden="true" />{role}</span><AdminUserMenu displayName={displayName} email={email} role={role} /></div>
      <button className="admin-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen((open) => !open)}><span className="admin-menu-icon" aria-hidden="true"><i /><i /><i /></span><span>Menu</span></button>
    </div>
    <aside id="admin-navigation" className={`admin-sidebar${menuOpen ? " open" : ""}`}><nav aria-label="Admin modules" className="admin-nav">{Array.from(new Set(items.filter((item) => item.enabled).map((item) => item.group))).map((group) => <div className="admin-nav-group" key={group}><span className="admin-nav-group-label">{group}</span>{items.filter((item) => item.enabled && item.group === group).map((item) => { const href = item.id === "dashboard" ? "/admin" : `/admin/${item.id}`; const active = item.id === "dashboard" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`); return <Link className={active ? "active" : ""} href={href} onClick={() => setMenuOpen(false)} key={item.id}><span className="admin-nav-icon" aria-hidden="true">{item.id === "dashboard" ? "⌂" : item.id === "orders" ? "▤" : item.id === "availability" ? "◒" : item.id === "manual-orders" ? "＋" : item.id === "customers" ? "◉" : item.id === "products" ? "□" : item.id === "settings" ? "⚙" : "♙"}</span><span>{item.label}</span></Link>; })}</div>)}</nav><div className="admin-sidebar-footer"><span>Need help?</span><a href="mailto:tranthanhtuan1410@gmail.com">Contact support</a></div></aside>
  </header>;
}

function AdminUserMenu({ displayName, email, role }: { displayName: string; email: string | null; role: Role }) {
  return <details className="admin-user-menu">
    <summary><span className="admin-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span><span className="admin-user-copy"><strong>{displayName}</strong><small>{email ?? role}</small></span><span aria-hidden="true">⌄</span></summary>
    <div className="admin-user-dropdown"><Link href="/admin/profile">My profile</Link><Link href="/admin/change-password">Change password</Link><Link href="/fi">View storefront</Link><div className="admin-user-divider" /><SignOutButton /></div>
  </details>;
}
