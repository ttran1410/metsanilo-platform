import { db } from "@/db/client";
import { listManagerProducts } from "@/domain/products";
import { ProductModule } from "../products";
import { AdminRouteFrame } from "../route-frame";
import { adminContext, hasAdminPermission } from "../portal-auth";
export const dynamic = "force-dynamic";
export default async function ProductsPage() { const { request } = await adminContext(); if (!(await hasAdminPermission(request, "catalog.product.write"))) return <AdminRouteFrame permission="catalog.product.write"><div /></AdminRouteFrame>; return <AdminRouteFrame permission="catalog.product.write"><main className="shell"><ProductModule initialProducts={await listManagerProducts(db())} canManageMedia /></main></AdminRouteFrame>; }
