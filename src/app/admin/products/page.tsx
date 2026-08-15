import { db } from "@/db/client";
import { listManagerProducts } from "@/domain/products";
import { ProductModule } from "../products";
import { ProductDetailLinks } from "./detail-links";
import { AdminRouteFrame } from "../route-frame";
import { adminContext, hasAdminPermission } from "../portal-auth";
export const dynamic = "force-dynamic";
export default async function ProductsPage() { const { request } = await adminContext(); if (!(await hasAdminPermission(request, "catalog.product.read"))) return <AdminRouteFrame permission="catalog.product.read"><div /></AdminRouteFrame>; const canManageProducts = await hasAdminPermission(request, "catalog.product.write"); const canManageMedia = await hasAdminPermission(request, "media.write"); const products = await listManagerProducts(db()); return <AdminRouteFrame permission="catalog.product.read"><ProductDetailLinks products={products} /><ProductModule initialProducts={products} canManageProducts={canManageProducts} canManageMedia={canManageMedia} /></AdminRouteFrame>; }
