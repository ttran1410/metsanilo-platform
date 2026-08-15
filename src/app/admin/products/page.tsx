import { db } from "@/db/client";
import { listManagerProducts } from "@/domain/products";
import { ProductModule } from "../products";
import { AdminRouteFrame } from "../route-frame";
import { adminContext, hasAdminPermission } from "../portal-auth";
export const dynamic = "force-dynamic";
export default async function ProductsPage() { const { request } = await adminContext(); if (!(await hasAdminPermission(request, "catalog.product.read"))) return <AdminRouteFrame permission="catalog.product.read"><div /></AdminRouteFrame>; const canManageProducts = await hasAdminPermission(request, "catalog.product.write"); const products = await listManagerProducts(db()); return <AdminRouteFrame permission="catalog.product.read"><ProductModule initialProducts={products} canManageProducts={canManageProducts} /></AdminRouteFrame>; }
