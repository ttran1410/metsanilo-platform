import Link from "next/link";
import { AdminRouteFrame } from "../../../route-frame";
import { adminContext, hasAdminPermission } from "../../../portal-auth";
import { OrderEditQueryLoader } from "./query-loader";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { request } = await adminContext();
  const id = (await params).id;
  if (!(await hasAdminPermission(request, "orders.update"))) return <AdminRouteFrame permission="orders.update"><div /></AdminRouteFrame>;
  return (
    <AdminRouteFrame permission="orders.update">
      <main className="shell admin-profile-page">
        <div className="admin-page-heading">
          <Link className="back-link" href={`/admin/orders/${id}`}>← Order detail</Link>
          <p className="eyebrow">ORDER EDIT</p>
          <h1>Edit order</h1>
          <p>Update an open order. Completed and closed orders allow notes, payment corrections, and refunds only.</p>
        </div>
        <OrderEditQueryLoader orderId={id} />
      </main>
    </AdminRouteFrame>
  );
}
