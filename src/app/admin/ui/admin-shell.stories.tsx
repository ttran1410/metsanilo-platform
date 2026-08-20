import type { Meta, StoryObj } from "@storybook/react";
import { AlertCircle, Bell, CalendarDays, ChevronLeft, ChevronRight, CircleHelp, LayoutDashboard, Package, Search, Settings2, ShoppingBasket, Users } from "lucide-react";

type ShellPreviewProps = { collapsed?: boolean; mobileMenuOpen?: boolean; permissionLimited?: boolean };

const groups = [
  ["Operations", [["Overview", LayoutDashboard], ["Action required", AlertCircle], ["Orders", ShoppingBasket], ["Availability", CalendarDays]]],
  ["Catalog & customers", [["Customers", Users], ["Products", Package]]],
  ["Administration", [["Settings", Settings2]]],
] as const;

function ShellPreview({ collapsed = false, mobileMenuOpen = false, permissionLimited = false }: ShellPreviewProps) {
  return (
    <div className="admin-app admin-shell-story">
      <header className={`admin-shell-header${collapsed ? " rail-collapsed" : ""}`}>
        <div className="admin-shell-brand">
          <a className="admin-brand" href="#overview" aria-label="Metsänilo operations home"><span className="admin-brand-mark" aria-hidden="true"><i /><i /><i /></span><span><strong>METSÄNILO</strong><small>Operations desk</small></span></a>
          <div className="admin-header-actions"><div className="admin-quick-tools" aria-label="Operations shortcuts"><button className="admin-quick-tool" type="button"><Search size={14} /><span>Quick search</span><kbd>⌘K</kbd></button><button className="admin-quick-tool" type="button"><CircleHelp size={14} /><span>Shortcuts</span></button><button className="admin-quick-tool" type="button"><Bell size={14} /><span>Alerts</span><b className="admin-header-badge">3</b></button></div><span className="admin-user-state"><i />ADMIN</span><button className="admin-shell-story-user" type="button"><span className="admin-avatar">T</span><span><strong>Tuan Huynh</strong><small>admin@metsanilo.local</small></span></button></div>
          <button className="admin-menu-toggle" type="button" aria-expanded={mobileMenuOpen}><span className="admin-menu-icon" aria-hidden="true"><i /><i /><i /></span><span>{mobileMenuOpen ? "Close" : "Menu"}</span></button>
        </div>
      </header>
      <aside className={`admin-sidebar${collapsed ? " collapsed" : ""}${mobileMenuOpen ? " open" : ""}`}>
        <button className="admin-rail-edge-toggle" type="button" aria-label={collapsed ? "Expand sidebar navigation" : "Collapse sidebar navigation"}>{collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}</button>
        <nav className="admin-nav" aria-label="Operations modules">{groups.map(([group, items]) => <div className="admin-nav-group" key={group}><span className="admin-nav-group-label">{group}</span>{items.filter(([label]) => !(permissionLimited && label === "Products")).map(([label, Icon], index) => <a className={`admin-nav-link${index === 0 && group === "Operations" ? " active" : ""}`} href={`#${label}`} key={label}><span className="admin-nav-icon"><Icon size={16} /></span><span className="admin-nav-label">{label}</span>{label === "Action required" && <b className="admin-nav-badge">3</b>}</a>)}</div>)}</nav>
        <div className="admin-sidebar-footer"><span>Need help?</span><a href="mailto:support@metsanilo.local">Contact support</a></div>
      </aside>
      <main className="admin-shell-story-content"><p className="eyebrow">Shell preview</p><h1>The workbench around every module.</h1><p>Navigation, permissions, alerts, and operator context stay consistent while the workspace changes.</p></main>
    </div>
  );
}

const meta = { title: "Admin / Shell", component: ShellPreview, parameters: { layout: "fullscreen" }, argTypes: { collapsed: { control: "boolean" }, mobileMenuOpen: { control: "boolean" }, permissionLimited: { control: "boolean" } } } satisfies Meta<typeof ShellPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Full: Story = { args: { collapsed: false, mobileMenuOpen: false, permissionLimited: false } };
export const Collapsed: Story = { args: { collapsed: true, mobileMenuOpen: false, permissionLimited: false } };
export const MobileDrawerOpen: Story = { args: { collapsed: false, mobileMenuOpen: true, permissionLimited: false } };
export const LimitedNavigation: Story = { args: { collapsed: false, mobileMenuOpen: false, permissionLimited: true } };
