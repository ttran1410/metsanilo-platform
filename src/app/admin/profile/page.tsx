import { ProfileForm } from "./form";
import { AdminRouteFrame } from "../route-frame";
import { adminContext } from "../portal-auth";
import { db } from "@/db/client";
import { currentUser } from "@/domain/access";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { request } = await adminContext();
  const user = await currentUser(db(), request);

  return (
    <AdminRouteFrame>
      <main className="shell admin-profile-page pb-12 flex flex-col gap-5">
        <div className="admin-page-heading border-b border-line pb-3">
          <div>
            <span className="eyebrow text-primary">ACCOUNT SETTINGS</span>
            <h1 className="text-2xl font-bold tracking-tight text-ink mt-0.5">My profile</h1>
            <p className="text-xs muted mt-0.5">Manage your personal details and account security.</p>
          </div>
        </div>

        <ProfileForm
          initial={{
            displayName: user.displayName,
            email: user.email,
            username: user.username,
            role: user.role,
            active: user.active,
          }}
        />
      </main>
    </AdminRouteFrame>
  );
}
