import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { listManagerAvailability } from "@/domain/availability";
import { listManagerOrders } from "@/domain/orders";
import { listManagerProducts } from "@/domain/products";
import { headers } from "next/headers";
import { ManagerView } from "./view";
import { ProductModule } from "./products";
import { UserModule } from "./users";
import { OperationsSettings } from "./settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ManagerPage() {
  const authorization = (await headers()).get("authorization");
  const request = new Request("http://internal/manager", { headers: authorization ? { authorization } : undefined });
  const allowed = async (permission: "orders.read" | "availability.write" | "catalog.product.write") => {
    try { await requirePermission(db(), request, permission); return true; } catch { return false; }
  };
  const [ordersAllowed, availabilityAllowed, productsAllowed] = await Promise.all([allowed("orders.read"), allowed("availability.write"), allowed("catalog.product.write")]);
  const [orders, availability, products] = await Promise.all([
    ordersAllowed ? listManagerOrders(db()) : Promise.resolve([]),
    availabilityAllowed ? listManagerAvailability(db()) : Promise.resolve([]),
    productsAllowed ? listManagerProducts(db()) : Promise.resolve([]),
  ]);
  return <><ManagerView initialOrders={orders} initialAvailability={availability} /><div className="shell pb-10"><ProductModule initialProducts={products} /></div><OperationsSettings /><UserModule /></>;
}
