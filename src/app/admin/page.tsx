import { db } from "@/db/client";
import { requirePermission, type Permission } from "@/domain/access";
import { listManagerAvailability } from "@/domain/availability";
import { listManagerOrders } from "@/domain/orders";
import { listManagerProducts } from "@/domain/products";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "@/domain/access";
import { ManagerView } from "./view";
import { ProductModule } from "./products";
import { UserModule } from "./users";
import { OperationsSettings } from "./settings";
import { DashboardModule } from "./dashboard";
import { CustomersModule } from "./customers";
import { ManualOrdersModule } from "./manual-orders";
import { AdminNavigation } from "./navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ManagerPage() {
  const incomingHeaders = await headers();
  const request = new Request("http://internal/admin", { headers: incomingHeaders });
  const actor = await currentUser(db(), request);
  if (actor.mustChangePassword) redirect("/admin/change-password");
  const allowed = async (permission: Permission) => {
    try { await requirePermission(db(), request, permission); return true; } catch { return false; }
  };
  const [ordersAllowed, availabilityAllowed, productsAllowed] = await Promise.all([allowed("orders.read"), allowed("availability.write"), allowed("catalog.product.write")]);
  const [orders, availability, products] = await Promise.all([
    ordersAllowed ? listManagerOrders(db()) : Promise.resolve([]),
    availabilityAllowed ? listManagerAvailability(db()) : Promise.resolve([]),
    productsAllowed ? listManagerProducts(db()) : Promise.resolve([]),
  ]);
  const navigation = [
    { id: "dashboard", label: "Dashboard", enabled: ordersAllowed },
    { id: "orders", label: "Orders", enabled: ordersAllowed },
    { id: "availability", label: "Availability", enabled: availabilityAllowed },
    { id: "customers", label: "Customers", enabled: await allowed("customers.read") },
    { id: "manual-orders", label: "Manual orders", enabled: await allowed("orders.create") },
    { id: "products", label: "Products", enabled: productsAllowed },
    { id: "settings", label: "Settings", enabled: await allowed("settings.operational") },
    { id: "users", label: "Users & permissions", enabled: await allowed("shop_users.manage") },
  ];
  return <><AdminNavigation role={actor.role} items={navigation} />
    {ordersAllowed && <div id="dashboard"><DashboardModule /></div>}
    {(ordersAllowed || availabilityAllowed) && <ManagerView initialOrders={orders} initialAvailability={availability} canViewOrders={ordersAllowed} canManageAvailability={availabilityAllowed} />}
    {navigation[3].enabled && <div id="customers"><CustomersModule /></div>}
    {navigation[4].enabled && <div id="manual-orders"><ManualOrdersModule products={products} /></div>}
    {productsAllowed && <div id="products" className="shell pb-10"><ProductModule initialProducts={products} /></div>}
    {navigation[6].enabled && <div id="settings"><OperationsSettings /></div>}
    {navigation[7].enabled && <div id="users"><UserModule /></div>}
  </>;
}
