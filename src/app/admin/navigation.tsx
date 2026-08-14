"use client";

import type { Role } from "@/domain/access";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignOutButton } from "./sign-out-button";

type NavItem = { id: string; label: string; enabled: boolean };

export function AdminNavigation({ role, displayName, email, items }: { role: Role; displayName: string; email: string | null; items: NavItem[] }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className="admin-shell-header">
    <div className="admin-shell-brand">
      <Link className="admin-brand" href="/admin" aria-label="Metsänilo operations home">
        <span className="admin-brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span><strong>METSÄNILO</strong><small>Operations workspace</small></span>
      </Link>
      <div className="admin-header-actions"><span className="admin-user-state"><i aria-hidden="true" />{role}</span><AdminUserMenu displayName={displayName} email={email} role={role} /></div>
      <button className="admin-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen((open) => !open)}>Menu <span aria-hidden="true">☰</span></button>
    </div>
    <aside id="admin-navigation" className={`admin-sidebar${menuOpen ? " open" : ""}`}><nav aria-label="Admin modules" className="admin-nav">{items.filter((item) => item.enabled).map((item, index) => { const href = item.id === "dashboard" ? "/admin" : `/admin/${item.id}`; const active = item.id === "dashboard" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`); return <Link className={active ? "active" : ""} href={href} onClick={() => setMenuOpen(false)} key={item.id}><span aria-hidden="true">0{index + 1}</span>{item.label}</Link>; })}</nav><div className="admin-sidebar-footer"><span>Need help?</span><a href="mailto:tranthanhtuan1410@gmail.com">Contact support</a></div></aside>
  </header>;
}

function AdminUserMenu({ displayName, email, role }: { displayName: string; email: string | null; role: Role }) {
  return <details className="admin-user-menu">
    <summary><span className="admin-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span><span className="admin-user-copy"><strong>{displayName}</strong><small>{email ?? role}</small></span><span aria-hidden="true">⌄</span></summary>
    <div className="admin-user-dropdown"><Link href="/admin/profile">My profile</Link><Link href="/admin/change-password">Change password</Link><Link href="/fi">View storefront</Link><div className="admin-user-divider" /><SignOutButton /></div>
  </details>;
}
