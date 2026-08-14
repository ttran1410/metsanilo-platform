import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { currentUser, requirePermission, type Permission } from "@/domain/access";

export async function adminContext() {
  const incomingHeaders = await headers();
  const request = new Request("http://internal/admin", { headers: incomingHeaders });
  const actor = await currentUser(db(), request);
  if (actor.mustChangePassword) redirect("/admin/change-password");
  return { actor, request };
}

export async function hasAdminPermission(request: Request, permission: Permission) {
  try { await requirePermission(db(), request, permission); return true; } catch { return false; }
}

export async function adminNavigation(request: Request) {
  return [
    { id: "dashboard", label: "Dashboard", enabled: await hasAdminPermission(request, "orders.read") },
    { id: "orders", label: "Orders", enabled: await hasAdminPermission(request, "orders.read") },
    { id: "availability", label: "Availability", enabled: await hasAdminPermission(request, "availability.write") },
    { id: "customers", label: "Customers", enabled: await hasAdminPermission(request, "customers.read") },
    { id: "manual-orders", label: "Manual orders", enabled: await hasAdminPermission(request, "orders.create") },
    { id: "products", label: "Products", enabled: await hasAdminPermission(request, "catalog.product.write") },
    { id: "settings", label: "Settings", enabled: await hasAdminPermission(request, "settings.operational") },
    { id: "users", label: "Users & permissions", enabled: await hasAdminPermission(request, "shop_users.manage") },
  ];
}
