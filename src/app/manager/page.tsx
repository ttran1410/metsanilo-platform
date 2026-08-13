import { db } from "@/db/client";
import { listManagerAvailability } from "@/domain/availability";
import { listManagerOrders } from "@/domain/orders";
import { ManagerView } from "./view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ManagerPage() {
  const [orders, availability] = await Promise.all([
    listManagerOrders(db()),
    listManagerAvailability(db()),
  ]);
  return <ManagerView initialOrders={orders} initialAvailability={availability} />;
}
