import { db } from "@/db/client";
import { listManagerProducts } from "@/domain/products";
import { ManualOrdersModule } from "../manual-orders";
import { AdminRouteFrame } from "../route-frame";
import { adminContext, hasAdminPermission } from "../portal-auth";
export const dynamic = "force-dynamic";
export default async function ManualOrdersPage() { const { request } = await adminContext(); if (!(await hasAdminPermission(request, "orders.create"))) return <AdminRouteFrame permission="orders.create"><div /></AdminRouteFrame>; return <AdminRouteFrame permission="orders.create"><ManualOrdersModule products={await listManagerProducts(db())} /></AdminRouteFrame>; }
