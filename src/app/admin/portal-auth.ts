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
    { id: "dashboard", label: "Overview", group: "Operations", enabled: await hasAdminPermission(request, "dashboard.read") },
    { id: "orders", label: "Orders", group: "Operations", enabled: await hasAdminPermission(request, "orders.read") },
    { id: "availability", label: "Harvest availability", group: "Operations", enabled: await hasAdminPermission(request, "availability.read") },
    { id: "customers", label: "Customers", group: "Catalog & customers", enabled: await hasAdminPermission(request, "customers.read") },
    { id: "reviews", label: "Reviews", group: "Catalog & customers", enabled: await hasAdminPermission(request, "reviews.read") },
    { id: "products", label: "Product catalog", group: "Catalog & customers", enabled: await hasAdminPermission(request, "catalog.product.read") },
    { id: "settings", label: "Settings", group: "Administration", enabled: await hasAdminPermission(request, "settings.read") },
    { id: "users", label: "Users & permissions", group: "Administration", enabled: await hasAdminPermission(request, "shop_users.read") },
  ];
}
