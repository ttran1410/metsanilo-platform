import Link from "next/link";
import { db } from "@/db/client";
import { getAdminOrderEditData } from "@/domain/admin-order-actions";
import { env } from "@/lib/env";
import { AdminRouteFrame } from "../../../route-frame";
import { adminContext, hasAdminPermission } from "../../../portal-auth";
import { OrderEditForm } from "./view";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { request, actor } = await adminContext();
  const id = (await params).id;
  if (!(await hasAdminPermission(request, "orders.update"))) return <AdminRouteFrame permission="orders.update"><div /></AdminRouteFrame>;
  const data = await getAdminOrderEditData(db(), { actor, shop: { id: env().SHOP_ID } }, id).catch(() => null);
  if (!data) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">Order not found.</p></main></AdminRouteFrame>;
  const { detail, products, availabilityList } = data;
  return (
    <AdminRouteFrame permission="orders.update">
      <main className="shell admin-profile-page">
        <div className="admin-page-heading">
          <Link className="back-link" href={`/admin/orders/${id}`}>← Order detail</Link>
          <p className="eyebrow">ORDER EDIT</p>
          <h1>{detail.order.publicReference}</h1>
          <p>Update an open order. Completed and closed orders allow notes, payment corrections, and refunds only.</p>
        </div>
        <OrderEditForm initial={detail.order} products={products} availabilityList={availabilityList} />
      </main>
    </AdminRouteFrame>
  );
}
