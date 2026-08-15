import { db } from "@/db/client";
import { orders, availability } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { listManagerProducts } from "@/domain/products";
import { AdminRouteFrame } from "../../../route-frame";
import { adminContext, hasAdminPermission } from "../../../portal-auth";
import { ProductEditView } from "./view";

export const dynamic = "force-dynamic";

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { request } = await adminContext(); const id = (await params).id;
  if (!(await hasAdminPermission(request, "catalog.product.write"))) return <AdminRouteFrame permission="catalog.product.write"><div /></AdminRouteFrame>;
  const product = (await listManagerProducts(db())).find((item) => item.product.id === id);
  if (!product) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">Product not found.</p></main></AdminRouteFrame>;
  const activeOrderRows = await db().select({ id: orders.id }).from(orders).where(and(eq(orders.productId, id), eq(orders.shopId, product.product.shopId), inArray(orders.status, ["NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY"])));
  const reservedRows = await db().select({ id: availability.id }).from(availability).where(and(eq(availability.productId, id), eq(availability.shopId, product.product.shopId)));
  return <AdminRouteFrame><main className="shell pb-10"><div className="admin-page-heading"><a className="back-link" href={`/admin/products/${id}`}>← Product detail</a><p className="eyebrow">CATALOG EDIT</p><h1>Edit {product.product.nameFi}</h1><p>Changes are checked against active orders and reserved availability before saving.</p></div><ProductEditView initial={product.product} impact={{ activeOrders: activeOrderRows.length, availabilityRows: reservedRows.length }} /></main></AdminRouteFrame>;
}
