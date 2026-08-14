import type { Role } from "@/domain/access";

type NavItem = { id: string; label: string; enabled: boolean };

export function AdminNavigation({ role, items }: { role: Role; items: NavItem[] }) {
  return <header className="admin-shell-header">
    <div className="admin-shell-brand"><div><p className="eyebrow">METSÄNILO OPERATIONS</p><h1>Admin portal</h1></div><span className="pill">{role}</span></div>
    <nav aria-label="Admin modules" className="admin-nav">{items.filter((item) => item.enabled).map((item) => <a href={`#${item.id}`} key={item.id}>{item.label}</a>)}</nav>
  </header>;
}
