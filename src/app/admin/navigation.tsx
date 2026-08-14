import type { Role } from "@/domain/access";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

type NavItem = { id: string; label: string; enabled: boolean };

export function AdminNavigation({ role, displayName, email, items }: { role: Role; displayName: string; email: string | null; items: NavItem[] }) {
  return <header className="admin-shell-header">
    <div className="admin-shell-brand">
      <Link className="admin-brand" href="/admin" aria-label="Metsänilo operations home">
        <span className="admin-brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span><strong>METSÄNILO</strong><small>Operations workspace</small></span>
      </Link>
      <div className="admin-header-actions"><span className="admin-user-state"><i aria-hidden="true" />{role}</span><AdminUserMenu displayName={displayName} email={email} role={role} /></div>
    </div>
    <nav aria-label="Admin modules" className="admin-nav">{items.filter((item) => item.enabled).map((item, index) => <Link href={item.id === "dashboard" ? "/admin" : `/admin/${item.id}`} key={item.id}><span aria-hidden="true">0{index + 1}</span>{item.label}</Link>)}</nav>
  </header>;
}

function AdminUserMenu({ displayName, email, role }: { displayName: string; email: string | null; role: Role }) {
  return <details className="admin-user-menu">
    <summary><span className="admin-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span><span className="admin-user-copy"><strong>{displayName}</strong><small>{email ?? role}</small></span><span aria-hidden="true">⌄</span></summary>
    <div className="admin-user-dropdown"><Link href="/admin/profile">My profile</Link><Link href="/admin/change-password">Change password</Link><Link href="/fi">View storefront</Link><div className="admin-user-divider" /><SignOutButton /></div>
  </details>;
}
