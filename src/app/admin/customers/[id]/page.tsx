import { db } from "@/db/client";
import { getCustomerProfile } from "@/domain/customers";
import { AdminRouteFrame } from "../../route-frame";
import { adminContext, hasAdminPermission } from "../../portal-auth";
import { CustomerProfileView } from "./view";

export const dynamic = "force-dynamic";

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { request } = await adminContext();
  if (!(await hasAdminPermission(request, "customers.read"))) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to customer profiles.</p></main></AdminRouteFrame>;
  const profile = await getCustomerProfile(db(), (await params).id);
  if (!profile) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">Customer not found.</p></main></AdminRouteFrame>;
  return <AdminRouteFrame><main className="shell admin-profile-page"><div className="admin-page-heading"><a className="back-link" href="/admin/customers">← Customer registry</a><p className="eyebrow">CUSTOMER PROFILE</p><h1>{profile.customer.name}</h1><p>Contact details, order history and privacy activity in one place.</p></div><CustomerProfileView initial={profile} canResolveIdentity={await hasAdminPermission(request, "customers.identity.resolve")} canEdit={await hasAdminPermission(request, "customers.write")} canConsent={await hasAdminPermission(request, "customers.consent.write")} canAnonymize={await hasAdminPermission(request, "customers.anonymize")} /></main></AdminRouteFrame>;
}
