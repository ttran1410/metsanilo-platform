"use client";

import { useEffect, useState } from "react";
import { AdminLoadingState } from "./presentation";
import { MasterDetailUserWorkspace } from "./users/master-detail-workspace";

export function UserModule({
  canManageUsers,
  canAssignPermissions,
  canResetPasswords,
}: {
  canManageUsers: boolean;
  canAssignPermissions: boolean;
  canResetPasswords: boolean;
}) {
  const [initialUsers, setInitialUsers] = useState<any[] | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/admin/users");
        const body = await response.json();
        if (response.ok && body.data) {
          setInitialUsers(body.data);
        } else {
          setInitialUsers([]);
        }
      } catch {
        setInitialUsers([]);
      }
    }
    void load();
  }, []);

  if (!initialUsers) {
    return (
      <section className="shell py-8">
        <AdminLoadingState label="Loading Users &amp; Permissions Workspace…" />
      </section>
    );
  }

  return (
    <MasterDetailUserWorkspace
      initialUsers={initialUsers}
      canManageUsers={canManageUsers}
      canAssignPermissions={canAssignPermissions}
      canResetPasswords={canResetPasswords}
    />
  );
}
