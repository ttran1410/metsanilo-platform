import Link from "next/link";
import { db } from "@/db/client";
import { getCustomerProfile } from "@/domain/customers";
import { AdminRouteFrame } from "../../route-frame";
import { adminContext, hasAdminPermission } from "../../portal-auth";
import { AdminNotFoundState } from "../../presentation";
import { CustomerProfileView } from "./view";

export const dynamic = "force-dynamic";

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { request } = await adminContext();
  if (!(await hasAdminPermission(request, "customers.read"))) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to customer profiles.</p></main></AdminRouteFrame>;
  const profile = await getCustomerProfile(db(), (await params).id);
  if (!profile) return <AdminRouteFrame><AdminNotFoundState title="Customer Profile Not Found" description="This customer record does not exist or may have been anonymized/deleted." backHref="/admin/customers" backLabel="← Return to customer registry" /></AdminRouteFrame>;
  return <AdminRouteFrame><main className="shell admin-profile-page"><div className="admin-page-heading"><Link className="back-link" href="/admin/customers">← Customer registry</Link><p className="eyebrow">CUSTOMER PROFILE</p><h1>{profile.customer.name}</h1><p>Contact details, order history and privacy activity in one place.</p></div><CustomerProfileView initial={profile} canResolveIdentity={await hasAdminPermission(request, "customers.identity.resolve")} canEdit={await hasAdminPermission(request, "customers.write")} canConsent={await hasAdminPermission(request, "customers.consent.write")} canAnonymize={await hasAdminPermission(request, "customers.anonymize")} /></main></AdminRouteFrame>;
}
