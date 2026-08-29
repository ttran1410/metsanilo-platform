"use client";

import { resetUserPassword, resetUserPermissions, revokeUserSessions, updateUserStatus } from "./user-admin-actions";
import type { Role } from "@/lib/permissions";

type UserTarget = { id: string; email: string | null; displayName: string; role: Role };
type Confirmation = { title: string; description: string; confirmLabel: string; destructive?: boolean; onConfirm: () => Promise<void> };

export function useUserAccountActionController({ selectedUser, setConfirmation, setCreatedInfo, setError, setMessage, refreshUser, reloadExtras }: {
  selectedUser: UserTarget | undefined;
  setConfirmation: (value: Confirmation | null) => void;
  setCreatedInfo: (value: { user: UserTarget; tempPassword: string } | null) => void;
  setError: (message: string) => void;
  setMessage: (message: string) => void;
  refreshUser: (id: string) => Promise<void>;
  reloadExtras: (id: string) => Promise<void>;
}) {
  async function handleResetToDefaults() {
    if (!selectedUser) return;
    setConfirmation({ title: "Reset custom permissions?", description: `Remove all custom permission overrides for ${selectedUser.displayName} and restore ${selectedUser.role} defaults?`, confirmLabel: "Reset permissions", destructive: true, onConfirm: async () => {
      setError(""); setMessage("");
      const result = await resetUserPermissions(selectedUser.id);
      if (!result.ok) return setError(result.message ?? "Could not reset permissions.");
      setMessage(`Permissions for ${selectedUser.displayName} reset to ${selectedUser.role} defaults.`);
      void refreshUser(selectedUser.id);
    } });
  }

  async function handleToggleActive(active: boolean) {
    if (!selectedUser) return;
    setConfirmation({ title: `${active ? "Activate" : "Suspend"} user account?`, description: `${active ? "Activate" : "Suspend"} ${selectedUser.displayName}.${active ? "" : " Their active sessions will no longer be valid."}`, confirmLabel: active ? "Activate account" : "Suspend account", destructive: !active, onConfirm: async () => {
      setError(""); setMessage("");
      const result = await updateUserStatus(selectedUser.id, active);
      if (!result.ok) return setError(result.message ?? "Could not toggle account status.");
      setMessage(active ? `${selectedUser.displayName} account activated.` : `${selectedUser.displayName} account suspended.`);
      void refreshUser(selectedUser.id);
    } });
  }

  async function handleResetPassword(target: UserTarget | undefined = selectedUser) {
    if (!target) return;
    setConfirmation({ title: "Reset user password?", description: `Generate a new temporary password for ${target.displayName}? Their current password will stop working.`, confirmLabel: "Reset password", destructive: true, onConfirm: async () => {
      setError(""); setMessage("");
      const result = await resetUserPassword(target.id);
      if (!result.ok || !result.data) return setError(result.message ?? "Password reset failed.");
      setCreatedInfo({ user: target, tempPassword: result.data.temporaryPassword });
    } });
  }

  async function handleRevokeSessions() {
    if (!selectedUser) return;
    setConfirmation({ title: "Revoke active sessions?", description: `Sign out ${selectedUser.displayName} from every active session?`, confirmLabel: "Revoke sessions", destructive: true, onConfirm: async () => {
      setError(""); setMessage("");
      const result = await revokeUserSessions(selectedUser.id);
      if (!result.ok) return setError(result.message ?? "Could not revoke sessions.");
      setMessage(`All active sessions revoked for ${selectedUser.displayName}.`);
      void reloadExtras(selectedUser.id);
    } });
  }

  return { handleResetToDefaults, handleToggleActive, handleResetPassword, handleRevokeSessions };
}
