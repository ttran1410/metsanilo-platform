import { UserModule } from "../users";
import { AdminRouteFrame } from "../route-frame";
import { AdminPageHeader } from "../presentation";
import { adminContext, hasAdminPermission } from "../portal-auth";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const { actor, request } = await adminContext();
  const canManageUsers = await hasAdminPermission(request, "shop_users.manage");
  const canAssignPermissions = await hasAdminPermission(request, "shop_permissions.assign");
  const canResetPasswords = await hasAdminPermission(request, "shop_users.password_reset");

  return (
    <AdminRouteFrame permission="shop_users.read">
      <main className="shell admin-users-page">
        <AdminPageHeader
          eyebrow="ADMINISTRATION"
          title="Users &amp; permissions"
          description="Manage staff access and operational permissions."
        />
        <div className="admin-users-module">
          <UserModule
            actorRole={actor.role}
            canManageUsers={canManageUsers}
            canAssignPermissions={canAssignPermissions}
            canResetPasswords={canResetPasswords}
          />
        </div>
      </main>
    </AdminRouteFrame>
  );
}
