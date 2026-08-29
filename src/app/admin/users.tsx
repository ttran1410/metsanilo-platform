"use client";

import type { Role } from "@/lib/permissions";
import { UserQueryLoader } from "./users/list/query-loader";

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
  return <UserQueryLoader actorRole={actorRole} actorId={actorId} canManageUsers={canManageUsers} canAssignPermissions={canAssignPermissions} canResetPasswords={canResetPasswords} />;
}
