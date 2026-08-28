"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Role } from "@/lib/permissions";
import { AdminLoadingState } from "./presentation";
import { MasterDetailUserWorkspace, type UserRow } from "./users/master-detail-workspace";
import { getAdminQuery } from "./admin-query-cache";

export function UserModule({
  actorRole = "MANAGER",
  actorId,
  canManageUsers,
  canAssignPermissions,
  canResetPasswords,
}: {
  actorRole?: Role;
  actorId?: string;
  canManageUsers: boolean;
  canAssignPermissions: boolean;
  canResetPasswords: boolean;
}) {
  const searchParams = useSearchParams();
  const [initialUsers, setInitialUsers] = useState<UserRow[] | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        for (const key of ["q", "role", "page", "limit"]) { const value = searchParams.get(key); if (value) params.set(key, value); }
        const data = await getAdminQuery<UserRow[] | { items?: UserRow[] }>(`/api/admin/users?${params.toString()}`, "users-list");
        const rows = Array.isArray(data) ? data : data?.items;
        if (rows) {
          setInitialUsers(rows);
        } else {
          setInitialUsers([]);
        }
      } catch {
        setInitialUsers([]);
      }
    }
    void load();
  }, [searchParams]);

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
      actorRole={actorRole}
      actorId={actorId}
      canManageUsers={canManageUsers}
      canAssignPermissions={canAssignPermissions}
      canResetPasswords={canResetPasswords}
    />
  );
}
