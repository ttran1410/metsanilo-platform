import type { Meta, StoryObj } from "@storybook/react";
import { AdminNavigation } from "../navigation";

type NavigationItem = Parameters<typeof AdminNavigation>[0]["items"][number];
const items: NavigationItem[] = [
  { id: "dashboard", label: "Overview", group: "Operations", href: "/admin", enabled: true },
  { id: "triage", label: "Action required", group: "Operations", href: "/admin/orders?view=triage", enabled: true },
  { id: "orders", label: "Orders", group: "Operations", href: "/admin/orders", enabled: true },
  { id: "availability", label: "Availability", group: "Operations", href: "/admin/availability", enabled: true },
  { id: "manual-orders", label: "Manual order", group: "Operations", href: "/admin/manual-orders", enabled: true },
  { id: "customers", label: "Customers", group: "Catalog & customers", href: "/admin/customers", enabled: true },
  { id: "products", label: "Products", group: "Catalog & customers", href: "/admin/products", enabled: true },
  { id: "reviews", label: "Reviews", group: "Content & trust", href: "/admin/reviews", enabled: true },
  { id: "users", label: "Users & permissions", group: "Administration", href: "/admin/users", enabled: true },
  { id: "settings", label: "Settings", group: "Administration", href: "/admin/settings", enabled: true },
  { id: "audit", label: "Security & audit", group: "Administration", href: "/admin/audit", enabled: true },
];

function ShellStory({ limited = false }: { limited?: boolean }) {
  const visibleItems = limited ? items.filter((item) => !["users", "audit", "settings"].includes(item.id)) : items;
  return <div className="admin-shell-story"><AdminNavigation role={limited ? "STAFF" : "ADMIN"} displayName={limited ? "Mika Salonen" : "Tuan Huynh"} email={limited ? "mika@metsanilo.local" : "admin@metsanilo.local"} items={visibleItems} /><main className="admin-shell-story-content"><p className="eyebrow">Production shell</p><h1>Operations around every module.</h1><p>Navigation, command search, shortcuts, user context, permissions, and responsive rail behavior are rendered from the live shell.</p></main></div>;
}

const meta = { title: "Admin / Shell", component: ShellStory, parameters: { layout: "fullscreen" }, argTypes: { limited: { control: "boolean" } } } satisfies Meta<typeof ShellStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FullNavigation: Story = { args: { limited: false } };
export const LimitedNavigation: Story = { args: { limited: true } };
