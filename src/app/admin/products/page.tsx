import { ProductModule } from "../products";
import { AdminRouteFrame } from "../route-frame";
import { adminContext, hasAdminPermission } from "../portal-auth";
export const dynamic = "force-dynamic";
export default async function ProductsPage() { const { request } = await adminContext(); if (!(await hasAdminPermission(request, "catalog.product.read"))) return <AdminRouteFrame permission="catalog.product.read"><div /></AdminRouteFrame>; const canManageProducts = await hasAdminPermission(request, "catalog.product.write"); return <AdminRouteFrame permission="catalog.product.read"><ProductModule initialProducts={[]} loadInitialFromApi canManageProducts={canManageProducts} /></AdminRouteFrame>; }
