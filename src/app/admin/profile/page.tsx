import { ProfileForm } from "./form";
import { AdminRouteFrame } from "../route-frame";
import { adminContext } from "../portal-auth";
import { db } from "@/db/client";
import { currentUser } from "@/domain/access";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { request } = await adminContext();
  const user = await currentUser(db(), request);
  return <AdminRouteFrame><main className="shell admin-profile-page"><div className="admin-page-heading"><div><p className="eyebrow">ACCOUNT</p><h1>My profile</h1><p>Manage your personal details and account security.</p></div></div><ProfileForm initial={{ displayName: user.displayName, email: user.email, username: user.username, role: user.role, active: user.active }} /></main></AdminRouteFrame>;
}
