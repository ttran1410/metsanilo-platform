"use client";

import { useState } from "react";
import { updateUserPermission } from "./user-admin-actions";
import type { Permission } from "@/lib/permissions";
import type { UserRow } from "./master-detail-workspace";

export function usePermissionEditorController(selectedUser: UserRow | null, refresh: (id: string) => Promise<void>, setError: (message: string) => void, setMessage: (message: string) => void) {
  const [pendingByUser, setPendingByUser] = useState<Record<string, Partial<Record<Permission, boolean>>>>({});
  const [savingPermissions, setSavingPermissions] = useState(false);
  const pendingPermissions = selectedUser ? pendingByUser[selectedUser.id] ?? {} : {};

  function setPendingPermissions(next: Partial<Record<Permission, boolean>> | ((current: Partial<Record<Permission, boolean>>) => Partial<Record<Permission, boolean>>)) {
    if (!selectedUser) return;
    setPendingByUser((users) => ({
      ...users,
      [selectedUser.id]: typeof next === "function" ? next(users[selectedUser.id] ?? {}) : next,
    }));
  }

  function stagePermission(permission: Permission, granted: boolean) {
    if (!selectedUser) return;
    setPendingPermissions((changes) => {
      const next = { ...changes };
      if (granted === selectedUser.permissions.includes(permission)) delete next[permission];
      else next[permission] = granted;
      return next;
    });
  }

  async function savePermissionChanges() {
    if (!selectedUser || savingPermissions) return;
    const changes = Object.entries(pendingPermissions) as Array<[Permission, boolean]>;
    if (!changes.length) return;
    setSavingPermissions(true); setError(""); setMessage("");
    let saved = 0;
    try {
      for (const [permission, granted] of changes) {
        const result = await updateUserPermission(selectedUser.id, permission, granted);
        if (!result.ok) throw new Error(result.message ?? `Could not update ${permission}.`);
        saved += 1;
      }
      setPendingPermissions({});
      setMessage(`${saved} permission ${saved === 1 ? "change" : "changes"} saved for ${selectedUser.displayName}.`);
      await refresh(selectedUser.id);
    } catch (error) {
      setError(`${saved ? `${saved} changes were saved. ` : ""}${error instanceof Error ? error.message : "Could not save permission changes."}`);
      await refresh(selectedUser.id);
    } finally { setSavingPermissions(false); }
  }

  return { pendingPermissions, setPendingPermissions, savingPermissions, stagePermission, savePermissionChanges };
}
