import { redirect } from "next/navigation";
import { adminContext, hasAdminPermission } from "../../portal-auth";
import { AdminRouteFrame } from "../../route-frame";

export const dynamic = "force-dynamic";

// The customers master-detail workspace is the single rendering surface for
// customer detail. This route survives only as a deep-link alias that
// forwards into it (audit trail links, order listing, bookmarks).
export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { request } = await adminContext();
  if (!(await hasAdminPermission(request, "customers.read"))) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to customer profiles.</p></main></AdminRouteFrame>;
  const { id } = await params;
  redirect(`/admin/customers?customer=${encodeURIComponent(id)}&view=split`);
}
