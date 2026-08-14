import type { Role } from "@/domain/access";
import Link from "next/link";

type NavItem = { id: string; label: string; enabled: boolean };

export function AdminNavigation({ role, items }: { role: Role; items: NavItem[] }) {
  return <header className="admin-shell-header">
    <div className="admin-shell-brand">
      <Link className="admin-brand" href="/admin" aria-label="Metsänilo operations home">
        <span className="admin-brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span><strong>METSÄNILO</strong><small>Operations workspace</small></span>
      </Link>
      <div className="admin-header-actions"><span className="admin-user-state"><i aria-hidden="true" />{role}</span><Link className="admin-public-link" href="/fi">View storefront <span aria-hidden="true">↗</span></Link></div>
    </div>
    <nav aria-label="Admin modules" className="admin-nav">{items.filter((item) => item.enabled).map((item, index) => <a href={`#${item.id}`} key={item.id}><span aria-hidden="true">0{index + 1}</span>{item.label}</a>)}</nav>
  </header>;
}
