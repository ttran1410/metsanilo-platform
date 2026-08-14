import { db } from "@/db/client";
import { listManagerProducts } from "@/domain/products";
import { ManualOrdersModule } from "../manual-orders";
import { AdminRouteFrame } from "../route-frame";
export const dynamic = "force-dynamic";
export default async function ManualOrdersPage() { return <AdminRouteFrame><ManualOrdersModule products={await listManagerProducts(db())} /></AdminRouteFrame>; }
