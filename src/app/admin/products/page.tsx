import { db } from "@/db/client";
import { listManagerProducts } from "@/domain/products";
import { ProductModule } from "../products";
import { AdminRouteFrame } from "../route-frame";
export const dynamic = "force-dynamic";
export default async function ProductsPage() { return <AdminRouteFrame><main className="shell"><ProductModule initialProducts={await listManagerProducts(db())} canManageMedia /></main></AdminRouteFrame>; }
