import { db } from "@/db/client";
import { listManagerAvailability } from "@/domain/availability";
import { listManagerOrders } from "@/domain/orders";
import { listManagerProducts } from "@/domain/products";
import { ManagerView } from "./view";
import { ProductModule } from "./products";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ManagerPage() {
  const [orders, availability, products] = await Promise.all([
    listManagerOrders(db()),
    listManagerAvailability(db()),
    listManagerProducts(db()),
  ]);
  return <><ManagerView initialOrders={orders} initialAvailability={availability} /><div className="shell pb-10"><ProductModule initialProducts={products} /></div></>;
}
